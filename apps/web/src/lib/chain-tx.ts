/**
 * Chain TX — sign and broadcast transactions from the user's wallet.
 *
 * Uses sign() + broadcast_tx_sync via RPC proxy to avoid CORS issues
 * and the 60s polling timeout of signAndBroadcast through Vercel proxy.
 */

import { DirectSecp256k1HdWallet, Registry } from '@cosmjs/proto-signing'
import { SigningStargateClient, defaultRegistryTypes, GasPrice } from '@cosmjs/stargate'
import { TxRaw } from 'cosmjs-types/cosmos/tx/v1beta1/tx'
import { MsgGrant } from 'cosmjs-types/cosmos/authz/v1beta1/tx'
import { Grant } from 'cosmjs-types/cosmos/authz/v1beta1/authz'
import { Timestamp } from 'cosmjs-types/google/protobuf/timestamp'
import {
  ContractExecutionAuthorization,
  AcceptedMessageKeysFilter,
  MaxCallsLimit,
} from 'cosmjs-types/cosmwasm/wasm/v1/authz'
import { loadSessionWallet } from './wallet-core'
import { AXIOME_PREFIX, AXIOME_GAS_PRICE } from '@checkers/shared/chain'

const RPC_PROXY = '/chain-rpc'

/** Safe base64 encode for Uint8Array (no stack overflow with spread) */
function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 8192
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

/** Deserialize the session wallet for signing */
async function getSessionWallet(): Promise<DirectSecp256k1HdWallet> {
  const serialized = loadSessionWallet()
  if (!serialized) throw new Error('Кошелёк не найден — переподключитесь')
  try {
    return await DirectSecp256k1HdWallet.deserialize(serialized, 'session-password')
  } catch (err) {
    console.error('[chain-tx] Failed to deserialize wallet:', err)
    throw new Error('Ошибка десериализации кошелька — переподключитесь')
  }
}

/** Get the current account sequence from the chain via REST proxy */
async function getAccountInfo(address: string): Promise<{ accountNumber: number; sequence: number }> {
  const url = `/chain-rest/cosmos/auth/v1beta1/accounts/${address}`
  let res: Response
  try {
    res = await fetch(url)
  } catch (err) {
    console.error('[chain-tx] Network error fetching account info:', err)
    throw new Error('Не удалось подключиться к блокчейну')
  }

  // Account might not exist yet (new wallet with no txs)
  if (res.status === 404 || res.status === 400) {
    console.warn('[chain-tx] Account not found on chain, using defaults (0/0)')
    return { accountNumber: 0, sequence: 0 }
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    console.error('[chain-tx] Account info response:', res.status, text)
    throw new Error(`Ошибка получения данных аккаунта (${res.status})`)
  }

  const data = await res.json() as any
  const account = data.account || {}

  // Handle BaseAccount wrapper that cosmos SDK sometimes uses
  const inner = account.base_account || account
  return {
    accountNumber: parseInt(inner.account_number || '0', 10),
    sequence: parseInt(inner.sequence || '0', 10),
  }
}

/** Broadcast signed tx via RPC proxy (broadcast_tx_sync — returns instantly from mempool) */
async function broadcastTxSync(txBytes: Uint8Array): Promise<{ txHash: string; code: number; log: string }> {
  const b64 = uint8ToBase64(txBytes)

  let res: Response
  try {
    res = await fetch(RPC_PROXY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'broadcast_tx_sync',
        params: { tx: b64 },
        id: 1,
      }),
    })
  } catch (err) {
    console.error('[chain-tx] Network error broadcasting tx:', err)
    throw new Error('Не удалось отправить транзакцию — проверьте соединение')
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    console.error('[chain-tx] RPC broadcast response:', res.status, text)
    throw new Error(`Ошибка отправки транзакции (HTTP ${res.status})`)
  }

  const data = await res.json() as any
  console.log('[chain-tx] Broadcast response:', JSON.stringify(data))

  // Check for JSON-RPC error
  if (data.error) {
    const errMsg = typeof data.error === 'string' ? data.error : (data.error.message || data.error.data || JSON.stringify(data.error))
    console.error('[chain-tx] RPC error:', errMsg)
    throw new Error(`RPC ошибка: ${errMsg}`)
  }

  const result = data.result || {}

  if (result.code && result.code !== 0) {
    console.error('[chain-tx] Tx rejected:', result.log, result.codespace)
    throw new Error(`Транзакция отклонена: ${result.log || result.codespace || 'неизвестная ошибка'}`)
  }

  return {
    txHash: result.hash || '',
    code: result.code || 0,
    log: result.log || '',
  }
}

