'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { CheckersBoard } from '@/components/board/checkers-board'
import { CreateGameModal } from '@/components/ui/create-game-modal'
import { useWebSocket } from '@/hooks/use-websocket'
import { listGames, createGame, joinGame, applyReferralCode, type GameListItem } from '@/lib/api'
import { useWallet } from '@/contexts/wallet-context'
import { SkeletonCard } from '@/components/ui/skeleton'

interface GameLobbyProps {
  onJoinGame: (gameId: string) => void
}

export function GameLobby({ onJoinGame }: GameLobbyProps) {
  const router = useRouter()
  const [showLocal, setShowLocal] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [localVariant, setLocalVariant] = useState<'russian' | 'american'>('russian')
  const [openGames, setOpenGames] = useState<GameListItem[]>([])
  const [activeGames, setActiveGames] = useState<GameListItem[]>([])
  const [loading, setLoading] = useState(true)
  const { address, isConnected, openConnectModal } = useWallet()
  const { subscribe } = useWebSocket()

  // Save referral code from URL (?ref=CODE) to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const ref = params.get('ref')
    if (ref) {
      localStorage.setItem('pending_referral', ref.toUpperCase())
      // Clean URL
      const url = new URL(window.location.href)
      url.searchParams.delete('ref')
      window.history.replaceState({}, '', url.pathname)
    }
  }, [])

  // Auto-apply pending referral code after wallet connects
  useEffect(() => {
    if (!isConnected) return
    const pending = localStorage.getItem('pending_referral')
    if (pending) {
      localStorage.removeItem('pending_referral')
      applyReferralCode(pending).catch(() => {})
    }
  }, [isConnected])

  useEffect(() => {
    loadGames()
  }, [])

  // Auto-refresh lobby when games are created/joined/canceled
  useEffect(() => {
    const unsub = subscribe((msg) => {
      if (msg.type === 'game:created' || msg.type === 'game:joined' || msg.type === 'game:canceled') {
        loadGames()
      }
    })
    return unsub
  }, [subscribe])

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

  async function handleCreate(wager: string, timePerMove: number, variant: 'russian' | 'american') {
    const { game } = await createGame(wager, timePerMove, variant)
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
            onClick={() => { setShowLocal(false); setLocalVariant('russian') }}
            className="text-sm text-text-secondary hover:text-text transition-colors"
          >
            &larr; Back to lobby
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLocalVariant('russian')}
              className={`text-xs px-2 py-1 rounded-lg font-medium transition-colors ${
                localVariant === 'russian' ? 'bg-accent text-white' : 'bg-bg-subtle text-text-secondary'
              }`}
            >
              Russian
            </button>
            <button
              onClick={() => setLocalVariant('american')}
              className={`text-xs px-2 py-1 rounded-lg font-medium transition-colors ${
                localVariant === 'american' ? 'bg-accent text-white' : 'bg-bg-subtle text-text-secondary'
              }`}
            >
              American
            </button>
          </div>
        </div>
        <CheckersBoard gameId="local" playerColor="white" localMode variant={localVariant} />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Hero */}
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">Play Checkers</h1>
        <p className="text-text-secondary">
          Wager AXM. Beat your opponent. Win double.
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
          onClick={() => isConnected ? setShowCreate(true) : openConnectModal()}
          className="p-6 bg-bg-card border border-border rounded-2xl hover:border-border-hover hover:shadow-md transition-all text-left group"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <h3 className="font-semibold text-text group-hover:text-accent transition-colors">
              {isConnected ? 'Create Game' : 'Connect Wallet'}
            </h3>
          </div>
          <p className="text-sm text-text-secondary">
            {isConnected ? 'Set wager amount and wait for an opponent.' : 'Connect your wallet to play online.'}
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
          <div className="space-y-3">
            {Array.from({ length: 3 }, (_, i) => (
              <SkeletonCard key={i} />
            ))}
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
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">
                        {game.blackPlayer?.slice(0, 8)}...{game.blackPlayer?.slice(-4)}
                      </p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        game.variant === 'russian' ? 'bg-accent/10 text-accent' : 'bg-board-dark/10 text-board-dark'
                      }`}>
                        {game.variant === 'russian' ? 'RUS' : 'USA'}
                      </span>
                    </div>
                    <p className="text-xs text-text-muted">
                      {(Number(game.wager) / 1_000_000).toFixed(0)} AXM &middot; {game.timePerMove}s per move
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => isConnected ? handleJoin(game.id) : openConnectModal()}
                  disabled={game.blackPlayer === address}
                  className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-xl hover:bg-accent-hover transition-colors disabled:opacity-50"
                >
                  {game.blackPlayer === address ? 'Your game' : isConnected ? 'Join' : 'Connect'}
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
                        Move {game.moveCount} &middot; {(Number(game.wager) / 1_000_000).toFixed(0)} AXM
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
