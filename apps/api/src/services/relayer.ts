/**
 * Relayer Service — submits transactions to Axiome chain on behalf of users.
 *
 * Uses x/authz (MsgExec) for user actions (create/join/cancel),
 * and direct execution for admin actions (resolve/draw).
 *
 * Pattern matches coinflip relayer: explicit sign() + broadcastTxSync() + polling
 * to avoid simulate() issues with authz MsgExec.
 */

import { DirectSecp256k1HdWallet, Registry } from '@cosmjs/proto-signing'
import { SigningStargateClient, GasPrice, type StdFee, type SignerData } from '@cosmjs/stargate'
import type { DeliverTxResponse } from '@cosmjs/stargate'
import { TxRaw } from 'cosmjs-types/cosmos/tx/v1beta1/tx'
import { MsgExec } from 'cosmjs-types/cosmos/authz/v1beta1/tx'
import { MsgExecuteContract } from 'cosmjs-types/cosmwasm/wasm/v1/tx'
import { MsgSend } from 'cosmjs-types/cosmos/bank/v1beta1/tx'
import { toUtf8 } from '@cosmjs/encoding'
import { stringToPath } from '@cosmjs/crypto'
import { AXIOME_RPC, AXIOME_REST, AXIOME_PREFIX, AXIOME_GAS_PRICE, AXIOME_HD_PATH, AXIOME_CHAIN_ID, AXIOME_DENOM } from '@checkers/shared/chain'
import { SequenceManager } from './sequence-manager'

const MAX_RETRIES = 3
const DEFAULT_GAS_LIMIT = 500_000

export interface TxResult {
  txHash: string
  events: { type: string; attributes: { key: string; value: string }[] }[]
}

/** Custom registry — only the types we use (no defaultRegistryTypes) */
function createRegistry(): Registry {
  const registry = new Registry()
  registry.register('/cosmos.authz.v1beta1.MsgExec', MsgExec)
  registry.register('/cosmwasm.wasm.v1.MsgExecuteContract', MsgExecuteContract)
  registry.register('/cosmos.bank.v1beta1.MsgSend', MsgSend)
  return registry
}

/** Extract wasm event attributes for our contract */
function parseWasmEvents(events: readonly any[], contractAddress: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  for (const event of events) {
    if (event.type !== 'wasm') continue
    const eventAttrs = event.attributes || []
    const isOurs = eventAttrs.some(
      (attr: any) => attr.key === '_contract_address' && attr.value === contractAddress
    )
    if (!isOurs) continue
    for (const attr of eventAttrs) {
      if (attr.key !== '_contract_address') {
        attrs[attr.key] = attr.value
      }
    }
  }
  return attrs
}

/** Parse "expected X, got Y" from a sequence mismatch error */
function parseExpectedSequence(errorMsg: string): number | null {
  const m = errorMsg.match(/expected\s+(\d+)/)
  return m?.[1] ? parseInt(m[1], 10) : null
}

export class RelayerService {
  private client: SigningStargateClient | null = null
  private wallet: DirectSecp256k1HdWallet | null = null
  private address: string = ''
  private sequenceManager: SequenceManager | null = null
  private contractAddress: string = ''
  private broadcastLock: Promise<void> = Promise.resolve()

