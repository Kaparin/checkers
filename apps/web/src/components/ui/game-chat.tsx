'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useWebSocket } from '@/hooks/use-websocket'
import { useWallet } from '@/contexts/wallet-context'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface ChatMessage {
  id: string
  sender: string
  text: string
  createdAt: string
}

export function GameChat({ gameId }: { gameId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const { address } = useWallet()
  const { subscribe } = useWebSocket(gameId)

  // Load history
  useEffect(() => {
    fetch(`${API_URL}/chat/game/${gameId}`)
      .then(r => r.json())
      .then(data => {
        if (data.messages) {
          setMessages(data.messages.map((m: any) => ({
            id: m.id,
            sender: m.senderAddress,
            text: m.message,
            createdAt: m.createdAt,
          })))
        }
      })
      .catch(() => {})
  }, [gameId])

  // Listen for new messages via WS
  useEffect(() => {
    const unsub = subscribe((msg) => {
      if (msg.type === 'chat:message' && msg.message) {
        const m = msg.message as ChatMessage
        setMessages(prev => [...prev, m])
        if (!isOpen) setUnread(u => u + 1)
      }
    })
    return unsub
  }, [subscribe, isOpen])

  // Auto-scroll
  useEffect(() => {
    if (isOpen) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isOpen])

  const handleSend = useCallback(async () => {
    if (!input.trim() || sending || !address) return
    setSending(true)
    try {
      const token = typeof window !== 'undefined' ? sessionStorage.getItem('auth_token') : null
      await fetch(`${API_URL}/chat/game/${gameId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ message: input.trim() }),
      })
      setInput('')
    } catch {}
    setSending(false)
  }, [input, sending, address, gameId])

  const shortAddr = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-3)}`

  if (!isOpen) {
    return (
      <button
        onClick={() => { setIsOpen(true); setUnread(0) }}
        className="fixed bottom-4 right-4 z-30 w-11 h-11 bg-accent text-white rounded-full shadow-lg flex items-center justify-center hover:bg-accent-hover transition-colors"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 z-30 w-72 h-80 bg-bg-card border border-border rounded-xl shadow-xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-bg-subtle shrink-0">
        <span className="text-xs font-semibold text-text">Chat</span>
        <button onClick={() => setIsOpen(false)} className="text-text-muted hover:text-text text-sm">&times;</button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 text-xs">
        {messages.length === 0 && (
          <p className="text-text-muted text-center py-4">No messages yet</p>
        )}
        {messages.map(m => {
          const isMe = m.sender === address
          return (
            <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              <span className="text-[10px] text-text-muted mb-0.5">
                {isMe ? 'You' : shortAddr(m.sender)}
              </span>
              <div className={`max-w-[85%] px-2.5 py-1.5 rounded-lg ${
                isMe ? 'bg-accent text-white' : 'bg-bg-subtle text-text'
              }`}>
                {m.text}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {address ? (
        <div className="flex items-center gap-1.5 p-2 border-t border-border shrink-0">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Message..."
            maxLength={200}
            className="flex-1 bg-bg-subtle border border-border rounded-lg px-2 py-1.5 text-xs placeholder:text-text-muted"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="px-2 py-1.5 bg-accent text-white text-xs font-medium rounded-lg disabled:opacity-50"
          >
            Send
          </button>
        </div>
      ) : (
        <div className="p-2 border-t border-border text-center text-[10px] text-text-muted">
          Connect wallet to chat
        </div>
      )}
    </div>
  )
}
