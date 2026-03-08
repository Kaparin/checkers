import { lt, eq } from 'drizzle-orm'
import { games, users } from '@checkers/db'
import type { Db } from '@checkers/db'
import { broadcastToGame } from '../ws/handler'
import { WS_EVENTS } from '@checkers/shared'
import { sql } from 'drizzle-orm'
import { relayer } from './relayer'

/**
 * Periodically checks for games where the current turn deadline has passed.
 * The player who ran out of time loses.
 */
export function startTimeoutChecker(db: Db, intervalMs = 5000) {
  const timer = setInterval(async () => {
    try {
      const now = new Date()

      // Find playing games past their deadline
      const timedOut = await db
        .select()
        .from(games)
        .where(eq(games.status, 'playing'))
        .then(rows => rows.filter(g =>
          g.currentTurnDeadline && new Date(g.currentTurnDeadline) < now
        ))

      for (const game of timedOut) {
        // Parse current turn from game state
        const stateData = JSON.parse(game.gameState as string)
        const currentTurn = stateData.t || stateData.currentTurn

        // The player whose turn it was loses
        const loser = currentTurn === 'black' ? game.blackPlayer : game.whitePlayer
        const winner = currentTurn === 'black' ? game.whitePlayer : game.blackPlayer

        await db.update(games).set({
          status: 'timeout',
          winner,
          finishedAt: now,
          currentTurnDeadline: null,
        }).where(eq(games.id, game.id))

        // Update stats
        if (winner) {
          await db.update(users).set({
            gamesPlayed: sql`games_played + 1`,
            gamesWon: sql`games_won + 1`,
            totalWon: sql`(total_won::bigint + ${game.wager}::bigint)::text`,
          }).where(eq(users.address, winner))
        }
        if (loser) {
          await db.update(users).set({
            gamesPlayed: sql`games_played + 1`,
            gamesLost: sql`games_lost + 1`,
          }).where(eq(users.address, loser))
        }

        broadcastToGame(game.id, {
          type: WS_EVENTS.GAME_TIMEOUT,
          winner,
          loser,
        })

        console.log(`[timeout] Game ${game.id}: ${loser} timed out, ${winner} wins`)

        // Background: resolve on-chain
        if (relayer.isReady && game.onChainGameId && winner && game.wager !== '0') {
          relayer.relayResolveGame(game.onChainGameId, winner).then(txHash => {
            console.log(`[relay:timeout] Game ${game.id} tx=${txHash.slice(0, 12)}...`)
            db.update(games).set({ txHashResolve: txHash }).where(eq(games.id, game.id))
          }).catch(err => {
            console.error(`[relay:timeout] Game ${game.id} failed:`, err?.message || err)
          })
        }
      }
    } catch (err) {
      console.error('[timeout-checker] Error:', err)
    }
  }, intervalMs)

  return () => clearInterval(timer)
}
