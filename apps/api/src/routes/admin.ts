import { Hono } from 'hono'
import { eq, sql, desc, count, and, lt, gt, inArray, ilike, or } from 'drizzle-orm'
import { requireAdmin } from '../middleware/admin'
import { games, users, vaultBalances, treasuryLedger, relayerTransactions, txEvents, platformConfig, events, announcements } from '@checkers/db'
import type { Db } from '@checkers/db'
import { ConfigService } from '../services/config.service'
import { TreasuryService } from '../services/treasury.service'

export const adminRoutes = new Hono()

// All admin routes require ADMIN_SECRET
adminRoutes.use('*', requireAdmin)

// ─── Dashboard ───────────────────────────────────────────

adminRoutes.get('/dashboard', async (c) => {
  const db = c.get('db' as never) as Db

  const [
    totalUsers,
    totalGames,
    gamesByStatus,
    recentGames,
    volumeResult,
  ] = await Promise.all([
    db.select({ count: count() }).from(users),
    db.select({ count: count() }).from(games),
    db.select({
      status: games.status,
      count: count(),
    }).from(games).groupBy(games.status),
    db.select().from(games).orderBy(desc(games.createdAt)).limit(10),
    db.select({
      total: sql<string>`COALESCE(SUM(${games.wager}::numeric), 0)::text`,
    }).from(games).where(
      inArray(games.status, ['black_wins', 'white_wins', 'draw'])
    ),
  ])

  const treasury = new TreasuryService(db)
  const totalCommission = await treasury.getTotalCommission()
  const pendingSweep = await treasury.getPendingSweep()

  return c.json({
    users: totalUsers[0]?.count ?? 0,
    games: totalGames[0]?.count ?? 0,
    volume: volumeResult[0]?.total ?? '0',
    totalCommission,
    pendingSweep,
    gamesByStatus: Object.fromEntries(gamesByStatus.map(r => [r.status, r.count])),
    recentGames,
  })
})

// ─── Users ───────────────────────────────────────────────

adminRoutes.get('/users', async (c) => {
  const db = c.get('db' as never) as Db
  const limit = Number(c.req.query('limit')) || 50
  const offset = Number(c.req.query('offset')) || 0
  const search = c.req.query('search')

  const base = db.select().from(users)
  // Escape LIKE special characters to prevent wildcard injection
  const escapedSearch = search?.replace(/[%_\\]/g, '\\$&')
  const result = escapedSearch
    ? await base.where(or(ilike(users.address, `%${escapedSearch}%`), ilike(users.username, `%${escapedSearch}%`)))
        .orderBy(desc(users.createdAt)).limit(limit).offset(offset)
    : await base.orderBy(desc(users.createdAt)).limit(limit).offset(offset)

  const total = await db.select({ count: count() }).from(users)

  return c.json({ users: result, total: total[0]?.count ?? 0 })
})

adminRoutes.get('/users/:address', async (c) => {
  const db = c.get('db' as never) as Db
  const address = c.req.param('address')

  const [user] = await db.select().from(users).where(eq(users.address, address))
  if (!user) return c.json({ error: 'User not found' }, 404)

  const [vault] = await db.select().from(vaultBalances).where(eq(vaultBalances.address, address))
  const userGames = await db.select().from(games)
    .where(sql`${games.blackPlayer} = ${address} OR ${games.whitePlayer} = ${address}`)
    .orderBy(desc(games.createdAt)).limit(20)

  return c.json({ user, vault: vault ?? null, games: userGames })
})

// Credit/debit user vault balance
adminRoutes.post('/users/:address/balance', async (c) => {
  const db = c.get('db' as never) as Db
  const address = c.req.param('address')
  const body = await c.req.json<{ amount: string; type: 'credit' | 'debit'; reason: string }>()

  if (!body.amount || !body.type || !body.reason) {
    return c.json({ error: 'amount, type, and reason are required' }, 400)
  }

  let amt: bigint
  try {
    amt = BigInt(body.amount)
  } catch {
    return c.json({ error: 'amount must be a valid number string' }, 400)
  }
  if (amt <= 0n) return c.json({ error: 'amount must be positive' }, 400)

  // Atomic vault balance update
  if (body.type === 'debit') {
    // Debit: use WHERE to prevent negative balance (race-safe)
    const updated = await db.update(vaultBalances).set({
      available: sql`(${vaultBalances.available}::numeric - ${body.amount}::numeric)::text`,
      updatedAt: new Date(),
    }).where(
      sql`${vaultBalances.address} = ${address} AND ${vaultBalances.available}::numeric >= ${body.amount}::numeric`
    ).returning()
    if (updated.length === 0) return c.json({ error: 'Insufficient balance' }, 400)
  } else {
    // Credit: upsert is safe
    await db
      .insert(vaultBalances)
      .values({ address, available: body.amount })
      .onConflictDoUpdate({
        target: vaultBalances.address,
        set: {
          available: sql`(${vaultBalances.available}::numeric + ${body.amount}::numeric)::text`,
          updatedAt: new Date(),
        },
      })
  }

  const [updated] = await db.select().from(vaultBalances).where(eq(vaultBalances.address, address))
  const newBalance = updated?.available ?? '0'

  await db.insert(txEvents).values({
    action: 'admin_action',
    address,
    details: `${body.type} ${body.amount} uaxm: ${body.reason}`,
  })

  return c.json({ success: true, available: newBalance.toString() })
})

