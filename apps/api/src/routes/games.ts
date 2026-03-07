import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { CreateGameSchema, MakeMoveSchema, GameListSchema } from '@checkers/shared'
import { createInitialGameState, isValidMove, applyMove, serializeGameState, deserializeGameState, calculateElo, calculateEloDraw } from '@checkers/shared'
import { games, gameMoves, users } from '@checkers/db'
import type { Db } from '@checkers/db'
import { eq, desc, sql, inArray } from 'drizzle-orm'
import { authMiddleware } from '../middleware/auth'
import { broadcastToGame, broadcastToLobby } from '../ws/handler'
import { WS_EVENTS } from '@checkers/shared'
import type { GameState, GameVariant } from '@checkers/shared'

export const gameRoutes = new Hono()

// List games (public)
gameRoutes.get('/', zValidator('query', GameListSchema), async (c) => {
  const { status, limit, offset } = c.req.valid('query')
  const db = c.get('db' as never) as Db

  let statusFilter
  if (status === 'waiting') {
    statusFilter = eq(games.status, 'waiting')
  } else if (status === 'playing') {
    statusFilter = eq(games.status, 'playing')
  } else if (status === 'finished') {
    statusFilter = inArray(games.status, ['black_wins', 'white_wins', 'draw', 'timeout'])
  }

  const rows = await db
    .select({
      id: games.id,
      blackPlayer: games.blackPlayer,
      whitePlayer: games.whitePlayer,
      winner: games.winner,
      status: games.status,
      variant: games.variant,
      wager: games.wager,
      moveCount: games.moveCount,
      timePerMove: games.timePerMove,
      createdAt: games.createdAt,
      startedAt: games.startedAt,
      finishedAt: games.finishedAt,
    })
    .from(games)
    .where(statusFilter)
    .orderBy(desc(games.createdAt))
    .limit(limit)
    .offset(offset)

  return c.json({ games: rows })
})

// Get single game
gameRoutes.get('/:id', async (c) => {
  const db = c.get('db' as never) as Db
  const id = c.req.param('id') as string

  const [game] = await db.select().from(games).where(eq(games.id, id)).limit(1)
  if (!game) return c.json({ error: 'Game not found' }, 404)

  return c.json({ game })
})

// Create game (auth required)
gameRoutes.post('/', authMiddleware, zValidator('json', CreateGameSchema), async (c) => {
  const { wager, timePerMove, variant } = c.req.valid('json')
  const address = c.get('address' as never) as string
  const db = c.get('db' as never) as Db

  const initialState = createInitialGameState(variant as GameVariant)
  initialState.status = 'waiting'

  const [game] = await db.insert(games).values({
    blackPlayer: address,
    wager,
    timePerMove,
    variant,
    gameState: serializeGameState(initialState),
    status: 'waiting',
  }).returning()

  broadcastToLobby({ type: WS_EVENTS.GAME_CREATED, game: { id: game.id, wager, variant, blackPlayer: address, timePerMove } })

  return c.json({ game }, 201)
})

// Join game (auth required)
gameRoutes.post('/:id/join', authMiddleware, async (c) => {
  const address = c.get('address' as never) as string
  const db = c.get('db' as never) as Db
  const gameId = c.req.param('id') as string

  const [game] = await db.select().from(games).where(eq(games.id, gameId)).limit(1)
  if (!game) return c.json({ error: 'Game not found' }, 404)
  if (game.status !== 'waiting') return c.json({ error: 'Game already started' }, 400)
  if (game.blackPlayer === address) return c.json({ error: 'Cannot join your own game' }, 400)

  const now = new Date()
  const deadline = new Date(now.getTime() + game.timePerMove * 1000)

  const state = JSON.parse(game.gameState as string)
  state.s = 'playing'
  state.t = 'black'

  const [updated] = await db.update(games).set({
    whitePlayer: address,
    status: 'playing',
    gameState: JSON.stringify(state),
    startedAt: now,
    currentTurnDeadline: deadline,
  }).where(eq(games.id, gameId)).returning()

  broadcastToGame(gameId, { type: WS_EVENTS.GAME_JOINED, game: updated })
  broadcastToLobby({ type: WS_EVENTS.GAME_JOINED, gameId })

  return c.json({ game: updated })
})

