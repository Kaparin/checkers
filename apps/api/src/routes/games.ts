import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { CreateGameSchema, MakeMoveSchema, GameListSchema } from '@checkers/shared'
import { createInitialGameState, isValidMove, applyMove, serializeGameState, deserializeGameState, calculateElo, calculateEloDraw } from '@checkers/shared'
import { games, gameMoves, users, txEvents, treasuryLedger, stakingLedger } from '@checkers/db'
import type { Db } from '@checkers/db'
import { eq, desc, sql, inArray, or, and } from 'drizzle-orm'
import { requireAuth } from '../middleware/auth'
import { broadcastToGame, broadcastToLobby } from '../ws/handler'
import { WS_EVENTS } from '@checkers/shared'
import { AXIOME_DENOM, AXIOME_REST } from '@checkers/shared/chain'
import { relayer } from '../services/relayer'
import { ReferralService } from '../services/referral.service'
import { JackpotService } from '../services/jackpot.service'
import type { GameState, GameVariant } from '@checkers/shared'

/** Log a user action to tx_events (non-blocking) */
function logEvent(db: Db, action: string, address?: string, gameId?: string, details?: string) {
  db.insert(txEvents).values({
    action: action as any,
    address,
    gameId,
    details,
  }).catch(err => console.error('[logEvent]', err?.message))
}

/** Record commission from a resolved game + distribute referral rewards */
function recordCommission(db: Db, wager: string, gameId: string, winnerAddress?: string, txHash?: string) {
  const commission = String(Math.floor(Number(wager) * 2 * 0.1)) // 10% of total pot
  if (Number(commission) > 0) {
    db.insert(treasuryLedger).values({
      source: 'game_commission',
      amount: commission,
      gameId,
      txHash,
    }).catch(err => console.error(`[commission] Game ${gameId}:`, err?.message))

    // 2% of commission → LAUNCH staking ledger
    const stakingAmount = String(Math.floor(Number(commission) * 0.02))
    if (Number(stakingAmount) > 0) {
      db.insert(stakingLedger).values({ gameId, amount: stakingAmount }).catch(err => console.error(`[staking] Game ${gameId}:`, err?.message))
    }

    // Distribute referral rewards from commission (non-blocking)
    if (winnerAddress) {
      const referralService = new ReferralService(db)
      referralService.distributeRewards(winnerAddress, commission, gameId).catch(err => console.error(`[referral] Game ${gameId}:`, err?.message))

      // Contribute to jackpot pools (non-blocking)
      const jackpotService = new JackpotService(db)
      jackpotService.contribute(gameId, winnerAddress, commission).catch(err => console.error(`[jackpot] Game ${gameId}:`, err?.message))
    }
  }
}

/** Safely parse gameState from DB — handles both string and object (jsonb) */
function parseRawGameState(raw: unknown): Record<string, unknown> {
  if (typeof raw === 'string') return JSON.parse(raw)
  if (typeof raw === 'object' && raw !== null) return raw as Record<string, unknown>
  throw new Error('Invalid gameState format')
}

export const gameRoutes = new Hono()

/**
 * Fire relayer call in background — never blocks the API response.
 * Errors are logged but don't affect the game flow.
 */
function fireAndForget(label: string, fn: () => Promise<unknown>) {
  fn().catch(err => {
    console.error(`[relay:${label}] Failed:`, err?.message || err)
  })
}

