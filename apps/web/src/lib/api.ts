const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem('checkers_token')
}

export function setToken(token: string) {
  sessionStorage.setItem('checkers_token', token)
}

export function clearToken() {
  sessionStorage.removeItem('checkers_token')
}

export function getStoredAddress(): string | null {
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem('checkers_address')
}

export function setStoredAddress(address: string) {
  sessionStorage.setItem('checkers_address', address)
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    ...((options?.headers as Record<string, string>) || {}),
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  if (options?.body && typeof options.body === 'string') {
    headers['Content-Type'] = 'application/json'
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(body.error || `HTTP ${res.status}`)
  }

  return res.json()
}

// ── Auth ─────────────────────────────────────────────────────────────

export async function login(address: string, signature: string, pubkey: string) {
  const data = await request<{ token: string; address: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ address, signature, pubkey }),
  })
  setToken(data.token)
  setStoredAddress(data.address)
  return data
}

export async function getMe() {
  return request<{ user: Record<string, unknown> }>('/auth/me')
}

// ── Games ────────────────────────────────────────────────────────────

export async function listGames(status?: string, limit = 20, offset = 0) {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  params.set('limit', String(limit))
  params.set('offset', String(offset))
  return request<{ games: GameListItem[] }>(`/games?${params}`)
}

export async function getGame(id: string) {
  return request<{ game: GameFull }>(`/games/${id}`)
}

export async function createGame(wager: string, timePerMove = 60, variant: 'russian' | 'american' = 'russian') {
  return request<{ game: GameFull }>('/games', {
    method: 'POST',
    body: JSON.stringify({ wager, timePerMove, variant }),
  })
}

export async function joinGame(gameId: string) {
  return request<{ game: GameFull }>(`/games/${gameId}/join`, { method: 'POST' })
}

export async function makeMove(gameId: string, from: { row: number; col: number }, to: { row: number; col: number }) {
  return request<{ game: GameFull; move: unknown; gameState: unknown }>(`/games/${gameId}/move`, {
    method: 'POST',
    body: JSON.stringify({ from, to }),
  })
}

export async function cancelGame(gameId: string) {
  return request<{ game: GameFull }>(`/games/${gameId}/cancel`, { method: 'POST' })
}

export async function resignGame(gameId: string) {
  return request<{ game: GameFull }>(`/games/${gameId}/resign`, { method: 'POST' })
}

export async function offerDraw(gameId: string) {
  return request<{ success: boolean }>(`/games/${gameId}/draw-offer`, { method: 'POST' })
}

export async function acceptDraw(gameId: string) {
  return request<{ game: GameFull }>(`/games/${gameId}/draw-accept`, { method: 'POST' })
}

// ── Users ────────────────────────────────────────────────────────────

export async function getLeaderboard() {
  return request<{ users: UserProfile[] }>('/users')
}

export async function getUserProfile(address: string) {
  return request<{ user: UserProfile }>(`/users/${address}`)
}

// ── Types ────────────────────────────────────────────────────────────

export interface GameListItem {
  id: string
  blackPlayer: string | null
  whitePlayer: string | null
  winner: string | null
  status: string
  variant: 'russian' | 'american'
  wager: string
  moveCount: number
  timePerMove: number
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
}

export interface GameFull extends GameListItem {
  gameState: unknown
  variant: 'russian' | 'american'
  txHashCreate: string | null
  txHashJoin: string | null
  txHashResolve: string | null
  currentTurnDeadline: string | null
}

export interface UserProfile {
  address: string
  username: string | null
  gamesPlayed: number
  gamesWon: number
  gamesLost: number
  gamesDraw: number
  totalWagered: string
  totalWon: string
  elo: number
}
