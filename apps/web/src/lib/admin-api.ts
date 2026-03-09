const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

let adminSecret = ''

export function setAdminSecret(secret: string) {
  adminSecret = secret
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('admin_secret', secret)
  }
}

export function getAdminSecret(): string {
  if (adminSecret) return adminSecret
  if (typeof window !== 'undefined') {
    adminSecret = sessionStorage.getItem('admin_secret') || ''
  }
  return adminSecret
}

async function adminRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const secret = getAdminSecret()
  if (!secret) throw new Error('Admin secret not set')

  const headers: Record<string, string> = {
    'x-admin-secret': secret,
    ...((options?.headers as Record<string, string>) || {}),
  }
  if (options?.body && typeof options.body === 'string') {
    headers['Content-Type'] = 'application/json'
  }

  const res = await fetch(`${API_URL}/admin${path}`, {
    ...options,
    headers,
  })

  if (res.status === 403) throw new Error('Invalid admin secret')
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(body.error || `HTTP ${res.status}`)
  }

  return res.json()
}

// ── Dashboard ───────────────────────────────────────────

export async function getDashboard() {
  return adminRequest<{
    users: number
    games: number
    volume: string
    totalCommission: string
    pendingSweep: string
    gamesByStatus: Record<string, number>
    recentGames: any[]
  }>('/dashboard')
}

// ── Users ───────────────────────────────────────────────

export async function getAdminUsers(params?: { limit?: number; offset?: number; search?: string }) {
  const qs = new URLSearchParams()
  if (params?.limit) qs.set('limit', String(params.limit))
  if (params?.offset) qs.set('offset', String(params.offset))
  if (params?.search) qs.set('search', params.search)
  return adminRequest<{ users: any[]; total: number }>(`/users?${qs}`)
}

export async function getAdminUser(address: string) {
  return adminRequest<{ user: any; vault: any; games: any[] }>(`/users/${address}`)
}

// ── Games ───────────────────────────────────────────────

export async function getAdminGames(params?: { limit?: number; offset?: number; status?: string }) {
  const qs = new URLSearchParams()
  if (params?.limit) qs.set('limit', String(params.limit))
  if (params?.offset) qs.set('offset', String(params.offset))
  if (params?.status) qs.set('status', params.status)
  return adminRequest<{ games: any[]; total: number }>(`/games?${qs}`)
}

export async function getStuckGames() {
  return adminRequest<{ games: any[]; count: number }>('/games/stuck')
}

export async function forceCancel(gameId: string) {
  return adminRequest<{ success: boolean }>(`/games/${gameId}/force-cancel`, { method: 'POST' })
}

// ── Config ──────────────────────────────────────────────

export async function getConfig() {
  return adminRequest<{ config: Record<string, { value: string; category: string; description: string | null }> }>('/config')
}

export async function updateConfig(key: string, value: string) {
  return adminRequest<{ success: boolean }>(`/config/${key}`, {
    method: 'PUT',
    body: JSON.stringify({ value }),
  })
}

// ── Treasury ────────────────────────────────────────────

export async function getTreasury() {
  return adminRequest<{ totalCommission: string; pendingSweep: string; ledger: any[] }>('/treasury')
}

// ── Diagnostics ─────────────────────────────────────────

export async function getDiagnostics() {
  return adminRequest<{
    gameDistribution: Record<string, number>
    stuckGames: number
    recentRelayerTxs: any[]
    failedRelayerTxs: number
  }>('/diagnostics')
}

// ── Actions ─────────────────────────────────────────────

export async function healSystem() {
  return adminRequest<{ results: string[]; healed: boolean }>('/actions/heal', { method: 'POST' })
}

// ── Transactions ────────────────────────────────────────

export async function getTransactions(params?: { limit?: number; offset?: number }) {
  const qs = new URLSearchParams()
  if (params?.limit) qs.set('limit', String(params.limit))
  if (params?.offset) qs.set('offset', String(params.offset))
  return adminRequest<{ transactions: any[]; total: number }>(`/transactions?${qs}`)
}