/**
 * Sign and broadcast a MsgGrant for ContractExecutionAuthorization.
 * Grants the relayer permission to execute specific contract messages on behalf of the user.
 */
export async function grantAuthzToRelayer(
  userAddress: string,
  relayerAddress: string,
  contractAddress: string,
): Promise<string> {
  console.log('[chain-tx] Starting authz grant:', { userAddress, relayerAddress, contractAddress })

  // Step 1: Get wallet
  const wallet = await getSessionWallet()
  const [account] = await wallet.getAccounts()
  console.log('[chain-tx] Wallet loaded, address:', account.address)

  if (account.address !== userAddress) {
    throw new Error(`Адрес кошелька (${account.address}) не совпадает с ожидаемым (${userAddress})`)
  }

  // Step 2: Build the ContractExecutionAuthorization
  const filter = AcceptedMessageKeysFilter.fromPartial({
    keys: ['create_game', 'join_game', 'cancel_game', 'claim_timeout'],
  })

  const limit = MaxCallsLimit.fromPartial({
    remaining: BigInt('999999999'),
  })

  const authorization = ContractExecutionAuthorization.fromPartial({
    grants: [{
      contract: contractAddress,
      filter: {
        typeUrl: '/cosmwasm.wasm.v1.AcceptedMessageKeysFilter',
        value: AcceptedMessageKeysFilter.encode(filter).finish(),
      },
      limit: {
        typeUrl: '/cosmwasm.wasm.v1.MaxCallsLimit',
        value: MaxCallsLimit.encode(limit).finish(),
      },
    }],
  })

  // Expiration: 1 year from now
  const expiration = new Date()
  expiration.setFullYear(expiration.getFullYear() + 1)

  const grantMsg = {
    typeUrl: '/cosmos.authz.v1beta1.MsgGrant',
    value: MsgGrant.fromPartial({
      granter: userAddress,
      grantee: relayerAddress,
      grant: Grant.fromPartial({
        authorization: {
          typeUrl: '/cosmwasm.wasm.v1.ContractExecutionAuthorization',
          value: ContractExecutionAuthorization.encode(authorization).finish(),
        },
        expiration: Timestamp.fromPartial({
          seconds: BigInt(Math.floor(expiration.getTime() / 1000)),
          nanos: 0,
        }),
      }),
    }),
  }

  // Step 3: Register types
  const registry = new Registry([
    ...defaultRegistryTypes,
    ['/cosmos.authz.v1beta1.MsgGrant', MsgGrant],
  ])

  // Step 4: Create offline signing client
  const client = await SigningStargateClient.offline(wallet, {
    registry,
    gasPrice: GasPrice.fromString(AXIOME_GAS_PRICE),
  })

  // Step 5: Get account info for signing
  console.log('[chain-tx] Fetching account info...')
  const { accountNumber, sequence } = await getAccountInfo(userAddress)
  console.log('[chain-tx] Account info:', { accountNumber, sequence })

  // Step 6: Sign the transaction
  console.log('[chain-tx] Signing transaction...')
  const fee = { amount: [{ denom: 'uaxm', amount: '10000' }], gas: '200000' }
  const signedTx = await client.sign(
    userAddress,
    [grantMsg],
    fee,
    '',
    { accountNumber, sequence, chainId: 'axiome-1' },
  )

  // Step 7: Broadcast
  console.log('[chain-tx] Broadcasting transaction...')
  const txBytes = TxRaw.encode(signedTx).finish()
  console.log('[chain-tx] Tx bytes length:', txBytes.length)
  const result = await broadcastTxSync(txBytes)

  if (result.code !== 0) {
    throw new Error(`Authz grant failed (code ${result.code}): ${result.log}`)
  }

  console.log('[chain-tx] Authz grant success! TxHash:', result.txHash)
  return result.txHash
}