// Make a move (auth required)
gameRoutes.post('/:id/move', authMiddleware, zValidator('json', MakeMoveSchema), async (c) => {
  const { from, to } = c.req.valid('json')
  const address = c.get('address' as never) as string
  const db = c.get('db' as never) as Db
  const gameId = c.req.param('id') as string

  const [game] = await db.select().from(games).where(eq(games.id, gameId)).limit(1)
  if (!game) return c.json({ error: 'Game not found' }, 404)
  if (game.status !== 'playing') return c.json({ error: 'Game is not in progress' }, 400)

  // Parse game state
  const stateRaw = game.gameState as string
  const parsed = JSON.parse(stateRaw)
  const state: GameState = parsed.b && typeof parsed.b === 'string'
    ? deserializeGameState(stateRaw)
    : parsed as GameState

  const currentPlayer = state.currentTurn === 'black' ? game.blackPlayer : game.whitePlayer
  if (currentPlayer !== address) return c.json({ error: 'Not your turn' }, 403)

  // Validate move
  const validMove = isValidMove(state, from, to)
  if (!validMove) return c.json({ error: 'Invalid move' }, 400)

  // Apply move
  const newState = applyMove(state, validMove)
  const deadline = new Date(Date.now() + game.timePerMove * 1000)

  // Save move record
  await db.insert(gameMoves).values({
    gameId,
    moveNumber: newState.moveCount,
    player: address,
    fromRow: from.row,
    fromCol: from.col,
    toRow: to.row,
    toCol: to.col,
    captures: validMove.captures.map(cap => [cap.row, cap.col] as [number, number]),
    promotion: validMove.promotion ? 1 : 0,
  })

  // Determine game status
  const isFinished = newState.status !== 'playing'
  const winner = newState.status === 'black_wins' ? game.blackPlayer
    : newState.status === 'white_wins' ? game.whitePlayer
    : null

  const [updated] = await db.update(games).set({
    gameState: serializeGameState(newState),
    moveCount: newState.moveCount,
    status: isFinished ? newState.status : 'playing',
    currentTurnDeadline: isFinished ? null : deadline,
    winner,
    finishedAt: isFinished ? new Date() : null,
  }).where(eq(games.id, gameId)).returning()

  // Update user stats + ELO if game is over
  if (isFinished && winner) {
    const loser = winner === game.blackPlayer ? game.whitePlayer : game.blackPlayer

    // Fetch current ratings for ELO calculation
    const [winnerUser] = await db.select().from(users).where(eq(users.address, winner)).limit(1)
    const loserUser = loser ? (await db.select().from(users).where(eq(users.address, loser)).limit(1))[0] : null

    let eloChange = { changeWinner: 0, changeLoser: 0, newRatingWinner: 1200, newRatingLoser: 1200 }
    if (winnerUser && loserUser) {
      eloChange = calculateElo(
        winnerUser.elo, loserUser.elo,
        winnerUser.gamesPlayed, loserUser.gamesPlayed,
      )
    }

    await db.update(users).set({
      gamesPlayed: sql`games_played + 1`,
      gamesWon: sql`games_won + 1`,
      totalWon: sql`(total_won::bigint + ${game.wager}::bigint)::text`,
      elo: eloChange.newRatingWinner,
    }).where(eq(users.address, winner))

    if (loser) {
      await db.update(users).set({
        gamesPlayed: sql`games_played + 1`,
        gamesLost: sql`games_lost + 1`,
        totalWagered: sql`(total_wagered::bigint + ${game.wager}::bigint)::text`,
        elo: eloChange.newRatingLoser,
      }).where(eq(users.address, loser))
    }
  }

  // Broadcast
  broadcastToGame(gameId, {
    type: isFinished ? WS_EVENTS.GAME_OVER : WS_EVENTS.GAME_MOVE,
    move: { from, to, captures: validMove.captures, promotion: validMove.promotion },
    gameState: newState,
    winner,
  })

  return c.json({ game: updated, move: validMove, gameState: newState })
})

// Cancel game (auth required, only before opponent joins)
gameRoutes.post('/:id/cancel', authMiddleware, async (c) => {
  const address = c.get('address' as never) as string
  const db = c.get('db' as never) as Db
  const gameId = c.req.param('id') as string

  const [game] = await db.select().from(games).where(eq(games.id, gameId)).limit(1)
  if (!game) return c.json({ error: 'Game not found' }, 404)
  if (game.status !== 'waiting') return c.json({ error: 'Cannot cancel a started game' }, 400)
  if (game.blackPlayer !== address) return c.json({ error: 'Only creator can cancel' }, 403)

  const [updated] = await db.update(games).set({
    status: 'canceled',
    finishedAt: new Date(),
  }).where(eq(games.id, gameId)).returning()

  broadcastToLobby({ type: WS_EVENTS.GAME_CANCELED, gameId })

  return c.json({ game: updated })
})

