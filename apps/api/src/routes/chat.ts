import { Hono } from 'hono'
import { gameMessages, globalChatMessages, games } from '@checkers/db'
import type { Db } from '@checkers/db'
import { eq, desc, sql } from 'drizzle-orm'
import { requireAuth } from '../middleware/auth'
import { broadcastToGame, broadcastToLobby } from '../ws/handler'

export const chatRoutes = new Hono()

const MAX_MSG_LENGTH = 200
const RATE_LIMIT_MS = 1000 // 1 msg per second
const lastSent = new Map<string, number>()

function isRateLimited(address: string): boolean {
  const now = Date.now()
  const last = lastSent.get(address) || 0
  if (now - last < RATE_LIMIT_MS) return true
  lastSent.set(address, now)
  return false
}

// Send game chat message
chatRoutes.post('/game/:gameId', requireAuth, async (c) => {
  const db = c.get('db' as never) as Db
  const address = c.get('address' as never) as string
  const gameId = c.req.param('gameId') as string
  const body = await c.req.json<{ message: string }>()

  if (!body.message?.trim()) return c.json({ error: 'Message required' }, 400)
  if (body.message.length > MAX_MSG_LENGTH) return c.json({ error: 'Message too long' }, 400)
  if (isRateLimited(address)) return c.json({ error: 'Too fast' }, 429)

  const [msg] = await db.insert(gameMessages).values({
    gameId,
    senderAddress: address,
    message: body.message.trim(),
  }).returning()

  // Determine if sender is a spectator
  const [game] = await db.select({ blackPlayer: games.blackPlayer, whitePlayer: games.whitePlayer })
    .from(games).where(eq(games.id, gameId)).limit(1)
  const isSpectator = game ? (address !== game.blackPlayer && address !== game.whitePlayer) : false

  broadcastToGame(gameId, {
    type: 'chat:message',
    message: { id: msg.id, sender: address, text: msg.message, createdAt: msg.createdAt, isSpectator },
  })

  return c.json({ message: { ...msg, isSpectator } })
})

// Get game chat history
chatRoutes.get('/game/:gameId', async (c) => {
  const db = c.get('db' as never) as Db
  const gameId = c.req.param('gameId') as string

  const [game] = await db.select({ blackPlayer: games.blackPlayer, whitePlayer: games.whitePlayer })
    .from(games).where(eq(games.id, gameId)).limit(1)

  const messages = await db
    .select()
    .from(gameMessages)
    .where(eq(gameMessages.gameId, gameId))
    .orderBy(desc(gameMessages.createdAt))
    .limit(50)

  return c.json({
    messages: messages.reverse(),
    players: game ? { black: game.blackPlayer, white: game.whitePlayer } : null,
  })
})

// Send global chat message
chatRoutes.post('/global', requireAuth, async (c) => {
  const db = c.get('db' as never) as Db
  const address = c.get('address' as never) as string
  const body = await c.req.json<{ message: string }>()

  if (!body.message?.trim()) return c.json({ error: 'Message required' }, 400)
  if (body.message.length > MAX_MSG_LENGTH) return c.json({ error: 'Message too long' }, 400)
  if (isRateLimited(address)) return c.json({ error: 'Too fast' }, 429)

  const [msg] = await db.insert(globalChatMessages).values({
    senderAddress: address,
    message: body.message.trim(),
  }).returning()

  broadcastToLobby({
    type: 'chat:global',
    message: { id: msg.id, sender: address, text: msg.message, createdAt: msg.createdAt },
  })

  return c.json({ message: msg })
})

// Get global chat history
chatRoutes.get('/global', async (c) => {
  const db = c.get('db' as never) as Db

  const messages = await db
    .select()
    .from(globalChatMessages)
    .orderBy(desc(globalChatMessages.createdAt))
    .limit(50)

  return c.json({ messages: messages.reverse() })
})