// ─── Games ───────────────────────────────────────────────

adminRoutes.get('/games', async (c) => {
  const db = c.get('db' as never) as Db
  const limit = Number(c.req.query('limit')) || 50
  const offset = Number(c.req.query('offset')) || 0
  const status = c.req.query('status')

  let query
  if (status) {
    query = db.select().from(games).where(eq(games.status, status as any)).orderBy(desc(games.createdAt)).limit(limit).offset(offset)
  } else {
    query = db.select().from(games).orderBy(desc(games.createdAt)).limit(limit).offset(offset)
  }

  const result = await query
  const total = await db.select({ count: count() }).from(games)

  return c.json({ games: result, total: total[0]?.count ?? 0 })
})

// Stuck games: in transitional state for > 5 minutes
adminRoutes.get('/games/stuck', async (c) => {
  const db = c.get('db' as never) as Db
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000)

  const stuck = await db.select().from(games).where(
    and(
      inArray(games.status, ['waiting', 'playing', 'ready_check']),
      lt(games.createdAt, fiveMinAgo),
    )
  ).orderBy(desc(games.createdAt))

  return c.json({ games: stuck, count: stuck.length })
})

// Force cancel a game
adminRoutes.post('/games/:id/force-cancel', async (c) => {
  const db = c.get('db' as never) as Db
  const gameId = c.req.param('id')

  const [game] = await db.select().from(games).where(eq(games.id, gameId))
  if (!game) return c.json({ error: 'Game not found' }, 404)

  if (['black_wins', 'white_wins', 'draw', 'canceled'].includes(game.status)) {
    return c.json({ error: 'Game already resolved' }, 400)
  }

  await db.update(games).set({
    status: 'canceled',
    finishedAt: new Date(),
  }).where(eq(games.id, gameId))

  // Log admin action
  await db.insert(txEvents).values({
    action: 'admin_action',
    details: `Force canceled game ${gameId}`,
    gameId,
  })

  return c.json({ success: true })
})

// ─── Config ──────────────────────────────────────────────

adminRoutes.get('/config', async (c) => {
  const db = c.get('db' as never) as Db
  const config = new ConfigService(db)
  const all = await config.getAll()
  return c.json({ config: all })
})

adminRoutes.put('/config/:key', async (c) => {
  const db = c.get('db' as never) as Db
  const key = c.req.param('key')
  const body = await c.req.json<{ value: string }>()

  if (!body.value && body.value !== '') {
    return c.json({ error: 'value is required' }, 400)
  }

  const config = new ConfigService(db)
  await config.set(key, body.value)

  await db.insert(txEvents).values({
    action: 'admin_action',
    details: `Config updated: ${key} = ${body.value}`,
  })

  return c.json({ success: true })
})

// ─── Treasury ────────────────────────────────────────────

adminRoutes.get('/treasury', async (c) => {
  const db = c.get('db' as never) as Db
  const treasury = new TreasuryService(db)

  const [totalCommission, pendingSweep, ledger] = await Promise.all([
    treasury.getTotalCommission(),
    treasury.getPendingSweep(),
    treasury.getLedger(20),
  ])

  return c.json({ totalCommission, pendingSweep, ledger })
})

// ─── Diagnostics ─────────────────────────────────────────

adminRoutes.get('/diagnostics', async (c) => {
  const db = c.get('db' as never) as Db
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000)

  const [
    gamesByStatus,
    stuckGames,
    recentRelayerTxs,
    failedTxs,
  ] = await Promise.all([
    db.select({ status: games.status, count: count() }).from(games).groupBy(games.status),
    db.select({ count: count() }).from(games).where(
      and(
        inArray(games.status, ['waiting', 'playing', 'ready_check']),
        lt(games.createdAt, fiveMinAgo),
      )
    ),
    db.select().from(relayerTransactions).orderBy(desc(relayerTransactions.createdAt)).limit(20),
    db.select({ count: count() }).from(relayerTransactions).where(eq(relayerTransactions.status, 'failed')),
  ])

  return c.json({
    gameDistribution: Object.fromEntries(gamesByStatus.map(r => [r.status, r.count])),
    stuckGames: stuckGames[0]?.count ?? 0,
    recentRelayerTxs,
    failedRelayerTxs: failedTxs[0]?.count ?? 0,
  })
})

