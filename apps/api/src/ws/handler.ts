import { WebSocketServer, WebSocket } from 'ws'
import type { Server } from 'http'
import type { Db } from '@checkers/db'
import { WsMessageSchema } from '@checkers/shared'
import { verifySessionToken } from '../services/session.service'

interface ConnectedClient {
  ws: WebSocket
  address?: string
  gameId?: string
}

const clients = new Map<WebSocket, ConnectedClient>()
const gameRooms = new Map<string, Set<WebSocket>>()
const lobbyClients = new Set<WebSocket>()

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
      if (client.gameId) {
        gameRooms.get(client.gameId)?.delete(ws)
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
      ws.send(data)
    }
  }
}

export function broadcastToLobby(message: unknown) {
  const data = JSON.stringify(message)
  for (const ws of lobbyClients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data)
    }
  }
}
