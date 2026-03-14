import { eq, and, lt, isNull, isNotNull, inArray } from 'drizzle-orm'
import { games, txEvents } from '@checkers/db'
import type { Db } from '@checkers/db'
import { relayer } from './relayer'

/**
 * Periodically checks for stuck games and recovers them:
 * - Waiting games older than 30 minutes → auto-cancel
 * - Ready_check games older than 5 minutes → auto-cancel
 * - Finished games with txHashResolve=NULL → retry relay to unlock on-chain funds
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

      // ── Fund Recovery: retry relay for finished games with stuck on-chain funds ──
      if (relayer.isReady) {
        let recoveredResolve = 0
        let recoveredDraw = 0
        let recoveredCancel = 0

        // --- Recover finished games (win/timeout) with stuck funds ---
        const stuckResolved = await db.select().from(games).where(
          and(
            inArray(games.status, ['black_wins', 'white_wins', 'timeout']),
            isNotNull(games.onChainGameId),
            isNull(games.txHashResolve),
            isNotNull(games.winner),
            lt(games.finishedAt, fiveMinAgo),
          )
        )

        for (const game of stuckResolved) {
          try {
            const txHash = await relayer.relayResolveGame(game.onChainGameId!, game.winner!)
            await db.update(games).set({ txHashResolve: txHash }).where(eq(games.id, game.id))
            console.log(`[stuck-recovery] Resolved game ${game.id} (${game.status}) on-chain, tx=${txHash.slice(0, 12)}...`)
            recoveredResolve++

            db.insert(txEvents).values({
              action: 'admin_action',
              gameId: game.id,
              details: `Stuck fund recovery: relayed resolve_game, tx=${txHash}`,
            }).catch(() => {})
          } catch (err: any) {
            const msg = err?.message || ''
            if (msg.includes('Invalid') || msg.includes('not found') || msg.includes('not active')) {
              // Game already resolved on-chain (by previous relay or ClaimTimeout)
              console.log(`[stuck-recovery] Game ${game.id} already resolved on-chain, marking recovered`)
              await db.update(games).set({ txHashResolve: 'recovered-on-chain' }).where(eq(games.id, game.id))
              recoveredResolve++
            } else {
              console.error(`[stuck-recovery] Failed to resolve game ${game.id}:`, msg)
            }
          }
        }

        // --- Recover stuck draw games ---
        const stuckDraws = await db.select().from(games).where(
          and(
            eq(games.status, 'draw'),
            isNotNull(games.onChainGameId),
            isNull(games.txHashResolve),
            lt(games.finishedAt, fiveMinAgo),
          )
        )

        for (const game of stuckDraws) {
          try {
            const txHash = await relayer.relayResolveDraw(game.onChainGameId!)
            await db.update(games).set({ txHashResolve: txHash }).where(eq(games.id, game.id))
            console.log(`[stuck-recovery] Resolved draw ${game.id} on-chain, tx=${txHash.slice(0, 12)}...`)
            recoveredDraw++

            db.insert(txEvents).values({
              action: 'admin_action',
              gameId: game.id,
              details: `Stuck fund recovery: relayed resolve_draw, tx=${txHash}`,
            }).catch(() => {})
          } catch (err: any) {
            const msg = err?.message || ''
            if (msg.includes('Invalid') || msg.includes('not found') || msg.includes('not active')) {
              console.log(`[stuck-recovery] Draw ${game.id} already resolved on-chain, marking recovered`)
              await db.update(games).set({ txHashResolve: 'recovered-on-chain' }).where(eq(games.id, game.id))
              recoveredDraw++
            } else {
              console.error(`[stuck-recovery] Failed to resolve draw ${game.id}:`, msg)
            }
          }
        }

        // --- Recover stuck canceled games (refund creator's wager) ---
        const stuckCanceled = await db.select().from(games).where(
          and(
            eq(games.status, 'canceled'),
            isNotNull(games.onChainGameId),
            isNotNull(games.txHashCreate), // was actually created on-chain
            isNull(games.txHashResolve),
            lt(games.finishedAt, fiveMinAgo),
          )
        )

        for (const game of stuckCanceled) {
          if (!game.blackPlayer) continue
          try {
            const txHash = await relayer.relayCancelGame(game.blackPlayer, game.onChainGameId!)
            await db.update(games).set({ txHashResolve: txHash }).where(eq(games.id, game.id))
            console.log(`[stuck-recovery] Canceled game ${game.id} on-chain, tx=${txHash.slice(0, 12)}...`)
            recoveredCancel++

            db.insert(txEvents).values({
              action: 'admin_action',
              gameId: game.id,
              details: `Stuck fund recovery: relayed cancel_game, tx=${txHash}`,
            }).catch(() => {})
          } catch (err: any) {
            const msg = err?.message || ''
            if (msg.includes('Invalid') || msg.includes('not found') || msg.includes('not active')) {
              console.log(`[stuck-recovery] Canceled game ${game.id} already handled on-chain, marking recovered`)
              await db.update(games).set({ txHashResolve: 'recovered-on-chain' }).where(eq(games.id, game.id))
              recoveredCancel++
            } else {
              console.error(`[stuck-recovery] Failed to cancel game ${game.id}:`, msg)
            }
          }
        }

        const totalRecovered = recoveredResolve + recoveredDraw + recoveredCancel
        if (totalRecovered > 0) {
          console.log(`[stuck-recovery] Fund recovery: ${recoveredResolve} resolved, ${recoveredDraw} draws, ${recoveredCancel} canceled`)
        }
      }
    } catch (err) {
      console.error('[stuck-recovery] Error:', err)
    }
  }, intervalMs)

  return () => clearInterval(timer)
}
