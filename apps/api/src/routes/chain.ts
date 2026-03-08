/**
 * Chain proxy routes — frontend queries chain state through API
 * to avoid CORS issues with direct RPC/REST access.
 */

import { Hono } from 'hono'
import { AXIOME_REST, AXIOME_DENOM } from '@checkers/shared/chain'
import { relayer } from '../services/relayer'

export const chainRoutes = new Hono()

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
