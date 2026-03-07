'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CheckersBoard } from '@/components/board/checkers-board'
import { CreateGameModal } from '@/components/ui/create-game-modal'
import { listGames, createGame, joinGame, getStoredAddress, type GameListItem } from '@/lib/api'

interface GameLobbyProps {
  onJoinGame: (gameId: string) => void
}

export function GameLobby({ onJoinGame }: GameLobbyProps) {
  const router = useRouter()
  const [showLocal, setShowLocal] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [openGames, setOpenGames] = useState<GameListItem[]>([])
  const [activeGames, setActiveGames] = useState<GameListItem[]>([])
  const [loading, setLoading] = useState(true)
  const address = getStoredAddress()

  useEffect(() => {
    loadGames()
  }, [])

  async function loadGames() {
    try {
      const [open, playing] = await Promise.all([
        listGames('waiting').catch(() => ({ games: [] })),
        listGames('playing').catch(() => ({ games: [] })),
      ])
      setOpenGames(open.games)
      setActiveGames(playing.games)
    } catch {
      // API not available — local mode only
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(wager: string, timePerMove: number) {
    const { game } = await createGame(wager, timePerMove)
    setShowCreate(false)
    router.push(`/game/${game.id}`)
  }

  async function handleJoin(gameId: string) {
    await joinGame(gameId)
    router.push(`/game/${gameId}`)
  }

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
        <CheckersBoard gameId="local" playerColor="white" localMode />
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
            <div className="w-10 h-10 bg-board-dark/20 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-board-dark" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="10" />
                <path d="M8 12h8M12 8v8" />
              </svg>
            </div>
            <h3 className="font-semibold text-text group-hover:text-accent transition-colors">Play Locally</h3>
          </div>
          <p className="text-sm text-text-secondary">
            Play with a friend on the same device. No wallet needed.
          </p>
        </button>

        <button
          onClick={() => setShowCreate(true)}
          className="p-6 bg-bg-card border border-border rounded-2xl hover:border-border-hover hover:shadow-md transition-all text-left group"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <h3 className="font-semibold text-text group-hover:text-accent transition-colors">Create Game</h3>
          </div>
          <p className="text-sm text-text-secondary">
            Set wager amount and wait for an opponent.
          </p>
        </button>
      </div>

      {/* Open games */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Open Games</h2>
          <button
            onClick={loadGames}
            className="text-xs text-accent hover:underline"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : openGames.length === 0 ? (
          <div className="border border-dashed border-border rounded-2xl p-12 text-center">
            <p className="text-text-muted">No open games. Create one!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {openGames.map(game => (
              <div
                key={game.id}
                className="flex items-center justify-between p-4 bg-bg-card border border-border rounded-xl hover:border-border-hover transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-piece-black rounded-full" />
                  <div>
                    <p className="text-sm font-medium">
                      {game.blackPlayer?.slice(0, 8)}...{game.blackPlayer?.slice(-4)}
                    </p>
                    <p className="text-xs text-text-muted">
                      {(Number(game.wager) / 1_000_000).toFixed(0)} COIN &middot; {game.timePerMove}s per move
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleJoin(game.id)}
                  disabled={game.blackPlayer === address}
                  className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-xl hover:bg-accent-hover transition-colors disabled:opacity-50"
                >
                  {game.blackPlayer === address ? 'Your game' : 'Join'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active games */}
      {activeGames.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Games in Progress</h2>
          <div className="space-y-3">
            {activeGames.map(game => {
              const isMyGame = game.blackPlayer === address || game.whitePlayer === address
              return (
                <div
                  key={game.id}
                  onClick={() => isMyGame && router.push(`/game/${game.id}`)}
                  className={`flex items-center justify-between p-4 bg-bg-card border border-border rounded-xl transition-colors ${
                    isMyGame ? 'hover:border-accent cursor-pointer' : ''
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex -space-x-2">
                      <div className="w-7 h-7 bg-piece-black rounded-full border-2 border-bg-card" />
                      <div className="w-7 h-7 bg-piece-white rounded-full border-2 border-bg-card" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {game.blackPlayer?.slice(0, 6)}... vs {game.whitePlayer?.slice(0, 6)}...
                      </p>
                      <p className="text-xs text-text-muted">
                        Move {game.moveCount} &middot; {(Number(game.wager) / 1_000_000).toFixed(0)} COIN
                      </p>
                    </div>
                  </div>
                  {isMyGame && (
                    <span className="text-xs px-2 py-1 bg-success/10 text-success rounded-full font-medium">
                      Resume
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Create game modal */}
      {showCreate && (
        <CreateGameModal
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  )
}
