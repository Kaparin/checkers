'use client'

import { useState } from 'react'
import { Link2, Copy, Check } from 'lucide-react'

interface InviteLinkProps {
  gameId: string
}

export function InviteLink({ gameId }: InviteLinkProps) {
  const [copied, setCopied] = useState(false)

  const link = typeof window !== 'undefined'
    ? `${window.location.origin}/game/${gameId}`
    : ''

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
      const input = document.createElement('input')
      input.value = link
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-bg-card border border-border rounded-2xl">
      <Link2 className="w-4 h-4 text-text-muted shrink-0" />
      <input
        type="text"
        value={link}
        readOnly
        className="flex-1 text-xs font-mono text-text-secondary bg-transparent outline-none truncate"
      />
      <button
        onClick={handleCopy}
        className={`shrink-0 px-3 py-1.5 text-xs font-medium rounded-xl transition-colors flex items-center gap-1.5 ${
          copied
            ? 'bg-success/10 text-success border border-success/20'
            : 'bg-accent text-white hover:bg-accent-hover'
        }`}
      >
        {copied ? (
          <>
            <Check className="w-3.5 h-3.5" />
            Скопировано!
          </>
        ) : (
          <>
            <Copy className="w-3.5 h-3.5" />
            Копировать
          </>
        )}
      </button>
    </div>
  )
}
