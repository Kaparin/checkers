'use client'

import { useState } from 'react'

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
    <div className="flex items-center gap-2 px-4 py-3 bg-bg-card border border-border rounded-xl">
      <input
        type="text"
        value={link}
        readOnly
        className="flex-1 text-xs font-mono text-text-secondary bg-transparent outline-none truncate"
      />
      <button
        onClick={handleCopy}
        className="shrink-0 px-3 py-1.5 bg-accent text-white text-xs font-medium rounded-lg hover:bg-accent-hover transition-colors"
      >
        {copied ? 'Скопировано!' : 'Копировать'}
      </button>
    </div>
  )
}
