/**
 * Relayer Service — submits transactions to Axiome chain on behalf of users.
 *
 * Uses x/authz (MsgExec) for user actions (create/join/cancel),
 * and direct execution for admin actions (resolve/draw).
 */

import { DirectSecp256k1HdWallet, Registry } from '@cosmjs/proto-signing'
import { SigningStargateClient, defaultRegistryTypes, GasPrice } from '@cosmjs/stargate'
import type { DeliverTxResponse } from '@cosmjs/stargate'
import { MsgExec } from 'cosmjs-types/cosmos/authz/v1beta1/tx'
import { MsgExecuteContract } from 'cosmjs-types/cosmwasm/wasm/v1/tx'
import { toUtf8 } from '@cosmjs/encoding'
import { stringToPath } from '@cosmjs/crypto'
import { AXIOME_RPC, AXIOME_PREFIX, AXIOME_GAS_PRICE, AXIOME_HD_PATH } from '@checkers/shared/chain'
import { SequenceManager } from './sequence-manager'

const MAX_RETRIES = 3

export interface TxResult {
  txHash: string
  events: { type: string; attributes: { key: string; value: string }[] }[]
}

/** Extract wasm event attributes for our contract */
function parseWasmEvents(result: DeliverTxResponse, contractAddress: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  for (const event of (result.events || [])) {
    if (event.type !== 'wasm') continue
    let isOurs = false
    for (const attr of event.attributes) {
      if (attr.key === '_contract_address' && attr.value === contractAddress) isOurs = true
      attrs[attr.key] = attr.value
    }
    if (!isOurs) {
      // clear attrs from non-our-contract events
      for (const attr of event.attributes) {
        if (attr.key !== '_contract_address') delete attrs[attr.key]
      }
    }
  }
  return attrs
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

    // Custom registry with authz + wasm types
    const registry = new Registry([
      ...defaultRegistryTypes,
      ['/cosmos.authz.v1beta1.MsgExec', MsgExec],
      ['/cosmwasm.wasm.v1.MsgExecuteContract', MsgExecuteContract],
    ])

    // Connect signing client
    this.client = await SigningStargateClient.connectWithSigner(AXIOME_RPC, this.wallet, {
      registry,
      gasPrice: GasPrice.fromString(AXIOME_GAS_PRICE),
    })

    // Init sequence manager
    this.sequenceManager = new SequenceManager(this.address)
    await this.sequenceManager.init()

    console.log(`[relayer] Initialized: ${this.address}`)
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

  private async submitTx(msgs: any[], memo = ''): Promise<DeliverTxResponse> {
    if (!this.client || !this.sequenceManager) {
      throw new Error('Relayer not initialized')
    }

    const release = await this.acquireBroadcastLock()
    let lastError: Error | null = null

    try {
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          const result = await this.client.signAndBroadcast(
            this.address,
            msgs,
            'auto',
            memo,
          )

          if (result.code !== 0) {
            const rawLog = result.rawLog || ''

            // Sequence mismatch — retry
            if (rawLog.includes('account sequence mismatch')) {
              const match = rawLog.match(/expected (\d+)/)
              if (match) {
                this.sequenceManager.forceSet(parseInt(match[1], 10))
              } else {
                await this.sequenceManager.handleSequenceMismatch()
              }
              continue
            }

            throw new Error(`Tx failed (code ${result.code}): ${rawLog}`)
          }

          return result
        } catch (err: any) {
          const msg = err?.message || ''

          if (msg.includes('account sequence mismatch')) {
            const match = msg.match(/expected (\d+)/)
            if (match) {
              this.sequenceManager.forceSet(parseInt(match[1], 10))
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

  private async reconnect() {
    if (!this.wallet) return
    try {
      const registry = new Registry([
        ...defaultRegistryTypes,
        ['/cosmos.authz.v1beta1.MsgExec', MsgExec],
        ['/cosmwasm.wasm.v1.MsgExecuteContract', MsgExecuteContract],
      ])
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
    const executeMsg = {
      typeUrl: '/cosmwasm.wasm.v1.MsgExecuteContract',
      value: MsgExecuteContract.fromPartial({
        sender: this.address,
        contract: this.contractAddress,
        msg: toUtf8(JSON.stringify(msg)),
        funds,
      }),
    }
    return this.submitTx([executeMsg])
  }

  /** Execute contract msg on behalf of user via MsgExec (authz) */
  private async executeOnBehalf(
    userAddress: string,
    msg: Record<string, unknown>,
    funds: { denom: string; amount: string }[] = [],
  ): Promise<DeliverTxResponse> {
    const innerMsg = MsgExecuteContract.fromPartial({
      sender: userAddress,
      contract: this.contractAddress,
      msg: toUtf8(JSON.stringify(msg)),
      funds,
    })

    const execMsg = {
      typeUrl: '/cosmos.authz.v1beta1.MsgExec',
      value: MsgExec.fromPartial({
        grantee: this.address,
        msgs: [{
          typeUrl: '/cosmwasm.wasm.v1.MsgExecuteContract',
          value: MsgExecuteContract.encode(innerMsg).finish(),
        }],
      }),
    }

    return this.submitTx([execMsg])
  }

  /** Parse on-chain game_id from tx result wasm events */
  parseOnChainGameId(result: DeliverTxResponse): number | null {
    const attrs = parseWasmEvents(result, this.contractAddress)
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
      value: {
        fromAddress: this.address,
        toAddress: recipientAddress,
        amount: [{ denom: 'uaxm', amount }],
      },
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
