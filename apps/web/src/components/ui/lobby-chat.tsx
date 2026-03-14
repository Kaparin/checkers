'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { MessagesSquare, Send, X } from 'lucide-react'
import { useWebSocket } from '@/hooks/use-websocket'
import { useWallet } from '@/contexts/wallet-context'
import { getStoredToken } from '@/lib/auth-headers'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface ChatMessage {
  id: string
  sender: string
  text: string
  createdAt: string
}

export function LobbyChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const { address } = useWallet()
  const { subscribe } = useWebSocket()

  // Load history
  useEffect(() => {
    fetch(`${API_URL}/chat/global`)
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
  }, [])

  // Listen for new messages via WS
  useEffect(() => {
    const unsub = subscribe((msg) => {
      if (msg.type === 'chat:global' && msg.message) {
        const m = msg.message as ChatMessage
        setMessages(prev => {
          const next = [...prev, m]
          return next.length > 200 ? next.slice(-200) : next
        })
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
      const token = getStoredToken()
      const res = await fetch(`${API_URL}/chat/global`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ message: input.trim() }),
      })
      if (!res.ok) throw new Error('Send failed')
      setInput('')
    } catch {
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`,
        sender: 'system',
        text: 'Не удалось отправить сообщение',
        createdAt: new Date().toISOString(),
      }])
    }
    setSending(false)
  }, [input, sending, address])

  const shortAddr = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-3)}`

  if (!isOpen) {
    return (
      <button
        onClick={() => { setIsOpen(true); setUnread(0) }}
        className="fixed bottom-4 left-4 z-30 w-12 h-12 bg-bg-card border border-border text-text-secondary rounded-full shadow-lg flex items-center justify-center hover:border-accent hover:text-accent transition-colors"
        title="Общий чат"
      >
        <MessagesSquare className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
    )
  }

  return (
    <div className="fixed bottom-4 left-4 z-30 w-80 h-96 bg-bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-bg-subtle shrink-0">
        <div className="flex items-center gap-2">
          <MessagesSquare className="w-3.5 h-3.5 text-text-muted" />
          <span className="text-xs font-semibold text-text">Общий чат</span>
        </div>
        <button onClick={() => setIsOpen(false)} className="text-text-muted hover:text-text transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 text-xs">
        {messages.length === 0 && (
          <p className="text-text-muted text-center py-8">Сообщений пока нет</p>
        )}
        {messages.map(m => {
          const isMe = m.sender === address
          return (
            <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              <span className="text-[10px] text-text-muted mb-0.5">
                {isMe ? 'Вы' : shortAddr(m.sender)}
              </span>
              <div className={`max-w-[85%] px-2.5 py-1.5 rounded-xl break-words ${
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
        <div className="flex items-center gap-2 p-2.5 border-t border-border shrink-0">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Сообщение..."
            maxLength={200}
            className="flex-1 bg-bg-subtle border border-border rounded-xl px-3 py-1.5 text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-border-hover transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="p-1.5 bg-accent text-white rounded-xl disabled:opacity-50 hover:bg-accent-hover transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="p-2.5 border-t border-border text-center text-[10px] text-text-muted">
          Подключите кошелёк для чата
        </div>
      )}
    </div>
  )
}
