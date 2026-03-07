'use client'

import { useState } from 'react'
import { CheckersBoard } from '@/components/board/checkers-board'

interface GameLobbyProps {
  onJoinGame: (gameId: string) => void
}

export function GameLobby({ onJoinGame }: GameLobbyProps) {
  const [showLocal, setShowLocal] = useState(false)

  if (showLocal) {
    return (
      <div className="flex flex-col items-center gap-6">
        <div className="flex items-center justify-between w-full max-w-xl">
          <button
            onClick={() => setShowLocal(false)}
            className="text-sm text-text-secondary hover:text-text transition-colors"
          >
            &larr; Back to lobby
          </button>
          <span className="text-sm font-medium text-text-secondary">Local Game (2 players)</span>
        </div>
        <LocalGame />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Hero */}
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">Play Checkers</h1>
        <p className="text-text-secondary">
          Wager COIN tokens. Beat your opponent. Win double.
        </p>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          onClick={() => setShowLocal(true)}
          className="p-6 bg-bg-card border border-border rounded-2xl hover:border-border-hover hover:shadow-md transition-all text-left group"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </div>
            <h3 className="font-semibold text-text group-hover:text-accent transition-colors">Play Locally</h3>
          </div>
          <p className="text-sm text-text-secondary">
            Play with a friend on the same device. No wallet needed.
          </p>
        </button>

        <button
          disabled
          className="p-6 bg-bg-card border border-border rounded-2xl opacity-60 text-left"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-success/10 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <h3 className="font-semibold text-text">Create Game</h3>
          </div>
          <p className="text-sm text-text-secondary">
            Set wager amount and wait for an opponent. Coming soon.
          </p>
        </button>
      </div>

      {/* Open games (placeholder) */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Open Games</h2>
        <div className="border border-dashed border-border rounded-2xl p-12 text-center">
          <p className="text-text-muted">No open games yet. Create one to start!</p>
        </div>
      </div>
    </div>
  )
}

/** Local 2-player game (no server, just engine) */
function LocalGame() {
  return <CheckersBoard gameId="local" playerColor="white" localMode />
}
