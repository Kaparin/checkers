/**
 * Chain Actions — client-side helpers for blockchain interactions.
 *
 * - Query AXM balance
 * - Check/grant authz to relayer
 * - Sign and broadcast transactions via user's wallet
 *
 * All chain queries go through the API proxy to avoid CORS issues.
 */

import type { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// ── Config ──────────────────────────────────────────────────────────

export interface ChainConfig {
  relayerAddress: string | null
  contractAddress: string | null
  chainId: string
  denom: string
  relayerReady: boolean
}

let cachedConfig: ChainConfig | null = null

export async function getChainConfig(): Promise<ChainConfig> {
  if (cachedConfig) return cachedConfig
  const res = await fetch(`${API_URL}/config`)
  const data = await res.json()
  cachedConfig = data as ChainConfig
  return cachedConfig
}

// ── Balance ─────────────────────────────────────────────────────────

export async function getBalance(address: string): Promise<{ amount: string; denom: string }> {
  const res = await fetch(`${API_URL}/chain/balance/${address}`)
  if (!res.ok) return { amount: '0', denom: 'uaxm' }
  return res.json()
}

// ── Authz Check ─────────────────────────────────────────────────────

export async function checkAuthzGrant(granterAddress: string): Promise<boolean> {
  const config = await getChainConfig()
  if (!config.relayerAddress) return false

  const res = await fetch(`${API_URL}/chain/authz/${granterAddress}`)
  if (!res.ok) return false
  const data = await res.json()
  return data.hasGrant === true
}

/**
 * Format AXM amount for display.
 * 1_000_000 uaxm = 1 AXM
 */
export function formatAXM(microAmount: string | number): string {
  const n = typeof microAmount === 'string' ? Number(microAmount) : microAmount
  if (n === 0) return '0'
  if (n < 1_000_000) return (n / 1_000_000).toFixed(2)
  return (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 2)
}