// Resign (auth required, during active game)
gameRoutes.post('/:id/resign', authMiddleware, async (c) => {
  const address = c.get('address' as never) as string
  const db = c.get('db' as never) as Db
  const gameId = c.req.param('id') as string

  const [game] = await db.select().from(games).where(eq(games.id, gameId)).limit(1)
  if (!game) return c.json({ error: 'Game not found' }, 404)
  if (game.status !== 'playing') return c.json({ error: 'Game is not in progress' }, 400)
  if (game.blackPlayer !== address && game.whitePlayer !== address) {
    return c.json({ error: 'You are not in this game' }, 403)
  }

  const winner = address === game.blackPlayer ? game.whitePlayer : game.blackPlayer
  const winStatus = address === game.blackPlayer ? 'white_wins' : 'black_wins'

  const [updated] = await db.update(games).set({
    status: winStatus,
    winner,
    finishedAt: new Date(),
    currentTurnDeadline: null,
  }).where(eq(games.id, gameId)).returning()

  // ELO update
  if (winner) {
    const [winnerUser] = await db.select().from(users).where(eq(users.address, winner)).limit(1)
    const [loserUser] = await db.select().from(users).where(eq(users.address, address)).limit(1)
    if (winnerUser && loserUser) {
      const elo = calculateElo(winnerUser.elo, loserUser.elo, winnerUser.gamesPlayed, loserUser.gamesPlayed)
      await db.update(users).set({
        gamesPlayed: sql`games_played + 1`, gamesWon: sql`games_won + 1`,
        totalWon: sql`(total_won::bigint + ${game.wager}::bigint)::text`, elo: elo.newRatingWinner,
      }).where(eq(users.address, winner))
      await db.update(users).set({
        gamesPlayed: sql`games_played + 1`, gamesLost: sql`games_lost + 1`, elo: elo.newRatingLoser,
      }).where(eq(users.address, address))
    }
  }

  broadcastToGame(gameId, { type: WS_EVENTS.GAME_OVER, winner, reason: 'resign' })
  return c.json({ game: updated })
})

// Draw offer
gameRoutes.post('/:id/draw-offer', authMiddleware, async (c) => {
  const address = c.get('address' as never) as string
  const gameId = c.req.param('id') as string

  broadcastToGame(gameId, { type: 'draw:offer', from: address })
  return c.json({ success: true })
})

// Accept draw
gameRoutes.post('/:id/draw-accept', authMiddleware, async (c) => {
  const address = c.get('address' as never) as string
  const db = c.get('db' as never) as Db
  const gameId = c.req.param('id') as string

  const [game] = await db.select().from(games).where(eq(games.id, gameId)).limit(1)
  if (!game) return c.json({ error: 'Game not found' }, 404)
  if (game.status !== 'playing') return c.json({ error: 'Game is not in progress' }, 400)
  if (game.blackPlayer !== address && game.whitePlayer !== address) {
    return c.json({ error: 'You are not in this game' }, 403)
  }

  const [updated] = await db.update(games).set({
    status: 'draw',
    finishedAt: new Date(),
    currentTurnDeadline: null,
  }).where(eq(games.id, gameId)).returning()

  // ELO draw update
  if (game.blackPlayer && game.whitePlayer) {
    const [blackUser] = await db.select().from(users).where(eq(users.address, game.blackPlayer)).limit(1)
    const [whiteUser] = await db.select().from(users).where(eq(users.address, game.whitePlayer)).limit(1)
    if (blackUser && whiteUser) {
      const elo = calculateEloDraw(blackUser.elo, whiteUser.elo, blackUser.gamesPlayed, whiteUser.gamesPlayed)
      await db.update(users).set({
        gamesPlayed: sql`games_played + 1`, gamesDraw: sql`games_draw + 1`, elo: elo.newRatingA,
      }).where(eq(users.address, game.blackPlayer))
      await db.update(users).set({
        gamesPlayed: sql`games_played + 1`, gamesDraw: sql`games_draw + 1`, elo: elo.newRatingB,
      }).where(eq(users.address, game.whitePlayer))
    }
  }

  broadcastToGame(gameId, { type: WS_EVENTS.GAME_OVER, reason: 'draw' })
  return c.json({ game: updated })
})