// List games (public)
gameRoutes.get('/', zValidator('query', GameListSchema), async (c) => {
  const { status, player, limit, offset } = c.req.valid('query')
  const db = c.get('db' as never) as Db

  const conditions = []

  if (status === 'waiting') {
    conditions.push(eq(games.status, 'waiting'))
  } else if (status === 'playing') {
    conditions.push(inArray(games.status, ['playing', 'ready_check']))
  } else if (status === 'finished') {
    conditions.push(inArray(games.status, ['black_wins', 'white_wins', 'draw', 'timeout']))
  }

  if (player) {
    conditions.push(or(eq(games.blackPlayer, player), eq(games.whitePlayer, player)))
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
    .where(conditions.length > 0 ? and(...conditions) : undefined)
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
gameRoutes.post('/', requireAuth, zValidator('json', CreateGameSchema), async (c) => {
  const { wager, timePerMove, variant } = c.req.valid('json')
  const address = c.get('address' as never) as string
  const db = c.get('db' as never) as Db

  // Server-side balance check
  if (wager !== '0') {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)
      const balRes = await fetch(`${AXIOME_REST}/cosmos/bank/v1beta1/balances/${address}`, { signal: controller.signal }).finally(() => clearTimeout(timeout))
      if (balRes.ok) {
        const balData = await balRes.json() as { balances: { denom: string; amount: string }[] }
        const axmBal = balData.balances?.find((b: { denom: string }) => b.denom === AXIOME_DENOM)
        if (axmBal && BigInt(axmBal.amount) < BigInt(wager)) {
          return c.json({ error: 'Insufficient balance' }, 400)
        }
      }
    } catch {
      // Chain unavailable — skip balance check
    }
  }

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
  logEvent(db, 'create_game', address, game.id, `wager=${wager} variant=${variant}`)

  // Background: lock wager on-chain
  if (relayer.isReady && wager !== '0') {
    fireAndForget(`create:${game.id}`, async () => {
      const { txHash, onChainGameId } = await relayer.relayCreateGame(
        address, variant, timePerMove, wager, AXIOME_DENOM,
      )
      console.log(`[relay:create] Game ${game.id} → on-chain #${onChainGameId} tx=${txHash.slice(0, 12)}...`)
      await db.update(games).set({
        onChainGameId,
        txHashCreate: txHash,
      }).where(eq(games.id, game.id))
    })
  }

  return c.json({ game }, 201)
})

// Join game (auth required)
gameRoutes.post('/:id/join', requireAuth, async (c) => {
  const address = c.get('address' as never) as string
  const db = c.get('db' as never) as Db
  const gameId = c.req.param('id') as string

  const [game] = await db.select().from(games).where(eq(games.id, gameId)).limit(1)
  if (!game) return c.json({ error: 'Game not found' }, 404)
  if (game.status !== 'waiting') return c.json({ error: 'Game already started' }, 400)
  if (game.blackPlayer === address) return c.json({ error: 'Cannot join your own game' }, 400)

  // Random side assignment
  const swap = Math.random() < 0.5
  const blackAddr = swap ? address : game.blackPlayer
  const whiteAddr = swap ? game.blackPlayer : address

  const state = parseRawGameState(game.gameState)
  state.s = 'ready_check'
  state.t = 'black'

  const [updated] = await db.update(games).set({
    blackPlayer: blackAddr,
    whitePlayer: whiteAddr,
    status: 'ready_check',
    gameState: JSON.stringify(state),
    blackReady: false,
    whiteReady: false,
  }).where(eq(games.id, gameId)).returning()

  broadcastToGame(gameId, { type: WS_EVENTS.GAME_JOINED, game: updated })
  broadcastToLobby({ type: WS_EVENTS.GAME_JOINED, gameId })
  logEvent(db, 'join_game', address, gameId)

  return c.json({ game: updated })
})

// Ready check (auth required)
gameRoutes.post('/:id/ready', requireAuth, async (c) => {
  const address = c.get('address' as never) as string
  const db = c.get('db' as never) as Db
  const gameId = c.req.param('id') as string

  const [game] = await db.select().from(games).where(eq(games.id, gameId)).limit(1)
  if (!game) return c.json({ error: 'Game not found' }, 404)
  if (game.status !== 'ready_check') return c.json({ error: 'Game is not in ready check' }, 400)

  const isBlack = game.blackPlayer === address
  const isWhite = game.whitePlayer === address
  if (!isBlack && !isWhite) return c.json({ error: 'You are not in this game' }, 403)

  // Update ready flag
  const updateField = isBlack ? { blackReady: true } : { whiteReady: true }
  await db.update(games).set(updateField).where(eq(games.id, gameId))

  // Re-read to check if both ready (race condition safety)
  const [fresh] = await db.select().from(games).where(eq(games.id, gameId)).limit(1)

  broadcastToGame(gameId, {
    type: WS_EVENTS.GAME_READY,
    player: address,
    blackReady: fresh.blackReady,
    whiteReady: fresh.whiteReady,
  })

  if (fresh.blackReady && fresh.whiteReady) {
    const now = new Date()
    const deadline = new Date(now.getTime() + game.timePerMove * 1000)

    const state = parseRawGameState(fresh.gameState)
    state.s = 'playing'

    const [started] = await db.update(games).set({
      status: 'playing',
      gameState: JSON.stringify(state),
      startedAt: now,
      currentTurnDeadline: deadline,
    }).where(eq(games.id, gameId)).returning()

    broadcastToGame(gameId, {
      type: WS_EVENTS.GAME_BOTH_READY,
      game: started,
    })

    logEvent(db, 'game_started', undefined, gameId)

    // Background: lock wagers on-chain
    if (relayer.isReady && game.onChainGameId && game.wager !== '0' && game.whitePlayer) {
      fireAndForget(`join:${gameId}`, async () => {
        const txHash = await relayer.relayJoinGame(
          game.whitePlayer!, game.onChainGameId!, game.wager, AXIOME_DENOM,
        )
        console.log(`[relay:join] Game ${gameId} on-chain #${game.onChainGameId} tx=${txHash.slice(0, 12)}...`)
        await db.update(games).set({ txHashJoin: txHash }).where(eq(games.id, gameId))
      })
    }
  }

  return c.json({ success: true, blackReady: fresh.blackReady, whiteReady: fresh.whiteReady })
})

// Make a move (auth required)
gameRoutes.post('/:id/move', requireAuth, zValidator('json', MakeMoveSchema), async (c) => {
  const { from, to } = c.req.valid('json')
  const address = c.get('address' as never) as string
  const db = c.get('db' as never) as Db
  const gameId = c.req.param('id') as string

  const [game] = await db.select().from(games).where(eq(games.id, gameId)).limit(1)
  if (!game) return c.json({ error: 'Game not found' }, 404)
  if (game.status !== 'playing') return c.json({ error: 'Game is not in progress' }, 400)

  // Parse game state
  let state: GameState
  try {
    const parsed = parseRawGameState(game.gameState)
    const stateStr = typeof game.gameState === 'string' ? game.gameState : JSON.stringify(game.gameState)
    state = parsed.b && typeof parsed.b === 'string'
      ? deserializeGameState(stateStr)
      : parsed as unknown as GameState
  } catch (err) {
    console.error(`[move] Failed to parse gameState for ${gameId}:`, err)
    return c.json({ error: 'Corrupted game state' }, 500)
  }

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

    // Record commission (10% of total pot) + referral rewards
    recordCommission(db, game.wager, gameId, winner)

    // Background: resolve on-chain (distribute winnings)
    if (relayer.isReady && game.onChainGameId && game.wager !== '0') {
      fireAndForget(`resolve:${gameId}`, async () => {
        const txHash = await relayer.relayResolveGame(game.onChainGameId!, winner)
        console.log(`[relay:resolve] Game ${gameId} winner=${winner.slice(0, 12)}... tx=${txHash.slice(0, 12)}...`)
        await db.update(games).set({ txHashResolve: txHash }).where(eq(games.id, gameId))
      })
    }
  }

  // Handle draw (no pieces left scenario — rare but possible)
  if (isFinished && !winner && newState.status === 'draw') {
    if (relayer.isReady && game.onChainGameId && game.wager !== '0') {
      fireAndForget(`draw:${gameId}`, async () => {
        const txHash = await relayer.relayResolveDraw(game.onChainGameId!)
        console.log(`[relay:draw] Game ${gameId} tx=${txHash.slice(0, 12)}...`)
        await db.update(games).set({ txHashResolve: txHash }).where(eq(games.id, gameId))
      })
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
gameRoutes.post('/:id/cancel', requireAuth, async (c) => {
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
  logEvent(db, 'cancel_game', address, gameId)

  // Background: refund wager on-chain
  if (relayer.isReady && game.onChainGameId) {
    fireAndForget(`cancel:${gameId}`, async () => {
      const txHash = await relayer.relayCancelGame(address, game.onChainGameId!)
      console.log(`[relay:cancel] Game ${gameId} tx=${txHash.slice(0, 12)}...`)
    })
  }

  return c.json({ game: updated })
})

// Resign (auth required, during active game)
gameRoutes.post('/:id/resign', requireAuth, async (c) => {
  const address = c.get('address' as never) as string
  const db = c.get('db' as never) as Db
  const gameId = c.req.param('id') as string

  const [game] = await db.select().from(games).where(eq(games.id, gameId)).limit(1)
  if (!game) return c.json({ error: 'Game not found' }, 404)
  if (game.status !== 'playing' && game.status !== 'ready_check') return c.json({ error: 'Game is not in progress' }, 400)
  if (game.blackPlayer !== address && game.whitePlayer !== address) {
    return c.json({ error: 'You are not in this game' }, 403)
  }

  // During ready_check, resign = cancel (no wagers locked on-chain yet)
  if (game.status === 'ready_check') {
    const [updated] = await db.update(games).set({
      status: 'canceled',
      finishedAt: new Date(),
    }).where(eq(games.id, gameId)).returning()

    logEvent(db, 'resign_ready_check', address, gameId)
    broadcastToGame(gameId, { type: WS_EVENTS.GAME_CANCELED, reason: 'resign' })
    broadcastToLobby({ type: WS_EVENTS.GAME_CANCELED, gameId })
    return c.json({ game: updated })
  }

  const winner = address === game.blackPlayer ? game.whitePlayer : game.blackPlayer
  const winStatus = address === game.blackPlayer ? 'white_wins' : 'black_wins'

  const [updated] = await db.update(games).set({
    status: winStatus,
    winner,
    finishedAt: new Date(),
    currentTurnDeadline: null,
  }).where(eq(games.id, gameId)).returning()

  logEvent(db, 'resign', address, gameId)

  // ELO update
  if (winner) {
    recordCommission(db, game.wager, gameId, winner)

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

    // Background: resolve on-chain
    if (relayer.isReady && game.onChainGameId && game.wager !== '0') {
      fireAndForget(`resign:${gameId}`, async () => {
        const txHash = await relayer.relayResolveGame(game.onChainGameId!, winner)
        console.log(`[relay:resign] Game ${gameId} winner=${winner.slice(0, 12)}... tx=${txHash.slice(0, 12)}...`)
        await db.update(games).set({ txHashResolve: txHash }).where(eq(games.id, gameId))
      })
    }
  }

  broadcastToGame(gameId, { type: WS_EVENTS.GAME_OVER, winner, reason: 'resign' })
  return c.json({ game: updated })
})

// Rematch offer
gameRoutes.post('/:id/rematch-offer', requireAuth, async (c) => {
  const address = c.get('address' as never) as string
  const db = c.get('db' as never) as Db
  const gameId = c.req.param('id') as string

  const [game] = await db.select().from(games).where(eq(games.id, gameId)).limit(1)
  if (!game) return c.json({ error: 'Game not found' }, 404)
  if (!['black_wins', 'white_wins', 'draw', 'timeout'].includes(game.status)) {
    return c.json({ error: 'Game is not finished' }, 400)
  }
  if (game.blackPlayer !== address && game.whitePlayer !== address) {
    return c.json({ error: 'You are not in this game' }, 403)
  }

  broadcastToGame(gameId, { type: WS_EVENTS.REMATCH_OFFER, from: address })
  return c.json({ success: true })
})

// Rematch accept — creates a new game with swapped sides
gameRoutes.post('/:id/rematch-accept', requireAuth, async (c) => {
  const address = c.get('address' as never) as string
  const db = c.get('db' as never) as Db
  const gameId = c.req.param('id') as string

  const [game] = await db.select().from(games).where(eq(games.id, gameId)).limit(1)
  if (!game) return c.json({ error: 'Game not found' }, 404)
  if (!['black_wins', 'white_wins', 'draw', 'timeout'].includes(game.status)) {
    return c.json({ error: 'Game is not finished' }, 400)
  }
  if (game.blackPlayer !== address && game.whitePlayer !== address) {
    return c.json({ error: 'You are not in this game' }, 403)
  }

  // Create new game with random sides
  const swap = Math.random() < 0.5
  const blackAddr = swap ? game.blackPlayer : game.whitePlayer
  const whiteAddr = swap ? game.whitePlayer : game.blackPlayer

  const initialState = createInitialGameState(game.variant as GameVariant)
  initialState.status = 'ready_check' as any

  const [newGame] = await db.insert(games).values({
    blackPlayer: blackAddr,
    whitePlayer: whiteAddr,
    wager: game.wager,
    timePerMove: game.timePerMove,
    variant: game.variant,
    gameState: serializeGameState(initialState),
    status: 'ready_check',
    blackReady: false,
    whiteReady: false,
  }).returning()

  broadcastToGame(gameId, { type: WS_EVENTS.REMATCH_ACCEPT, newGameId: newGame.id })
  logEvent(db, 'rematch', address, newGame.id, `from=${gameId}`)

  return c.json({ game: newGame })
})

// Rematch decline
gameRoutes.post('/:id/rematch-decline', requireAuth, async (c) => {
  const address = c.get('address' as never) as string
  const gameId = c.req.param('id') as string

  broadcastToGame(gameId, { type: WS_EVENTS.REMATCH_DECLINE, from: address })
  return c.json({ success: true })
})

// Draw offer
gameRoutes.post('/:id/draw-offer', requireAuth, async (c) => {
  const address = c.get('address' as never) as string
  const db = c.get('db' as never) as Db
  const gameId = c.req.param('id') as string

  const [game] = await db.select().from(games).where(eq(games.id, gameId)).limit(1)
  if (!game) return c.json({ error: 'Game not found' }, 404)
  if (game.status !== 'playing') return c.json({ error: 'Game is not in progress' }, 400)
  if (game.blackPlayer !== address && game.whitePlayer !== address) {
    return c.json({ error: 'You are not in this game' }, 403)
  }

  broadcastToGame(gameId, { type: 'draw:offer', from: address })
  return c.json({ success: true })
})

// Accept draw
gameRoutes.post('/:id/draw-accept', requireAuth, async (c) => {
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
        totalWagered: sql`(total_wagered::bigint + ${game.wager}::bigint)::text`,
      }).where(eq(users.address, game.blackPlayer))
      await db.update(users).set({
        gamesPlayed: sql`games_played + 1`, gamesDraw: sql`games_draw + 1`, elo: elo.newRatingB,
        totalWagered: sql`(total_wagered::bigint + ${game.wager}::bigint)::text`,
      }).where(eq(users.address, game.whitePlayer))
    }
  }

  // Background: refund both on-chain
  if (relayer.isReady && game.onChainGameId && game.wager !== '0') {
    fireAndForget(`draw-accept:${gameId}`, async () => {
      const txHash = await relayer.relayResolveDraw(game.onChainGameId!)
      console.log(`[relay:draw] Game ${gameId} tx=${txHash.slice(0, 12)}...`)
      await db.update(games).set({ txHashResolve: txHash }).where(eq(games.id, gameId))
    })
  }

  broadcastToGame(gameId, { type: WS_EVENTS.GAME_OVER, winner: null, reason: 'draw' })
  return c.json({ game: updated })
})

// Relay status for a game
gameRoutes.get('/:id/relay-status', async (c) => {
  const db = c.get('db' as never) as Db
  const gameId = c.req.param('id') as string

  const [game] = await db.select({
    txHashCreate: games.txHashCreate,
    txHashJoin: games.txHashJoin,
    txHashResolve: games.txHashResolve,
    onChainGameId: games.onChainGameId,
    status: games.status,
    wager: games.wager,
  }).from(games).where(eq(games.id, gameId)).limit(1)
  if (!game) return c.json({ error: 'Game not found' }, 404)

  const relayerActive = relayer.isReady
  const isOnChain = !!game.onChainGameId
  const hasWager = game.wager !== '0'

  return c.json({
    relayerActive,
    isOnChain,
    hasWager,
    txHashCreate: game.txHashCreate,
    txHashJoin: game.txHashJoin,
    txHashResolve: game.txHashResolve,
    onChainGameId: game.onChainGameId,
  })
})
