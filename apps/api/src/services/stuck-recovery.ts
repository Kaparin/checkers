import { eq, and, lt, sql } from 'drizzle-orm'
import { games, txEvents } from '@checkers/db'
import type { Db } from '@checkers/db'

/**
 * Periodically checks for stuck games and recovers them:
 * - Waiting games older than 30 minutes → auto-cancel
 * - Playing games with no deadline and no recent activity → flag for review
 */
export function startStuckRecovery(db: Db, intervalMs = 60_000) {
  const timer = setInterval(async () => {
    try {
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000)

      // Cancel stuck waiting games (no opponent joined in 30 min)
      const stuckWaiting = await db.select().from(games).where(
        and(
          eq(games.status, 'waiting'),
          lt(games.createdAt, thirtyMinAgo),
        )
      )

      for (const game of stuckWaiting) {
        await db.update(games).set({
          status: 'canceled',
          finishedAt: new Date(),
        }).where(eq(games.id, game.id))

        db.insert(txEvents).values({
          action: 'admin_action',
          gameId: game.id,
          details: 'Auto-canceled: no opponent joined in 30 minutes',
        }).catch(() => {})

        console.log(`[stuck-recovery] Auto-canceled waiting game ${game.id} (${Math.round((Date.now() - new Date(game.createdAt).getTime()) / 60000)}min old)`)
      }

      // Cancel stuck ready_check games (players didn't confirm in 5 min)
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000)
      const stuckReady = await db.select().from(games).where(
        and(
          eq(games.status, 'ready_check'),
          lt(games.createdAt, fiveMinAgo),
        )
      )

      for (const game of stuckReady) {
        await db.update(games).set({
          status: 'canceled',
          finishedAt: new Date(),
        }).where(eq(games.id, game.id))

        db.insert(txEvents).values({
          action: 'admin_action',
          gameId: game.id,
          details: 'Auto-canceled: ready check not completed in 5 minutes',
        }).catch(() => {})

        console.log(`[stuck-recovery] Auto-canceled ready_check game ${game.id}`)
      }

      const totalCleaned = stuckWaiting.length + stuckReady.length
      if (totalCleaned > 0) {
        console.log(`[stuck-recovery] Cleaned up ${totalCleaned} stuck games (${stuckWaiting.length} waiting, ${stuckReady.length} ready_check)`)
      }
    } catch (err) {
      console.error('[stuck-recovery] Error:', err)
    }
  }, intervalMs)

  return () => clearInterval(timer)
}
