'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { CheckersBoard } from '@/components/board/checkers-board'
import { CreateGameModal } from '@/components/ui/create-game-modal'
import { useWebSocket } from '@/hooks/use-websocket'
import { listGames, createGame, joinGame, cancelGame, applyReferralCode, type GameListItem } from '@/lib/api'
import { useWallet } from '@/contexts/wallet-context'
import { Plus, Monitor, Swords, Eye, ArrowLeft, Loader2, RefreshCw, Zap, Users, TrendingUp, X } from 'lucide-react'

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
  const [joiningGameId, setJoiningGameId] = useState<string | null>(null)
  const [cancelingGameId, setCancelingGameId] = useState<string | null>(null)
  const { address, isConnected, openConnectModal } = useWallet()
  const { subscribe } = useWebSocket()

  // Save referral code from URL
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

  // Auto-apply pending referral
  useEffect(() => {
    if (!isConnected) return
    const pending = localStorage.getItem('pending_referral')
    if (pending) {
      localStorage.removeItem('pending_referral')
      applyReferralCode(pending).catch(() => {})
    }
  }, [isConnected])

  useEffect(() => { loadGames() }, [])

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
      // API not available
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(wager: string, timePerMove: number, variant: 'russian' | 'american') {
    const { game } = await createGame(wager, timePerMove, variant)
    setShowCreate(false)
    router.push(`/game/${game.id}`)
  }

  async function handleCancel(gameId: string) {
    if (cancelingGameId) return
    setCancelingGameId(gameId)
    try {
      await cancelGame(gameId)
      loadGames()
    } catch {
      // Still refresh — game might have been canceled
      loadGames()
    } finally {
      setCancelingGameId(null)
    }
  }

  async function handleJoin(gameId: string) {
    if (joiningGameId) return
    setJoiningGameId(gameId)
    try {
      await joinGame(gameId)
      router.push(`/game/${gameId}`)
    } catch {
      router.push(`/game/${gameId}`)
    } finally {
      setJoiningGameId(null)
    }
  }

  // ── Local game mode ──
  if (showLocal) {
    return (
      <div className="flex flex-col items-center gap-6">
        <div className="flex items-center justify-between w-full max-w-[640px]">
          <button
            onClick={() => { setShowLocal(false); setLocalVariant('russian') }}
            className="flex items-center gap-2 text-sm text-text-secondary hover:text-text transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Назад в лобби
          </button>
          <div className="flex items-center bg-bg-card border border-border rounded-xl p-1">
            {(['russian', 'american'] as const).map(v => (
              <button
                key={v}
                onClick={() => setLocalVariant(v)}
                className={`text-xs px-3.5 py-1.5 rounded-lg font-medium transition-all ${
                  localVariant === v
                    ? 'bg-accent text-white shadow-sm'
                    : 'text-text-secondary hover:text-text'
                }`}
              >
                {v === 'russian' ? 'Русские' : 'Американские'}
              </button>
            ))}
          </div>
        </div>
        <CheckersBoard gameId="local" playerColor="white" localMode variant={localVariant} />
      </div>
    )
  }

  // ── Lobby ──
  return (
    <div className="space-y-8">
      {/* Hero section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-bg-subtle via-bg-card to-bg-subtle border border-border p-8 sm:p-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(32,129,226,0.08),transparent_60%)]" />
        <div className="relative max-w-lg">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
            Играй в шашки.
            <br />
            <span className="text-accent">Выигрывай AXM.</span>
          </h1>
          <p className="text-text-secondary text-base sm:text-lg mb-6 leading-relaxed">
            Делай ставки, обыгрывай соперника и забирай выигрыш в блокчейне Axiome.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => isConnected ? setShowCreate(true) : openConnectModal()}
              className="flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent-hover text-white text-sm font-semibold rounded-xl shadow-sm transition-all hover:shadow-glow-accent"
            >
              <Plus className="w-4 h-4" />
              {isConnected ? 'Создать игру' : 'Подключиться и играть'}
            </button>
            <button
              onClick={() => setShowLocal(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-bg-elevated hover:bg-border text-text-secondary hover:text-text text-sm font-semibold rounded-xl border border-border transition-colors"
            >
              <Monitor className="w-4 h-4" />
              Локальная игра
            </button>
          </div>
        </div>

        {/* Stats pills */}
        <div className="relative flex flex-wrap gap-4 mt-8 pt-6 border-t border-border/50">
          <div className="flex items-center gap-2 text-sm">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
              <Zap className="w-4 h-4 text-accent" />
            </div>
            <div>
              <p className="font-semibold tabular-nums">{openGames.length}</p>
              <p className="text-xs text-text-muted">Ожидают</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
              <Swords className="w-4 h-4 text-success" />
            </div>
            <div>
              <p className="font-semibold tabular-nums">{activeGames.length}</p>
              <p className="text-xs text-text-muted">Идут</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="w-8 h-8 rounded-lg bg-warning/10 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-warning" />
            </div>
            <div>
              <p className="font-semibold tabular-nums">
                {((openGames.reduce((s, g) => s + Number(g.wager), 0) +
                  activeGames.reduce((s, g) => s + Number(g.wager), 0)) / 1_000_000).toFixed(0)}
              </p>
              <p className="text-xs text-text-muted">AXM в игре</p>
            </div>
          </div>
        </div>
      </div>

      {/* Open games */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">Открытые игры</h2>
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-success/10 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              <span className="text-xs font-medium text-success tabular-nums">{openGames.length}</span>
            </div>
          </div>
          <button
            onClick={loadGames}
            className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Обновить
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-bg-card border border-border rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full animate-shimmer" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-2/3 rounded animate-shimmer" />
                    <div className="h-3 w-1/3 rounded animate-shimmer" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : openGames.length === 0 ? (
          <div className="border border-dashed border-border rounded-2xl p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-bg-subtle flex items-center justify-center mx-auto mb-4">
              <Swords className="w-6 h-6 text-text-muted" />
            </div>
            <p className="text-text-secondary font-medium mb-1">Нет открытых игр</p>
            <p className="text-text-muted text-sm">Создайте первую и ждите соперника</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {openGames.map(game => {
              const isOwn = game.blackPlayer === address
              const wagerAXM = (Number(game.wager) / 1_000_000).toFixed(0)
              return (
                <div
                  key={game.id}
                  className="group bg-bg-card border border-border rounded-2xl p-5 hover:border-border-hover hover:shadow-card-hover transition-all"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent font-bold text-sm">
                      {game.blackPlayer?.slice(3, 5).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {game.blackPlayer?.slice(0, 8)}...{game.blackPlayer?.slice(-4)}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
                          game.variant === 'russian' ? 'bg-accent/10 text-accent' : 'bg-warning/10 text-warning'
                        }`}>
                          {game.variant === 'russian' ? 'RUS' : 'USA'}
                        </span>
                        <span className="text-xs text-text-muted">{game.timePerMove}с/ход</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-bold tabular-nums">{wagerAXM}</span>
                      <span className="text-sm text-text-muted">AXM</span>
                    </div>
                    {isOwn ? (
                      <button
                        onClick={() => handleCancel(game.id)}
                        disabled={cancelingGameId === game.id}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl transition-all disabled:opacity-50 bg-danger/10 text-danger hover:bg-danger/20 border border-danger/20"
                      >
                        {cancelingGameId === game.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <X className="w-3.5 h-3.5" />
                        )}
                        Отменить
                      </button>
                    ) : (
                      <button
                        onClick={() => isConnected ? handleJoin(game.id) : openConnectModal()}
                        disabled={joiningGameId === game.id}
                        className="px-4 py-2 text-sm font-semibold rounded-xl transition-all disabled:opacity-50 bg-accent hover:bg-accent-hover text-white shadow-sm"
                      >
                        {joiningGameId === game.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : isConnected ? 'Играть' : 'Войти'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Active games */}
      {activeGames.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-lg font-semibold">Идут сейчас</h2>
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-warning/10 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-warning" />
              <span className="text-xs font-medium text-warning tabular-nums">{activeGames.length}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeGames.map(game => {
              const isMyGame = game.blackPlayer === address || game.whitePlayer === address
              const wagerAXM = (Number(game.wager) / 1_000_000).toFixed(0)
              return (
                <div
                  key={game.id}
                  onClick={() => router.push(`/game/${game.id}`)}
                  className="group bg-bg-card border border-border rounded-2xl p-5 hover:border-border-hover hover:shadow-card-hover transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex -space-x-2">
                      <div className="w-8 h-8 rounded-full bg-piece-black border-2 border-bg-card" />
                      <div className="w-8 h-8 rounded-full bg-piece-white border-2 border-bg-card" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {game.blackPlayer?.slice(0, 6)}... vs {game.whitePlayer?.slice(0, 6)}...
                      </p>
                      <p className="text-xs text-text-muted">
                        Ход {game.moveCount}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-baseline gap-1">
                      <span className="text-lg font-bold tabular-nums">{wagerAXM}</span>
                      <span className="text-sm text-text-muted">AXM</span>
                    </div>
                    <span className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl font-medium ${
                      isMyGame
                        ? 'bg-success/10 text-success'
                        : 'bg-bg-subtle text-text-secondary'
                    }`}>
                      {isMyGame ? (
                        <>
                          <Swords className="w-3.5 h-3.5" />
                          Продолжить
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5" />
                          Наблюдать
                        </>
                      )}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
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
