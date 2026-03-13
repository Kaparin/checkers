import { WebSocketServer, WebSocket } from 'ws'
import type { Server } from 'http'
import type { Db } from '@checkers/db'
import { games, users } from '@checkers/db'
import { WsMessageSchema, WS_EVENTS, calculateElo } from '@checkers/shared'
import { eq, sql } from 'drizzle-orm'
import { verifySessionToken } from '../services/session.service'

interface ConnectedClient {
  ws: WebSocket
  address?: string
  gameId?: string
}

const clients = new Map<WebSocket, ConnectedClient>()
const gameRooms = new Map<string, Set<WebSocket>>()
const lobbyClients = new Set<WebSocket>()

// Track disconnect timers for auto-forfeit
const disconnectTimers = new Map<string, NodeJS.Timeout>() // key: `${gameId}:${address}`

export function setupWebSocket(server: Server, db: Db) {
  const wss = new WebSocketServer({ server, path: '/ws' })

  wss.on('connection', (ws, req) => {
    const client: ConnectedClient = { ws }

    // Authenticate via ?token= query param
    const url = new URL(req.url || '/', `http://${req.headers.host}`)
    const token = url.searchParams.get('token')
    if (token) {
      const session = verifySessionToken(token)
      if (session) {
        client.address = session.address
      }
    }

    clients.set(ws, client)
    lobbyClients.add(ws)

    ws.on('message', (data) => {
      try {
        const raw = JSON.parse(data.toString())
        const parsed = WsMessageSchema.safeParse(raw)
        if (!parsed.success) return

        const msg = parsed.data

        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }))
          return
        }

        if (msg.type === 'join_game') {
          // Leave old room
          if (client.gameId) {
            gameRooms.get(client.gameId)?.delete(ws)
          }
          // Join new room
          client.gameId = msg.gameId
          if (!gameRooms.has(msg.gameId)) {
            gameRooms.set(msg.gameId, new Set())
          }
          gameRooms.get(msg.gameId)!.add(ws)
          lobbyClients.delete(ws)

          // Feature 11: Cancel disconnect timer on reconnect
          if (client.address) {
            const timerKey = `${msg.gameId}:${client.address}`
            const existingTimer = disconnectTimers.get(timerKey)
            if (existingTimer) {
              clearTimeout(existingTimer)
              disconnectTimers.delete(timerKey)
              // Notify room that player reconnected
              broadcastToGame(msg.gameId, {
                type: WS_EVENTS.PLAYER_CONNECTED,
                address: client.address,
              })
            }
          }
          return
        }

        if (msg.type === 'leave_game') {
          if (client.gameId) {
            gameRooms.get(client.gameId)?.delete(ws)
            client.gameId = undefined
          }
          lobbyClients.add(ws)
          return
        }
      } catch {
        // Ignore malformed messages
      }
    })

    ws.on('close', () => {
      const gameId = client.gameId
      const address = client.address

      if (gameId) {
        gameRooms.get(gameId)?.delete(ws)

        // Feature 11: Disconnect detection
        if (address) {
          // Check if this player is still connected via another socket
          let stillConnected = false
          const room = gameRooms.get(gameId)
          if (room) {
            for (const otherWs of room) {
              const otherClient = clients.get(otherWs)
              if (otherClient?.address === address && otherWs.readyState === WebSocket.OPEN) {
                stillConnected = true
                break
              }
            }
          }

          if (!stillConnected) {
            // Broadcast disconnect
            broadcastToGame(gameId, {
              type: WS_EVENTS.PLAYER_DISCONNECTED,
              address,
            })

            // Start 30s auto-forfeit timer
            const timerKey = `${gameId}:${address}`
            const timer = setTimeout(async () => {
              disconnectTimers.delete(timerKey)
              try {
                const [game] = await db.select().from(games).where(eq(games.id, gameId)).limit(1)
                if (!game) return
                if (game.blackPlayer !== address && game.whitePlayer !== address) return

                if (game.status === 'ready_check') {
                  // During ready check, cancel the game instead of forfeit
                  await db.update(games).set({
                    status: 'canceled',
                    finishedAt: new Date(),
                  }).where(eq(games.id, gameId))
                  broadcastToGame(gameId, {
                    type: WS_EVENTS.GAME_CANCELED,
                    reason: 'disconnect',
                  })
                  return
                }

                if (game.status !== 'playing') return

                // Auto-forfeit: disconnected player loses
                const winner = address === game.blackPlayer ? game.whitePlayer : game.blackPlayer
                const winStatus = address === game.blackPlayer ? 'white_wins' : 'black_wins'

                await db.update(games).set({
                  status: winStatus,
                  winner,
                  finishedAt: new Date(),
                  currentTurnDeadline: null,
                }).where(eq(games.id, gameId))

                // Fetch ELO BEFORE updating stats (K-factor depends on gamesPlayed)
                if (winner) {
                  let eloChange = { newRatingWinner: 1200, newRatingLoser: 1200 }
                  const [winnerUser] = await db.select().from(users).where(eq(users.address, winner)).limit(1)
                  const [loserUser] = await db.select().from(users).where(eq(users.address, address)).limit(1)
                  if (winnerUser && loserUser) {
                    eloChange = calculateElo(winnerUser.elo, loserUser.elo, winnerUser.gamesPlayed, loserUser.gamesPlayed)
                  }

                  await db.update(users).set({
                    gamesPlayed: sql`games_played + 1`, gamesWon: sql`games_won + 1`,
                    totalWon: sql`(total_won::bigint + ${game.wager}::bigint)::text`,
                    elo: eloChange.newRatingWinner,
                  }).where(eq(users.address, winner))
                  await db.update(users).set({
                    gamesPlayed: sql`games_played + 1`, gamesLost: sql`games_lost + 1`,
                    elo: eloChange.newRatingLoser,
                  }).where(eq(users.address, address))
                }

                broadcastToGame(gameId, {
                  type: WS_EVENTS.GAME_OVER,
                  winner,
                  reason: 'disconnect',
                })
              } catch (err) {
                console.error(`[ws] Auto-forfeit failed for ${gameId}:`, err)
              }
            }, 30_000)

            disconnectTimers.set(timerKey, timer)
          }
        }
      }

      lobbyClients.delete(ws)
      clients.delete(ws)
    })
  })

  return wss
}

export function broadcastToGame(gameId: string, message: unknown) {
  const room = gameRooms.get(gameId)
  if (!room) return

  const data = JSON.stringify(message)
  for (const ws of room) {
    if (ws.readyState === WebSocket.OPEN) {
      try { ws.send(data) } catch {}
    }
  }
}

export function broadcastToLobby(message: unknown) {
  const data = JSON.stringify(message)
  for (const ws of lobbyClients) {
    if (ws.readyState === WebSocket.OPEN) {
      try { ws.send(data) } catch {}
    }
  }
}
