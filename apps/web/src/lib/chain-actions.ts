/**
 * Chain Actions — client-side helpers for blockchain interactions.
 *
 * - Query AXM balance
 * - Check/grant authz to relayer
 * - Fund gas for authz grant
 *
 * All chain queries go through the API to avoid CORS issues.
 */

import { getAuthHeaders } from './auth-headers'

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

export function clearConfigCache() {
  cachedConfig = null
}

// ── Balance ─────────────────────────────────────────────────────────

export async function getBalance(address: string): Promise<string> {
  const res = await fetch(`${API_URL}/chain/balance/${address}`)
  if (!res.ok) return '0'
  const data = await res.json()
  return data.amount || '0'
}

// ── Authz ───────────────────────────────────────────────────────────

export async function checkAuthzGrant(granterAddress: string): Promise<boolean> {
  const res = await fetch(`${API_URL}/chain/authz/${granterAddress}`)
  if (!res.ok) return false
  const data = await res.json()
  return data.hasGrant === true
}

// ── Gas Faucet ──────────────────────────────────────────────────────

export async function requestGasFunding(): Promise<{ txHash: string }> {
  const headers = getAuthHeaders()
  const res = await fetch(`${API_URL}/chain/fund-gas`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    credentials: 'include',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Funding failed')
  }
  return res.json()
}

// ── Formatting ──────────────────────────────────────────────────────

export function formatAXM(microAmount: string | number): string {
  const n = typeof microAmount === 'string' ? Number(microAmount) : microAmount
  if (n === 0) return '0'
  if (n < 1_000_000) return (n / 1_000_000).toFixed(2)
  return (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 2)
}
