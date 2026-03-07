import { z } from 'zod'

// ── Auth ─────────────────────────────────────────────────────────────

export const LoginSchema = z.object({
  address: z.string().regex(/^axm[a-z0-9]{39}$/, 'Invalid Axiome address'),
  signature: z.string(),
  pubkey: z.string(),
})

// ── Game ─────────────────────────────────────────────────────────────

export const CreateGameSchema = z.object({
  wager: z.string().regex(/^\d+$/, 'Wager must be a numeric string'),
  timePerMove: z.number().int().min(15).max(600).default(60), // seconds
})

export const JoinGameSchema = z.object({
  gameId: z.string().uuid(),
})

export const MakeMoveSchema = z.object({
  gameId: z.string().uuid(),
  from: z.object({ row: z.number().int().min(0).max(7), col: z.number().int().min(0).max(7) }),
  to: z.object({ row: z.number().int().min(0).max(7), col: z.number().int().min(0).max(7) }),
})

export const GameListSchema = z.object({
  status: z.enum(['waiting', 'playing', 'finished']).optional(),
  limit: z.number().int().min(1).max(50).default(20),
  offset: z.number().int().min(0).default(0),
})

// ── WS Messages ──────────────────────────────────────────────────────

export const WsMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('join_game'), gameId: z.string() }),
  z.object({ type: z.literal('leave_game'), gameId: z.string() }),
  z.object({
    type: z.literal('move'),
    gameId: z.string(),
    from: z.object({ row: z.number(), col: z.number() }),
    to: z.object({ row: z.number(), col: z.number() }),
  }),
  z.object({ type: z.literal('ping') }),
])

export type WsMessage = z.infer<typeof WsMessageSchema>

// ── Types ────────────────────────────────────────────────────────────

export type CreateGameInput = z.infer<typeof CreateGameSchema>
export type JoinGameInput = z.infer<typeof JoinGameSchema>
export type MakeMoveInput = z.infer<typeof MakeMoveSchema>
export type GameListInput = z.infer<typeof GameListSchema>
