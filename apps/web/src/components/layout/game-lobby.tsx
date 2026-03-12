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
    try {
      await joinGame(gameId)
      router.push(`/game/${gameId}`)
    } catch {
      // If join fails, still navigate to game page — user can join from there
      router.push(`/game/${gameId}`)
    }
  }

  if (showLocal) {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center justify-between w-full max-w-[640px]">
          <button
            onClick={() => { setShowLocal(false); setLocalVariant('russian') }}
            className="text-sm text-text-secondary hover:text-text transition-colors flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" d="M15 19l-7-7 7-7" />
            </svg>
            Назад
          </button>
          <div className="flex items-center gap-1 bg-bg-card border border-border rounded-lg p-0.5">
            <button
              onClick={() => setLocalVariant('russian')}
              className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
                localVariant === 'russian' ? 'bg-accent text-white' : 'text-text-secondary hover:text-text'
              }`}
            >
              Русские
            </button>
            <button
              onClick={() => setLocalVariant('american')}
              className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
                localVariant === 'american' ? 'bg-accent text-white' : 'text-text-secondary hover:text-text'
              }`}
            >
              Американские
            </button>
          </div>
        </div>
        <CheckersBoard gameId="local" playerColor="white" localMode variant={localVariant} />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Hero */}
      <div className="text-center space-y-2 pt-2">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          <span className="text-accent">Шашки</span> на ставку
        </h1>
        <p className="text-text-secondary text-sm">
          Поставь AXM. Обыграй соперника. Забери x2.
        </p>
      </div>

      {/* Action cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={() => setShowLocal(true)}
          className="p-5 bg-bg-card border border-border rounded-xl hover:border-accent/40 hover:shadow-lg transition-all text-left group"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" d="M15 10l-4 4m0 0l-4-4m4 4V3" />
                <rect x="3" y="15" width="18" height="6" rx="2" />
              </svg>
            </div>
            <h3 className="font-semibold text-text group-hover:text-accent transition-colors">Локальная игра</h3>
          </div>
          <p className="text-xs text-text-muted">
            Играть вдвоём на одном устройстве, без кошелька.
          </p>
        </button>

        <button
          onClick={() => isConnected ? setShowCreate(true) : openConnectModal()}
          className="p-5 bg-bg-card border border-border rounded-xl hover:border-accent/40 hover:shadow-lg transition-all text-left group"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-success/10 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <h3 className="font-semibold text-text group-hover:text-success transition-colors">
              {isConnected ? 'Создать игру' : 'Подключить кошелёк'}
            </h3>
          </div>
          <p className="text-xs text-text-muted">
            {isConnected ? 'Установи ставку и жди соперника.' : 'Подключи кошелёк для онлайн-игры.'}
          </p>
        </button>
      </div>

      {/* Open games */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            Открытые игры
          </h2>
          <button
            onClick={loadGames}
            className="text-xs text-accent hover:text-accent-hover transition-colors"
          >
            Обновить
          </button>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }, (_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : openGames.length === 0 ? (
          <div className="border border-dashed border-border rounded-xl p-8 text-center">
            <p className="text-text-muted text-sm">Нет открытых игр. Создайте первую!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {openGames.map(game => (
              <div
                key={game.id}
                className="flex items-center justify-between p-3 sm:p-4 bg-bg-card border border-border rounded-xl hover:border-border-hover transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 bg-piece-black rounded-full border-2 border-[#333] shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium truncate">
                        {game.blackPlayer?.slice(0, 8)}...{game.blackPlayer?.slice(-4)}
                      </p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        game.variant === 'russian' ? 'bg-accent/15 text-accent' : 'bg-warning/15 text-warning'
                      }`}>
                        {game.variant === 'russian' ? 'RUS' : 'USA'}
                      </span>
                    </div>
                    <p className="text-xs text-text-muted mt-0.5">
                      {(Number(game.wager) / 1_000_000).toFixed(0)} AXM &middot; {game.timePerMove}с/ход
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => isConnected ? handleJoin(game.id) : openConnectModal()}
                  disabled={game.blackPlayer === address}
                  className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-40 shrink-0 ml-3"
                >
                  {game.blackPlayer === address ? 'Ваша' : isConnected ? 'Играть' : 'Войти'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active games */}
      {activeGames.length > 0 && (
        <div>
          <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-warning" />
            Идут сейчас
          </h2>
          <div className="space-y-2">
            {activeGames.map(game => {
              const isMyGame = game.blackPlayer === address || game.whitePlayer === address
              return (
                <div
                  key={game.id}
                  onClick={() => router.push(`/game/${game.id}`)}
                  className="flex items-center justify-between p-3 sm:p-4 bg-bg-card border border-border rounded-xl transition-colors hover:border-border-hover cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-2">
                      <div className="w-7 h-7 bg-piece-black rounded-full border-2 border-bg-card" />
                      <div className="w-7 h-7 bg-piece-white rounded-full border-2 border-bg-card" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {game.blackPlayer?.slice(0, 6)}... vs {game.whitePlayer?.slice(0, 6)}...
                      </p>
                      <p className="text-xs text-text-muted">
                        Ход {game.moveCount} &middot; {(Number(game.wager) / 1_000_000).toFixed(0)} AXM
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    isMyGame
                      ? 'bg-success/15 text-success'
                      : 'bg-accent/15 text-accent'
                  }`}>
                    {isMyGame ? 'Продолжить' : 'Наблюдать'}
                  </span>
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
