/**
 * Indexer Service — polls Axiome chain for checkers contract events,
 * syncs on-chain game state with PostgreSQL.
 *
 * Events emitted by the contract (wasm attributes):
 *   - action=create_game, game_id, creator, wager
 *   - action=join_game, game_id, opponent
 *   - action=resolve_game, game_id, winner, payout, commission
 *   - action=resolve_draw, game_id
 *   - action=cancel_game, game_id
 *   - action=claim_timeout, game_id, claimer, payout
 */

import { StargateClient } from '@cosmjs/stargate'
import { AXIOME_REST, AXIOME_RPC } from '@checkers/shared/chain'
import { games } from '@checkers/db'
import type { Db } from '@checkers/db'
import { eq, and, notInArray } from 'drizzle-orm'
import { broadcastToGame, broadcastToLobby } from '../ws/handler'
import { WS_EVENTS } from '@checkers/shared'

interface WasmEvent {
  txHash: string
  action: string
  attrs: Record<string, string>
  height: number
}

export class IndexerService {
  private db: Db | null = null
  private contractAddress: string = ''
  private lastHeight = 0
  private polling = false
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private processedTxs = new Set<string>()

  async init(db: Db) {
    this.db = db
    this.contractAddress = process.env.CHECKERS_CONTRACT || ''
    if (!this.contractAddress) {
      console.warn('[indexer] CHECKERS_CONTRACT not set — indexer disabled')
      return
    }

    // Get current block height
    try {
      const client = await StargateClient.connect(AXIOME_RPC)
      this.lastHeight = await client.getHeight()
      client.disconnect()
      console.log(`[indexer] Starting from block ${this.lastHeight}`)
    } catch (err) {
      console.error('[indexer] Failed to get initial height:', err)
    }
  }

  start(intervalMs = 3000) {
    if (!this.contractAddress || !this.db) {
      console.warn('[indexer] Not starting — not initialized')
      return
    }

    this.pollTimer = setInterval(() => {
      if (!this.polling) {
        this.polling = true
        this.pollNewBlocks().finally(() => { this.polling = false })
      }
    }, intervalMs)

    console.log(`[indexer] Polling every ${intervalMs}ms`)
  }

