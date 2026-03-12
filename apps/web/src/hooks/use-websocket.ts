'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { getStoredToken } from '@/lib/auth-headers'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001/ws'

type MessageHandler = (data: Record<string, unknown>) => void

export function useWebSocket(gameId?: string) {
  const wsRef = useRef<WebSocket | null>(null)
  const handlersRef = useRef<Set<MessageHandler>>(new Set<MessageHandler>())
  const [connected, setConnected] = useState(false)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectAttempt = useRef(0)

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    try {
      // Pass auth token via query param for WS authentication
      const token = getStoredToken()
      const url = token ? `${WS_URL}?token=${encodeURIComponent(token)}` : WS_URL
      const ws = new WebSocket(url)

      ws.onopen = () => {
        setConnected(true)
        reconnectAttempt.current = 0

        // Join game room if gameId provided
        if (gameId) {
          ws.send(JSON.stringify({ type: 'join_game', gameId }))
        }
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          for (const handler of handlersRef.current) {
            handler(data)
          }
        } catch {
          // ignore
        }
      }

      ws.onclose = () => {
        setConnected(false)
        wsRef.current = null

        // Exponential backoff reconnect (max 50 attempts)
        if (reconnectAttempt.current < 50) {
          const delay = Math.min(1000 * 2 ** reconnectAttempt.current, 30000)
          reconnectAttempt.current++
          reconnectTimer.current = setTimeout(connect, delay)
        }
      }

      ws.onerror = () => {
        ws.close()
      }

      wsRef.current = ws
    } catch {
      // ignore connection errors, will reconnect
    }
  }, [gameId])

  useEffect(() => {
    connect()
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [connect])

  // Re-join room when gameId changes
  useEffect(() => {
    if (gameId && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'join_game', gameId }))
    }
  }, [gameId])

  const subscribe = useCallback((handler: MessageHandler) => {
    handlersRef.current.add(handler)
    return () => { handlersRef.current.delete(handler) }
  }, [])

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    }
  }, [])

  return { connected, subscribe, send }
}
