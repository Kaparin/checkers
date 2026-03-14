import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { CreateGameSchema, MakeMoveSchema, GameListSchema } from '@checkers/shared'
import { createInitialGameState, isValidMove, applyMove, serializeGameState, deserializeGameState, calculateElo, calculateEloDraw } from '@checkers/shared'
import { games, gameMoves, users, txEvents, treasuryLedger, stakingLedger } from '@checkers/db'
import type { Db } from '@checkers/db'
import { eq, desc, sql, inArray, or, and } from 'drizzle-orm'
import { requireAuth } from '../middleware/auth'
import { broadcastToGame, broadcastToLobby } from '../ws/handler'
import { WS_EVENTS, calcCommission } from '@checkers/shared'
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
  const { commission } = calcCommission(wager)
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
 * Check if user has granted authz to relayer (server-side).
 * Returns: true = confirmed, false = confirmed no grant, null = check failed (network).
 * On network failure, we let the relay call proceed — it will fail with a clear error if no grant.
 */
async function hasAuthzGrant(address: string): Promise<boolean | null> {
  const grantee = relayer.getAddress()
  if (!grantee) return null
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(
      `${AXIOME_REST}/cosmos/authz/v1beta1/grants?granter=${address}&grantee=${grantee}`,
      { signal: controller.signal },
    ).finally(() => clearTimeout(timeout))
    if (!res.ok) return null // network/server issue — don't block
    const data = await res.json() as any
    const grants = data.grants || []
    return grants.some((g: any) => {
      const auth = g.authorization
      if (!auth) return false
      return (
        auth['@type'] === '/cosmwasm.wasm.v1.ContractExecutionAuthorization' ||
        (auth['@type'] === '/cosmos.authz.v1beta1.GenericAuthorization' &&
          auth.msg === '/cosmwasm.wasm.v1.MsgExecuteContract')
      )
    })
  } catch {
    console.warn(`[authz] Check failed for ${address} — proceeding anyway`)
    return null // network error — don't block, let relay handle it
  }
}

/**
 * Fire relayer call in background with retry — never blocks the API response.
 * Retries up to 3 times with exponential backoff (2s, 4s, 8s).
 */
