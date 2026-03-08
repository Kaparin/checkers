/**
 * Chain proxy routes — frontend queries chain state through API
 * to avoid CORS issues with direct RPC/REST access.
 *
 * Also includes a gas faucet for new users (one-time, small amount
 * for authz grant transaction gas).
 */

import { Hono } from 'hono'
import { AXIOME_REST, AXIOME_DENOM } from '@checkers/shared/chain'
import { relayer } from '../services/relayer'
import { requireAuth } from '../middleware/auth'

export const chainRoutes = new Hono()

// Track funded addresses to prevent abuse (in-memory, resets on restart)
const fundedAddresses = new Set<string>()

// Get balance for an address
chainRoutes.get('/balance/:address', async (c) => {
  const address = c.req.param('address')
  try {
    const res = await fetch(`${AXIOME_REST}/cosmos/bank/v1beta1/balances/${address}`)
    if (!res.ok) return c.json({ amount: '0', denom: AXIOME_DENOM })

    const data = await res.json() as any
    const coin = (data.balances || []).find((b: any) => b.denom === AXIOME_DENOM)
    return c.json({ amount: coin?.amount || '0', denom: AXIOME_DENOM })
  } catch {
    return c.json({ amount: '0', denom: AXIOME_DENOM })
  }
})

// Check if user has granted authz to relayer
chainRoutes.get('/authz/:address', async (c) => {
  const granter = c.req.param('address')
  const grantee = relayer.getAddress()
  if (!grantee) return c.json({ hasGrant: false })

  try {
    const res = await fetch(
      `${AXIOME_REST}/cosmos/authz/v1beta1/grants?granter=${granter}&grantee=${grantee}`
    )
    if (!res.ok) return c.json({ hasGrant: false })

    const data = await res.json() as any
    const grants = data.grants || []

    // Check for ContractExecutionAuthorization or generic MsgExecuteContract
    const hasGrant = grants.some((g: any) => {
      const auth = g.authorization
      if (!auth) return false
      return (
        auth['@type'] === '/cosmwasm.wasm.v1.ContractExecutionAuthorization' ||
        (auth['@type'] === '/cosmos.authz.v1beta1.GenericAuthorization' &&
          auth.msg === '/cosmwasm.wasm.v1.MsgExecuteContract')
      )
    })

    return c.json({ hasGrant, grantCount: grants.length })
  } catch {
    return c.json({ hasGrant: false })
  }
})

// Gas faucet — send small AXM amount to authenticated user for authz grant gas.
// One-time per address. Relayer sends from its own balance.
chainRoutes.post('/fund-gas', requireAuth, async (c) => {
  const address = c.get('address' as never) as string

  if (fundedAddresses.has(address)) {
    return c.json({ error: 'Already funded' }, 400)
  }

  if (!relayer.isReady) {
    return c.json({ error: 'Relayer not ready' }, 503)
  }

  try {
    // Send 0.1 AXM (100000 uaxm) — enough for ~4 authz grant txs
    const txHash = await relayer.sendGas(address, '100000')
    fundedAddresses.add(address)
    console.log(`[faucet] Sent 0.1 AXM to ${address.slice(0, 12)}... tx=${txHash.slice(0, 12)}...`)
    return c.json({ txHash, amount: '100000', denom: 'uaxm' })
  } catch (err: any) {
    console.error(`[faucet] Failed for ${address.slice(0, 12)}...:`, err?.message || err)
    return c.json({ error: 'Funding failed' }, 500)
  }
})