// ─── Actions (System Healing) ────────────────────────────

adminRoutes.post('/actions/heal', async (c) => {
  const db = c.get('db' as never) as Db
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000)
  const results: string[] = []

  // 1. Cancel stuck waiting games (> 5 min old)
  const stuckWaiting = await db.select().from(games).where(
    and(eq(games.status, 'waiting'), lt(games.createdAt, fiveMinAgo))
  )
  if (stuckWaiting.length > 0) {
    for (const game of stuckWaiting) {
      await db.update(games).set({ status: 'canceled', finishedAt: new Date() }).where(eq(games.id, game.id))
    }
    results.push(`Canceled ${stuckWaiting.length} stuck waiting games`)
  }

  // 2. Timeout stuck playing games (> 5 min past deadline)
  const stuckPlaying = await db.select().from(games).where(
    and(
      eq(games.status, 'playing'),
      lt(games.currentTurnDeadline, fiveMinAgo),
    )
  )
  if (stuckPlaying.length > 0) {
    for (const game of stuckPlaying) {
      // Determine whose turn it was (they lose for timing out)
      let currentTurn: string | null = null
      try {
        const gs = typeof game.gameState === 'string' ? JSON.parse(game.gameState) : game.gameState as Record<string, unknown>
        currentTurn = (gs?.t || gs?.currentTurn) as string | null
      } catch {}
      const winner = currentTurn === 'black' ? game.whitePlayer : game.blackPlayer
      await db.update(games).set({
        status: 'timeout',
        winner,
        finishedAt: new Date(),
      }).where(eq(games.id, game.id))
    }
    results.push(`Timed out ${stuckPlaying.length} stuck playing games`)
  }

  // Log action
  await db.insert(txEvents).values({
    action: 'admin_action',
    details: `System heal: ${results.length > 0 ? results.join('; ') : 'Nothing to heal'}`,
  })

  return c.json({ results, healed: results.length > 0 })
})

// ─── Transactions ────────────────────────────────────────

adminRoutes.get('/transactions', async (c) => {
  const db = c.get('db' as never) as Db
  const limit = Number(c.req.query('limit')) || 50
  const offset = Number(c.req.query('offset')) || 0

  const txs = await db.select().from(relayerTransactions)
    .orderBy(desc(relayerTransactions.createdAt))
    .limit(limit).offset(offset)

  const total = await db.select({ count: count() }).from(relayerTransactions)

  return c.json({ transactions: txs, total: total[0]?.count ?? 0 })
})

// ─── Events ─────────────────────────────────────────────

adminRoutes.post('/events', async (c) => {
  const db = c.get('db' as never) as Db
  const body = await c.req.json<{
    type: string
    title: string
    description?: string
    metric?: string
    prizePool?: string
    prizeType?: string
    startsAt: string
    endsAt: string
  }>()

  if (!body.title || !body.startsAt || !body.endsAt) {
    return c.json({ error: 'title, startsAt, endsAt required' }, 400)
  }

  const [event] = await db.insert(events).values({
    type: body.type as any,
    title: body.title,
    description: body.description || null,
    metric: body.metric || null,
    prizePool: body.prizePool || '0',
    prizeType: (body.prizeType || 'checker') as any,
    startsAt: new Date(body.startsAt),
    endsAt: new Date(body.endsAt),
    status: 'upcoming',
  }).returning()

  return c.json({ event }, 201)
})

// ─── Announcements ──────────────────────────────────────

adminRoutes.post('/announcements', async (c) => {
  const db = c.get('db' as never) as Db
  const body = await c.req.json<{ title: string; body: string; type?: string }>()

  if (!body.title || !body.body) {
    return c.json({ error: 'title and body required' }, 400)
  }

  const [ann] = await db.insert(announcements).values({
    title: body.title,
    body: body.body,
    type: (body.type || 'info') as any,
  }).returning()

  return c.json({ announcement: ann }, 201)
})

adminRoutes.delete('/announcements/:id', async (c) => {
  const db = c.get('db' as never) as Db
  const id = c.req.param('id') as string

  await db.update(announcements).set({ active: false }).where(eq(announcements.id, id))
  return c.json({ success: true })
})