function fireAndForget(label: string, fn: () => Promise<unknown>, maxRetries = 3) {
  const attempt = async (retry: number) => {
    try {
      await fn()
    } catch (err: any) {
      console.error(`[relay:${label}] Attempt ${retry + 1}/${maxRetries} failed:`, err?.message || err)
      if (retry + 1 < maxRetries) {
        const delay = 2000 * Math.pow(2, retry)
        await new Promise(r => setTimeout(r, delay))
        return attempt(retry + 1)
      }
      console.error(`[relay:${label}] All ${maxRetries} attempts exhausted`)
    }
  }
  attempt(0)
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
          return c.json({ error: 'Недостаточно средств для этой ставки' }, 400)
        }
      }
    } catch {
      // Chain unavailable — skip balance check
    }
  }

  // Prevent creating multiple waiting games
  const [existing] = await db.select({ id: games.id }).from(games)
    .where(and(eq(games.blackPlayer, address), eq(games.status, 'waiting')))
    .limit(1)
  if (existing) {
    return c.json({ error: 'У вас уже есть активная игра. Отмените её перед созданием новой.' }, 400)
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

  logEvent(db, 'create_game', address, game.id, `wager=${wager} variant=${variant}`)

  // Synchronous: lock wager on-chain (must succeed before game is available)
  if (relayer.isReady && wager !== '0') {
    // Check authz grant before attempting relay (false = confirmed no grant, null = check failed)
    const granted = await hasAuthzGrant(address)
    if (granted === false) {
      await db.delete(games).where(eq(games.id, game.id))
      return c.json({ error: 'Вы не авторизовали релеер. Нажмите "Авторизовать" на главной странице.' }, 403)
    }

    try {
      const { txHash, onChainGameId } = await relayer.relayCreateGame(
        address, variant, timePerMove, wager, AXIOME_DENOM,
      )
      console.log(`[relay:create] Game ${game.id} → on-chain #${onChainGameId} tx=${txHash.slice(0, 12)}...`)
      await db.update(games).set({
        onChainGameId,
        txHashCreate: txHash,
      }).where(eq(games.id, game.id))
    } catch (err: any) {
      const errMsg = err?.message || String(err)
      console.error(`[relay:create] Game ${game.id} FAILED:`, errMsg)
      // Rollback: delete game from DB since on-chain lock failed
      await db.delete(games).where(eq(games.id, game.id))
      // Friendly error for common chain errors
      if (errMsg.includes('unauthorized')) {
        return c.json({ error: 'Вы не авторизовали релеер. Нажмите "Авторизовать" на главной странице.' }, 403)
      }
      if (errMsg.includes('insufficient funds') || errMsg.includes('insufficient fee')) {
        return c.json({ error: 'Недостаточно средств на счёте для этой ставки.' }, 400)
      }
      return c.json({ error: `Ошибка блокчейна: ${errMsg.slice(0, 200)}` }, 500)
    }
  }

  broadcastToLobby({ type: WS_EVENTS.GAME_CREATED, game: { id: game.id, wager, variant, blackPlayer: address, timePerMove } })
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

  // Server-side balance check for joiner
  if (game.wager !== '0') {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)
      const balRes = await fetch(`${AXIOME_REST}/cosmos/bank/v1beta1/balances/${address}`, { signal: controller.signal }).finally(() => clearTimeout(timeout))
      if (balRes.ok) {
        const balData = await balRes.json() as { balances: { denom: string; amount: string }[] }
        const axmBal = balData.balances?.find((b: { denom: string }) => b.denom === AXIOME_DENOM)
        if (axmBal && BigInt(axmBal.amount) < BigInt(game.wager)) {
          return c.json({ error: 'Недостаточно средств для этой ставки' }, 400)
        }
      }
    } catch {
      // Chain unavailable — skip balance check
    }
  }

  // Random side assignment
  const swap = Math.random() < 0.5
  const blackAddr = swap ? address : game.blackPlayer
  const whiteAddr = swap ? game.blackPlayer : address

  const state = parseRawGameState(game.gameState)
  state.s = 'ready_check'
  state.t = 'black'

  // Atomic: only join if game is still 'waiting' (prevents double-join race)
  const [updated] = await db.update(games).set({
    blackPlayer: blackAddr,
    whitePlayer: whiteAddr,
    status: 'ready_check',
    gameState: JSON.stringify(state),
    blackReady: false,
    whiteReady: false,
  }).where(and(eq(games.id, gameId), eq(games.status, 'waiting'))).returning()

  if (!updated) return c.json({ error: 'Игра уже занята' }, 409)

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

    // Atomic: only transition if still 'ready_check' (prevents double-start)
    const [started] = await db.update(games).set({
      status: 'playing',
      gameState: JSON.stringify(state),
      startedAt: now,
      currentTurnDeadline: deadline,
    }).where(and(eq(games.id, gameId), eq(games.status, 'ready_check'))).returning()

    if (!started) {
      // Already transitioned by the other ready request — just return
      return c.json({ success: true, blackReady: fresh.blackReady, whiteReady: fresh.whiteReady })
    }

    // Synchronous: lock joiner's wager on-chain BEFORE broadcasting game start
    if (relayer.isReady && game.onChainGameId && game.wager !== '0' && game.whitePlayer) {
      // Check authz grant for joiner (false = confirmed no grant, null = check failed)
      const joinerGranted = await hasAuthzGrant(game.whitePlayer!)
      if (joinerGranted === false) {
        await db.update(games).set({
          status: 'ready_check',
          blackReady: false,
          whiteReady: false,
          startedAt: null,
          currentTurnDeadline: null,
        }).where(eq(games.id, gameId))
        broadcastToGame(gameId, {
          type: 'game:join_failed',
          error: 'Оппонент не авторизовал релеер. Попросите его нажать "Авторизовать".',
        })
        return c.json({ error: 'Оппонент не авторизовал релеер' }, 403)
      }

      try {
        const txHash = await relayer.relayJoinGame(
          game.whitePlayer!, game.onChainGameId!, game.wager, AXIOME_DENOM,
        )
        console.log(`[relay:join] Game ${gameId} on-chain #${game.onChainGameId} tx=${txHash.slice(0, 12)}...`)
        await db.update(games).set({ txHashJoin: txHash }).where(eq(games.id, gameId))
      } catch (err: any) {
        const errMsg = err?.message || String(err)
        console.error(`[relay:join] Game ${gameId} FAILED:`, errMsg)
        // Revert game back to ready_check — don't start without on-chain backing
        await db.update(games).set({
          status: 'ready_check',
          blackReady: false,
          whiteReady: false,
          startedAt: null,
          currentTurnDeadline: null,
        }).where(eq(games.id, gameId))
        const friendlyErr = errMsg.includes('unauthorized')
          ? 'Оппонент не авторизовал релеер. Попросите его нажать "Авторизовать".'
          : errMsg.includes('insufficient funds')
          ? 'У оппонента недостаточно средств.'
          : `Ошибка блокчейна: ${errMsg.slice(0, 150)}`
        broadcastToGame(gameId, {
          type: 'game:join_failed',
          error: friendlyErr,
        })
        return c.json({ error: friendlyErr }, 500)
      }
    }

    // Broadcast game start AFTER relay succeeds
    broadcastToGame(gameId, {
      type: WS_EVENTS.GAME_BOTH_READY,
      game: started,
    })
    logEvent(db, 'game_started', undefined, gameId)
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

  // Atomic: only update if game is still 'playing' (prevents race with timeout/resign)
  const [updated] = await db.update(games).set({
    gameState: serializeGameState(newState),
    moveCount: newState.moveCount,
    status: isFinished ? newState.status : 'playing',
    currentTurnDeadline: isFinished ? null : deadline,
    winner,
    finishedAt: isFinished ? new Date() : null,
  }).where(and(eq(games.id, gameId), eq(games.status, 'playing'))).returning()

  if (!updated) return c.json({ error: 'Игра уже завершена' }, 400)

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
      totalWagered: sql`(total_wagered::bigint + ${game.wager}::bigint)::text`,
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
    currentTurnDeadline: updated.currentTurnDeadline?.toISOString() ?? null,
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
      await db.update(games).set({ txHashResolve: txHash }).where(eq(games.id, gameId))
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

  // Atomic status transition: only proceed if still 'playing'
  const [updated] = await db.update(games).set({
    status: winStatus,
    winner,
    finishedAt: new Date(),
    currentTurnDeadline: null,
  }).where(and(eq(games.id, gameId), eq(games.status, 'playing'))).returning()

  if (!updated) return c.json({ error: 'Игра уже завершена' }, 400)

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
        totalWon: sql`(total_won::bigint + ${game.wager}::bigint)::text`,
        totalWagered: sql`(total_wagered::bigint + ${game.wager}::bigint)::text`,
        elo: elo.newRatingWinner,
      }).where(eq(users.address, winner))
      await db.update(users).set({
        gamesPlayed: sql`games_played + 1`, gamesLost: sql`games_lost + 1`,
        totalWagered: sql`(total_wagered::bigint + ${game.wager}::bigint)::text`,
        elo: elo.newRatingLoser,
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

  // Atomic status transition: only proceed if still 'playing'
  const [updated] = await db.update(games).set({
    status: 'draw',
    finishedAt: new Date(),
    currentTurnDeadline: null,
  }).where(and(eq(games.id, gameId), eq(games.status, 'playing'))).returning()

  if (!updated) return c.json({ error: 'Игра уже завершена' }, 400)

  // Record commission from draw (10% of total pot)
  if (game.wager !== '0') {
    recordCommission(db, game.wager, gameId)
  }

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
