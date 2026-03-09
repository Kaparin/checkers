'use client'

import { useState, useEffect } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface Announcement {
  id: string
  title: string
  body: string
  type: 'info' | 'warning' | 'promo' | 'update'
}

const TYPE_STYLES: Record<string, string> = {
  info: 'bg-accent/10 border-accent/20 text-accent',
  warning: 'bg-warning/10 border-warning/20 text-warning',
  promo: 'bg-success/10 border-success/20 text-success',
  update: 'bg-accent/10 border-accent/20 text-accent',
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
        <div key={a.id} className={`flex items-start gap-3 px-4 py-3 border rounded-xl ${TYPE_STYLES[a.type] || TYPE_STYLES.info}`}>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">{a.title}</p>
            <p className="text-xs opacity-80 mt-0.5">{a.body}</p>
          </div>
          <button
            onClick={() => setDismissed(prev => new Set(prev).add(a.id))}
            className="text-sm opacity-50 hover:opacity-100 transition-opacity shrink-0"
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  )
}