  stop() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
  }

  // ── Block polling ───────────────────────────────────────────────

  private async pollNewBlocks() {
    try {
      const client = await StargateClient.connect(AXIOME_RPC)
      const currentHeight = await client.getHeight()
      client.disconnect()

      if (currentHeight <= this.lastHeight) return

      // Process up to 10 blocks per poll
      const endHeight = Math.min(this.lastHeight + 10, currentHeight)

      for (let h = this.lastHeight + 1; h <= endHeight; h++) {
        await this.processBlock(h)
      }

      this.lastHeight = endHeight
    } catch (err) {
      console.error('[indexer] Poll error:', err)
    }
  }

  private async processBlock(height: number) {
    try {
      const url = `${AXIOME_REST}/cosmos/tx/v1beta1/txs?query=tx.height=${height}&pagination.limit=100`
      const res = await fetch(url)
      if (!res.ok) return

      const data = await res.json() as any
      const txResponses = data.tx_responses || []

      for (const tx of txResponses) {
        if (tx.code !== 0) continue // skip failed txs
        const events = this.extractWasmEvents(tx)
        for (const event of events) {
          await this.handleEvent(event)
        }
      }
    } catch (err) {
      console.error(`[indexer] Block ${height} error:`, err)
    }
  }

  // ── Event extraction ────────────────────────────────────────────

  private extractWasmEvents(tx: any): WasmEvent[] {
    const results: WasmEvent[] = []
    const txHash = tx.txhash

    for (const event of (tx.events || [])) {
      if (event.type !== 'wasm') continue

      const attrs: Record<string, string> = {}
      let isOurContract = false

      for (const attr of (event.attributes || [])) {
        const key = attr.key
        const value = attr.value
        if (key === '_contract_address' && value === this.contractAddress) {
          isOurContract = true
        }
        attrs[key] = value
      }

      if (isOurContract && attrs.action) {
        results.push({ txHash, action: attrs.action, attrs, height: tx.height })
      }
    }

    return results
  }

  // ── Event handling ──────────────────────────────────────────────

  private async handleEvent(event: WasmEvent) {
    // Deduplication
    const key = `${event.txHash}:${event.action}:${event.attrs.game_id || ''}`
    if (this.processedTxs.has(key)) return
    this.processedTxs.add(key)

    // Keep set bounded
    if (this.processedTxs.size > 10_000) {
      const entries = [...this.processedTxs]
      this.processedTxs = new Set(entries.slice(-5_000))
    }

    const db = this.db!
    const gameId = event.attrs.game_id

    console.log(`[indexer] Event: ${event.action} game=${gameId} tx=${event.txHash.slice(0, 12)}...`)

    try {
      switch (event.action) {
        case 'create_game': {
          // Game created on chain — update tx hash
          // The game should already exist in DB (created via API first)
          // We match by looking for waiting games from this creator
          const creator = event.attrs.creator
          if (creator && gameId) {
            await db.update(games).set({
              txHashCreate: event.txHash,
            }).where(eq(games.id, gameId))
          }
          break
        }

        case 'join_game': {
          // Game joined on chain
          if (gameId) {
            await db.update(games).set({
              txHashJoin: event.txHash,
            }).where(eq(games.id, gameId))
          }
          break
        }

        case 'resolve_game': {
          // Game resolved with winner — terminal state protection
          const winner = event.attrs.winner
          if (gameId && winner) {
            // Only update if not already in terminal state
            const [game] = await db.select().from(games).where(eq(games.id, gameId)).limit(1)
            if (game && !['black_wins', 'white_wins', 'draw', 'timeout'].includes(game.status)) {
              const winStatus = winner === game.blackPlayer ? 'black_wins' : 'white_wins'
              await db.update(games).set({
                status: winStatus,
                winner,
                txHashResolve: event.txHash,
                finishedAt: new Date(),
                currentTurnDeadline: null,
              }).where(eq(games.id, gameId))

              broadcastToGame(gameId, {
                type: WS_EVENTS.GAME_OVER,
                winner,
                reason: 'resolve',
                txHash: event.txHash,
              })
            }
          }
          break
        }

        case 'resolve_draw': {
          if (gameId) {
            const [game] = await db.select().from(games).where(eq(games.id, gameId)).limit(1)
            if (game && !['black_wins', 'white_wins', 'draw', 'timeout'].includes(game.status)) {
              await db.update(games).set({
                status: 'draw',
                txHashResolve: event.txHash,
                finishedAt: new Date(),
                currentTurnDeadline: null,
              }).where(eq(games.id, gameId))

              broadcastToGame(gameId, {
                type: WS_EVENTS.GAME_OVER,
                reason: 'draw',
                txHash: event.txHash,
              })
            }
          }
          break
        }

        case 'cancel_game': {
          if (gameId) {
            await db.update(games).set({
              status: 'canceled',
              finishedAt: new Date(),
            }).where(
              and(eq(games.id, gameId), eq(games.status, 'waiting'))
            )
            broadcastToLobby({ type: WS_EVENTS.GAME_CANCELED, gameId })
          }
          break
        }

        case 'claim_timeout': {
          const claimer = event.attrs.claimer
          if (gameId && claimer) {
            const [game] = await db.select().from(games).where(eq(games.id, gameId)).limit(1)
            if (game && !['black_wins', 'white_wins', 'draw', 'timeout'].includes(game.status)) {
              await db.update(games).set({
                status: 'timeout',
                winner: claimer,
                txHashResolve: event.txHash,
                finishedAt: new Date(),
                currentTurnDeadline: null,
              }).where(eq(games.id, gameId))

              broadcastToGame(gameId, {
                type: WS_EVENTS.GAME_TIMEOUT,
                winner: claimer,
                txHash: event.txHash,
              })
            }
          }
          break
        }
      }
    } catch (err) {
      console.error(`[indexer] Failed to handle event ${event.action}:`, err)
    }
  }
}

// Singleton
export const indexer = new IndexerService()
