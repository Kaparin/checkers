'use client'

import { useState, useEffect } from 'react'
import { Info, AlertTriangle, Gift, Megaphone, X } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface Announcement {
  id: string
  title: string
  body: string
  type: 'info' | 'warning' | 'promo' | 'update'
}

const TYPE_STYLES: Record<string, string> = {
  info: 'bg-accent/10 border-accent/20',
  warning: 'bg-warning/10 border-warning/20',
  promo: 'bg-success/10 border-success/20',
  update: 'bg-accent/10 border-accent/20',
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  info: <Info className="w-4 h-4 text-accent shrink-0 mt-0.5" />,
  warning: <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />,
  promo: <Gift className="w-4 h-4 text-success shrink-0 mt-0.5" />,
  update: <Megaphone className="w-4 h-4 text-accent shrink-0 mt-0.5" />,
}

const TYPE_TEXT: Record<string, string> = {
  info: 'text-accent',
  warning: 'text-warning',
  promo: 'text-success',
  update: 'text-accent',
}

export function AnnouncementsBanner() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch(`${API_URL}/events/announcements/active`)
      .then(r => r.json())
      .then(data => {
        if (data.announcements) setAnnouncements(data.announcements)
      })
      .catch(() => {})
  }, [])

  const visible = announcements.filter(a => !dismissed.has(a.id))
  if (visible.length === 0) return null

  return (
    <div className="space-y-2 mb-4">
      {visible.map(a => (
        <div key={a.id} className={`flex items-start gap-3 px-4 py-3 border rounded-2xl ${TYPE_STYLES[a.type] || TYPE_STYLES.info}`}>
          {TYPE_ICONS[a.type] || TYPE_ICONS.info}
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold ${TYPE_TEXT[a.type] || TYPE_TEXT.info}`}>{a.title}</p>
            <p className="text-xs text-text-secondary mt-0.5">{a.body}</p>
          </div>
          <button
            onClick={() => setDismissed(prev => new Set(prev).add(a.id))}
            className="text-text-muted hover:text-text transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
