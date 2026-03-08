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

/** Deserialize the session wallet for signing */
async function getSessionWallet(): Promise<DirectSecp256k1HdWallet> {
  const serialized = loadSessionWallet()
  if (!serialized) throw new Error('No session wallet — please reconnect')
  return DirectSecp256k1HdWallet.deserialize(serialized, 'session-password')
}

/** Get the current account sequence from the chain via RPC proxy */
async function getAccountInfo(address: string): Promise<{ accountNumber: number; sequence: number }> {
  const res = await fetch(`/chain-rest/cosmos/auth/v1beta1/accounts/${address}`)
  if (!res.ok) throw new Error('Failed to fetch account info')
  const data = await res.json() as any
  const account = data.account || {}
  return {
    accountNumber: parseInt(account.account_number || '0', 10),
    sequence: parseInt(account.sequence || '0', 10),
  }
}

/** Broadcast signed tx via RPC proxy (broadcast_tx_sync — returns instantly from mempool) */
async function broadcastTxSync(txBytes: Uint8Array): Promise<{ txHash: string; code: number }> {
  const b64 = btoa(String.fromCharCode(...txBytes))
  const res = await fetch(RPC_PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'broadcast_tx_sync',
      params: { tx: b64 },
      id: 1,
    }),
  })

  if (!res.ok) throw new Error('RPC broadcast failed')
  const data = await res.json() as any
  const result = data.result || {}

  if (result.code && result.code !== 0) {
    throw new Error(`Tx rejected: ${result.log || result.codespace || 'unknown error'}`)
  }

  return {
    txHash: result.hash || '',
    code: result.code || 0,
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
  const wallet = await getSessionWallet()

  // Build the ContractExecutionAuthorization
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

  // Register types
  const registry = new Registry([
    ...defaultRegistryTypes,
    ['/cosmos.authz.v1beta1.MsgGrant', MsgGrant],
  ])

  // Create offline signing client
  const client = await SigningStargateClient.offline(wallet, {
    registry,
    gasPrice: GasPrice.fromString(AXIOME_GAS_PRICE),
  })

  // Get account info for signing
  const { accountNumber, sequence } = await getAccountInfo(userAddress)

  // Sign the transaction
  const fee = { amount: [{ denom: 'uaxm', amount: '10000' }], gas: '200000' }
  const signedTx = await client.sign(
    userAddress,
    [grantMsg],
    fee,
    '',
    { accountNumber, sequence, chainId: 'axiome-1' },
  )

  // Broadcast
  const txBytes = TxRaw.encode(signedTx).finish()
  const result = await broadcastTxSync(txBytes)

  if (result.code !== 0) {
    throw new Error(`Authz grant failed (code ${result.code})`)
  }

  return result.txHash
}
