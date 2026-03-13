import { getAuthHeaders, getStoredAddress, clearStoredToken, clearStoredAddress } from './auth-headers'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export { getStoredAddress }

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...getAuthHeaders(),
    ...((options?.headers as Record<string, string>) || {}),
  }
  if (options?.body && typeof options.body === 'string') {
    headers['Content-Type'] = 'application/json'
  }

  // 15s timeout for all API requests
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include',
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout))

  if (!res.ok) {
    // Clear stale auth on 401
    if (res.status === 401) {
      clearStoredToken()
      clearStoredAddress()
    }
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(body.error || `HTTP ${res.status}`)
  }

  return res.json()
}

// ── Auth ─────────────────────────────────────────────────────────────

export async function getChallenge(address: string) {
  return request<{ nonce: string }>(`/auth/challenge?address=${encodeURIComponent(address)}`)
}

export async function verifyAuth(address: string, signature: string, pubkey: string) {
  return request<{ token: string; address: string; expiresAt: string }>('/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ address, signature, pubkey }),
  })
}

export async function getMe() {
  return request<{ user: Record<string, unknown> }>('/auth/me')
}

export async function logout() {
  return request<{ success: boolean }>('/auth/logout', { method: 'POST' })
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

export async function confirmReady(gameId: string) {
  return request<{ success: boolean; blackReady: boolean; whiteReady: boolean }>(`/games/${gameId}/ready`, { method: 'POST' })
}

export async function offerRematch(gameId: string) {
  return request<{ success: boolean }>(`/games/${gameId}/rematch-offer`, { method: 'POST' })
}

export async function acceptRematch(gameId: string) {
  return request<{ game: GameFull }>(`/games/${gameId}/rematch-accept`, { method: 'POST' })
}

export async function declineRematch(gameId: string) {
  return request<{ success: boolean }>(`/games/${gameId}/rematch-decline`, { method: 'POST' })
}

export async function getRelayStatus(gameId: string) {
  return request<{
    relayerActive: boolean
    isOnChain: boolean
    hasWager: boolean
    txHashCreate: string | null
    txHashJoin: string | null
    txHashResolve: string | null
    onChainGameId: number | null
  }>(`/games/${gameId}/relay-status`)
}

// ── Referrals ───────────────────────────────────────────────────────

export async function getReferralCode() {
  return request<{ code: string }>('/referrals/code')
}

export async function applyReferralCode(code: string) {
  return request<{ success: boolean }>('/referrals/apply', {
    method: 'POST',
    body: JSON.stringify({ code }),
  })
}

export async function getReferralStats() {
  return request<ReferralStats>('/referrals/stats')
}

export interface ReferralStats {
  code: string | null
  totalEarned: string
  totalClaimed: string
  referralCount: number
  recentRewards: {
    id: string
    referrerAddress: string
    fromPlayerAddress: string
    level: number
    amount: string
    gameId: string
    createdAt: string
  }[]
}

// ── Jackpot ─────────────────────────────────────────────────────────

export async function getJackpotPools() {
  return request<{ pools: JackpotPool[] }>('/jackpot/pools')
}

export async function getJackpotWinners() {
  return request<{ winners: JackpotWinner[] }>('/jackpot/winners')
}

export interface JackpotPool {
  tier: string
  name: string
  targetAmount: string
  currentAmount: string
  cycle: number
  contributionBps: number
}

export interface JackpotWinner {
  id: string
  tier: string
  cycle: number
  winnerAddress: string | null
  winAmount: string | null
  drawnAt: string | null
}

// ── Shop ────────────────────────────────────────────────────────────

export async function getShopItems() {
  return request<{ items: ShopItem[] }>('/shop/items')
}

export async function purchaseItem(itemType: string) {
  return request<{ reward: string }>('/shop/purchase', {
    method: 'POST',
    body: JSON.stringify({ itemType }),
  })
}

export interface ShopItem {
  id: string
  name: string
  price: string
  reward: string
}

// ── VIP ─────────────────────────────────────────────────────────────

export async function getVipTiers() {
  return request<{ tiers: VipTier[] }>('/vip/tiers')
}

export async function getVipInfo() {
  return request<VipInfo>('/vip/me')
}

export interface VipTier {
  tier: string
  name: string
  priceMonthly: string
  priceYearly: string
  checkerMonthly: string
  enabled: boolean
}

export interface VipInfo {
  subscription: { tier: string; expiresAt: string } | null
  customization: Record<string, string | null> | null
  tiers: VipTier[]
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
  blackReady: boolean
  whiteReady: boolean
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
