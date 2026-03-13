import { lt, eq, and, isNotNull } from 'drizzle-orm'
import { games, users, txEvents, treasuryLedger } from '@checkers/db'
import type { Db } from '@checkers/db'
import { broadcastToGame } from '../ws/handler'
import { WS_EVENTS, calculateElo } from '@checkers/shared'
import { sql } from 'drizzle-orm'
import { relayer } from './relayer'
import { ReferralService } from './referral.service'
import { JackpotService } from './jackpot.service'

/**
 * Periodically checks for games where the current turn deadline has passed.
 * The player who ran out of time loses.
 */
export function startTimeoutChecker(db: Db, intervalMs = 5000) {
  const timer = setInterval(async () => {
    try {
      const now = new Date()

      // Find playing games past their deadline (DB-level filter)
      const timedOut = await db
        .select()
        .from(games)
        .where(and(
          eq(games.status, 'playing'),
          isNotNull(games.currentTurnDeadline),
          lt(games.currentTurnDeadline, now),
        ))

      for (const game of timedOut) {
        // Parse current turn from game state
        let stateData: Record<string, unknown>
        try {
          stateData = typeof game.gameState === 'string'
            ? JSON.parse(game.gameState)
            : game.gameState as Record<string, unknown>
        } catch {
          console.error(`[timeout] Failed to parse gameState for ${game.id}`)
          continue
        }
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

        // Fetch current ELO BEFORE updating stats (K-factor depends on gamesPlayed)
        let eloChange = { newRatingWinner: 1200, newRatingLoser: 1200 }
        if (winner && loser) {
          const [winnerUser] = await db.select().from(users).where(eq(users.address, winner)).limit(1)
          const [loserUser] = await db.select().from(users).where(eq(users.address, loser)).limit(1)
          if (winnerUser && loserUser) {
            eloChange = calculateElo(winnerUser.elo, loserUser.elo, winnerUser.gamesPlayed, loserUser.gamesPlayed)
          }
        }

        // Update stats + ELO together
        if (winner) {
          await db.update(users).set({
            gamesPlayed: sql`games_played + 1`,
            gamesWon: sql`games_won + 1`,
            totalWon: sql`(total_won::bigint + ${game.wager}::bigint)::text`,
            totalWagered: sql`(total_wagered::bigint + ${game.wager}::bigint)::text`,
            elo: eloChange.newRatingWinner,
          }).where(eq(users.address, winner))
        }
        if (loser) {
          await db.update(users).set({
            gamesPlayed: sql`games_played + 1`,
            gamesLost: sql`games_lost + 1`,
            totalWagered: sql`(total_wagered::bigint + ${game.wager}::bigint)::text`,
            elo: eloChange.newRatingLoser,
          }).where(eq(users.address, loser))
        }

        // Record commission + referral rewards
        const commission = String(Math.floor(Number(game.wager) * 2 * 0.1))
        if (Number(commission) > 0) {
          db.insert(treasuryLedger).values({
            source: 'game_commission',
            amount: commission,
            gameId: game.id,
          }).catch(() => {})

          if (winner) {
            // Distribute referral rewards from commission
            const referralService = new ReferralService(db)
            referralService.distributeRewards(winner, commission, game.id).catch(() => {})

            // Contribute to jackpot pools
            const jackpotService = new JackpotService(db)
            jackpotService.contribute(game.id, winner, commission).catch(() => {})
          }
        }

        // Log event
        db.insert(txEvents).values({
          action: 'claim_timeout',
          address: loser,
          gameId: game.id,
          details: `${loser} timed out, ${winner} wins`,
        }).catch(() => {})

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