  async init() {
    const mnemonic = process.env.RELAYER_MNEMONIC
    if (!mnemonic) {
      console.warn('[relayer] RELAYER_MNEMONIC not set — relayer disabled')
      return
    }

    this.contractAddress = process.env.CHECKERS_CONTRACT || ''
    if (!this.contractAddress) {
      console.warn('[relayer] CHECKERS_CONTRACT not set — relayer disabled')
      return
    }

    // Create wallet with Axiome HD path (coin type 546)
    this.wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
      prefix: AXIOME_PREFIX,
      hdPaths: [stringToPath(AXIOME_HD_PATH)],
    })
    const [account] = await this.wallet.getAccounts()
    this.address = account.address

    // Custom registry (clean, no defaultRegistryTypes — matches coinflip pattern)
    const registry = createRegistry()

    // Connect signing client
    this.client = await SigningStargateClient.connectWithSigner(AXIOME_RPC, this.wallet, {
      registry,
      gasPrice: GasPrice.fromString(AXIOME_GAS_PRICE),
    })

    // Init sequence manager
    this.sequenceManager = new SequenceManager(this.address)
    await this.sequenceManager.init()

    console.log(`[relayer] Initialized: ${this.address}`)
    console.log(`[relayer] Contract: ${this.contractAddress}`)
  }

  get isReady(): boolean {
    return !!this.client && !!this.contractAddress
  }

  // ── Broadcast with mutex + retry ────────────────────────────────

  private acquireBroadcastLock(): Promise<() => void> {
    let release: () => void
    const next = new Promise<void>((resolve) => { release = resolve })
    const prev = this.broadcastLock
    this.broadcastLock = next
    return prev.then(() => release!)
  }

  /**
   * Sign + broadcastTxSync + poll for result.
   * Uses explicit signerData to avoid per-tx chain queries.
   * Retries on sequence mismatch.
   */
  private async submitTx(msgs: any[], memo = ''): Promise<DeliverTxResponse> {
    if (!this.client || !this.sequenceManager) {
      throw new Error('Relayer not initialized')
    }

    const release = await this.acquireBroadcastLock()
    let lastError: Error | null = null

    try {
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          // 1. Get sequence from local manager
          const { accountNumber, sequence } = await this.sequenceManager.getAndIncrement()
          const signerData: SignerData = {
            accountNumber,
            sequence,
            chainId: AXIOME_CHAIN_ID,
          }

          // 2. Fee (fixed gas, no simulate — avoids authz simulate issues)
          const fee: StdFee = {
            amount: [{ denom: AXIOME_DENOM, amount: '12500' }],
            gas: String(DEFAULT_GAS_LIMIT),
          }

          // 3. Sign with explicit signerData
          console.log(`[relayer] Signing tx (attempt ${attempt + 1}, seq=${sequence})`)
          const txRaw = await this.client.sign(
            this.address,
            msgs,
            fee,
            memo,
            signerData,
          )
          const txBytes = TxRaw.encode(txRaw).finish()

          // 4. Broadcast SYNC (instant mempool acceptance)
          const txHashHex = await this.client.broadcastTxSync(txBytes)
          const txHash = typeof txHashHex === 'string'
            ? txHashHex
            : Buffer.from(txHashHex).toString('hex').toUpperCase()

          console.log(`[relayer] Tx in mempool: ${txHash.slice(0, 16)}...`)

          // 5. Poll for tx inclusion (up to 30s)
          const txResult = await this.pollForTx(txHash, 30_000)

          if (!txResult) {
            // Tx might still succeed — return optimistic result
            console.warn(`[relayer] Tx poll timeout: ${txHash.slice(0, 16)}...`)
            return {
              code: 0,
              transactionHash: txHash,
              height: 0,
              events: [],
              rawLog: '',
              msgResponses: [],
              gasUsed: BigInt(0),
              gasWanted: BigInt(0),
              txIndex: 0,
            }
          }

          if (txResult.code !== 0) {
            const rawLog = txResult.rawLog || ''
            console.error(`[relayer] Tx failed (code ${txResult.code}): ${rawLog}`)

            // Sequence mismatch — retry with corrected sequence
            if (rawLog.includes('account sequence mismatch')) {
              const expected = parseExpectedSequence(rawLog)
              if (expected !== null) {
                await this.sequenceManager.forceSet(expected)
              } else {
                await this.sequenceManager.handleSequenceMismatch()
              }
              lastError = new Error(rawLog)
              continue
            }

            throw new Error(rawLog || `Tx failed with code ${txResult.code}`)
          }

          return {
            code: 0,
            transactionHash: txHash,
            height: txResult.height,
            events: txResult.events,
            rawLog: txResult.rawLog,
            msgResponses: [],
            gasUsed: BigInt(0),
            gasWanted: BigInt(0),
            txIndex: 0,
          }
        } catch (err: any) {
          const msg = err?.message || ''

          if (msg.includes('account sequence mismatch')) {
            const expected = parseExpectedSequence(msg)
            if (expected !== null) {
              await this.sequenceManager.forceSet(expected)
            } else {
              await this.sequenceManager.handleSequenceMismatch()
            }
            lastError = err
            continue
          }

          if (msg.includes('connect') || msg.includes('ECONNRESET')) {
            await this.reconnect()
            lastError = err
            continue
          }

          throw err
        }
      }

      throw lastError || new Error('Max retries reached')
    } finally {
      release()
    }
  }

  /** Poll chain for tx result using both RPC and REST */
  private async pollForTx(txHash: string, maxMs: number): Promise<{
    code: number; rawLog: string; height: number;
    events: Array<{ type: string; attributes: Array<{ key: string; value: string }> }>
  } | null> {
    const start = Date.now()
    const interval = 2000
    const hash0x = txHash.startsWith('0x') ? txHash : `0x${txHash}`

    while (Date.now() - start < maxMs) {
      await new Promise(r => setTimeout(r, interval))

      try {
        // Try Tendermint RPC first (faster)
        const rpcRes = await fetch(`${AXIOME_RPC}/tx?hash=${hash0x}`, {
          signal: AbortSignal.timeout(3000),
        })
        if (rpcRes.ok) {
          const data = await rpcRes.json() as any
          if (data.result?.tx_result) {
            return {
              code: data.result.tx_result.code,
              rawLog: data.result.tx_result.log ?? '',
              height: Number(data.result.height ?? 0),
              events: data.result.tx_result.events ?? [],
            }
          }
        }
      } catch {
        // Ignore, try REST fallback
      }

      try {
        // REST fallback
        const restRes = await fetch(`${AXIOME_REST}/cosmos/tx/v1beta1/txs/${txHash}`, {
          signal: AbortSignal.timeout(3000),
        })
        if (restRes.ok) {
          const data = await restRes.json() as any
          if (data.tx_response) {
            return {
              code: data.tx_response.code,
              rawLog: data.tx_response.raw_log ?? '',
              height: Number(data.tx_response.height ?? 0),
              events: data.tx_response.events ?? [],
            }
          }
        }
      } catch {
        // Continue polling
      }
    }

    return null
  }

  private async reconnect() {
    if (!this.wallet) return
    try {
      const registry = createRegistry()
      this.client = await SigningStargateClient.connectWithSigner(AXIOME_RPC, this.wallet, {
        registry,
        gasPrice: GasPrice.fromString(AXIOME_GAS_PRICE),
      })
    } catch (err) {
      console.error('[relayer] Reconnect failed:', err)
    }
  }

  // ── Contract execution helpers ──────────────────────────────────

  /** Execute contract msg directly from relayer (admin actions) */
  private async executeContract(msg: Record<string, unknown>, funds: { denom: string; amount: string }[] = []): Promise<DeliverTxResponse> {
    const innerMsg: MsgExecuteContract = {
      sender: this.address,
      contract: this.contractAddress,
      msg: toUtf8(JSON.stringify(msg)),
      funds,
    }
    const msgAny = {
      typeUrl: '/cosmwasm.wasm.v1.MsgExecuteContract',
      value: innerMsg,
    }
    return this.submitTx([msgAny])
  }

  /** Execute contract msg on behalf of user via MsgExec (authz) */
  private async executeOnBehalf(
    userAddress: string,
    msg: Record<string, unknown>,
    funds: { denom: string; amount: string }[] = [],
  ): Promise<DeliverTxResponse> {
    // Build inner MsgExecuteContract as plain object (matches coinflip pattern)
    const innerMsg: MsgExecuteContract = {
      sender: userAddress,
      contract: this.contractAddress,
      msg: toUtf8(JSON.stringify(msg)),
      funds,
    }

    // Build MsgExec wrapping the inner message
    const execMsg: MsgExec = {
      grantee: this.address,
      msgs: [{
        typeUrl: '/cosmwasm.wasm.v1.MsgExecuteContract',
        value: MsgExecuteContract.encode(innerMsg).finish(),
      }],
    }

    const msgAny = {
      typeUrl: '/cosmos.authz.v1beta1.MsgExec',
      value: execMsg,
    }

    console.log(`[relayer] executeOnBehalf: user=${userAddress.slice(0, 12)}... action=${Object.keys(msg)[0]}`)
    return this.submitTx([msgAny])
  }

  /** Parse on-chain game_id from tx result wasm events */
  parseOnChainGameId(result: DeliverTxResponse): number | null {
    const attrs = parseWasmEvents(result.events || [], this.contractAddress)
    const gameId = attrs.game_id
    return gameId ? parseInt(gameId, 10) : null
  }

  // ── Public API ──────────────────────────────────────────────────

  /** Create game on behalf of user (authz). Returns txHash + on-chain game_id */
  async relayCreateGame(
    userAddress: string,
    variant: string,
    timePerMove: number,
    wagerAmount: string,
    denom: string,
  ): Promise<{ txHash: string; onChainGameId: number | null }> {
    const result = await this.executeOnBehalf(
      userAddress,
      { create_game: { variant, time_per_move: timePerMove } },
      [{ denom, amount: wagerAmount }],
    )
    return {
      txHash: result.transactionHash,
      onChainGameId: this.parseOnChainGameId(result),
    }
  }

  /** Join game on behalf of user (authz) */
  async relayJoinGame(
    userAddress: string,
    gameId: number,
    wagerAmount: string,
    denom: string,
  ): Promise<string> {
    const result = await this.executeOnBehalf(
      userAddress,
      { join_game: { game_id: gameId } },
      [{ denom, amount: wagerAmount }],
    )
    return result.transactionHash
  }

  /** Cancel game on behalf of user (authz) */
  async relayCancelGame(userAddress: string, gameId: number): Promise<string> {
    const result = await this.executeOnBehalf(
      userAddress,
      { cancel_game: { game_id: gameId } },
    )
    return result.transactionHash
  }

  /** Resolve game — admin direct call */
  async relayResolveGame(gameId: number, winner: string): Promise<string> {
    const result = await this.executeContract({
      resolve_game: { game_id: gameId, winner },
    })
    return result.transactionHash
  }

  /** Resolve draw — admin direct call */
  async relayResolveDraw(gameId: number): Promise<string> {
    const result = await this.executeContract({
      resolve_draw: { game_id: gameId },
    })
    return result.transactionHash
  }

  /** Claim timeout — on behalf of user */
  async relayClaimTimeout(userAddress: string, gameId: number): Promise<string> {
    const result = await this.executeOnBehalf(
      userAddress,
      { claim_timeout: { game_id: gameId } },
    )
    return result.transactionHash
  }

  /** Send small AXM to user for gas (faucet for authz grant) */
  async sendGas(recipientAddress: string, amount: string): Promise<string> {
    if (!this.client) throw new Error('Relayer not initialized')
    const sendMsg = {
      typeUrl: '/cosmos.bank.v1beta1.MsgSend',
      value: MsgSend.fromPartial({
        fromAddress: this.address,
        toAddress: recipientAddress,
        amount: [{ denom: AXIOME_DENOM, amount }],
      }),
    }
    const result = await this.submitTx([sendMsg], 'gas faucet')
    return result.transactionHash
  }

  /** Get relayer address */
  getAddress(): string {
    return this.address
  }
}

// Singleton
export const relayer = new RelayerService()
