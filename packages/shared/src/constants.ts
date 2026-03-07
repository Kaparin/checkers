export const CHAIN_ID = 'axiome-1'
export const GAS_PRICE = '0.025uaxm'
export const COIN_DECIMALS = 6

// Wager limits (in micro COIN)
export const MIN_WAGER = '1000000'     // 1 COIN
export const MAX_WAGER = '100000000'   // 100 COIN

// Time limits
export const DEFAULT_TIME_PER_MOVE = 60   // seconds
export const MAX_TIME_PER_MOVE = 600      // 10 minutes
export const GAME_IDLE_TIMEOUT = 300      // 5 minutes with no moves → forfeit

// Commission
export const COMMISSION_BPS = 1000  // 10%

// WS event types
export const WS_EVENTS = {
  GAME_CREATED: 'game:created',
  GAME_JOINED: 'game:joined',
  GAME_MOVE: 'game:move',
  GAME_OVER: 'game:over',
  GAME_TIMEOUT: 'game:timeout',
  GAME_CANCELED: 'game:canceled',
  PLAYER_CONNECTED: 'player:connected',
  PLAYER_DISCONNECTED: 'player:disconnected',
  ERROR: 'error',
} as const

export type WsEventType = typeof WS_EVENTS[keyof typeof WS_EVENTS]
