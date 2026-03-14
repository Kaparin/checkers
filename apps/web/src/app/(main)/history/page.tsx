'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { listGames, type GameListItem } from '@/lib/api'
import { useWallet } from '@/contexts/wallet-context'
import { SkeletonCard } from '@/components/ui/skeleton'
import {
  History,
  CheckCircle2,
  XCircle,
  Minus,
  Eye,
  Play,
  Swords,
  Calendar,
  ChevronRight,
  Timer,
  CircleDot,
} from 'lucide-react'

export default function HistoryPage() {
  const router = useRouter()
  const { address } = useWallet()
  const [games, setGames] = useState<GameListItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listGames('finished', 50)
      .then(data => setGames(data.games))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const getResultInfo = (game: GameListItem) => {
    const isMyGame = game.blackPlayer === address || game.whitePlayer === address
    const iWon = game.winner === address
    const isDraw = game.status === 'draw'

    if (!isMyGame) return {
      icon: <Eye className="w-4 h-4" />,
      label: 'Зритель',
      color: 'text-text-muted',
      bg: 'bg-bg-subtle',
    }
    if (isDraw) return {
      icon: <Minus className="w-4 h-4" />,
      label: 'Ничья',
      color: 'text-warning',
      bg: 'bg-warning/10',
    }
    if (iWon) return {
      icon: <CheckCircle2 className="w-4 h-4" />,
      label: 'Победа',
      color: 'text-success',
      bg: 'bg-success/10',
    }
    return {
      icon: <XCircle className="w-4 h-4" />,
      label: 'Поражение',
      color: 'text-danger',
      bg: 'bg-danger/10',
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'black_wins': return 'Победа чёрных'
      case 'white_wins': return 'Победа белых'
      case 'draw': return 'Ничья'
      case 'timeout': return 'Время вышло'
      default: return status.replace('_', ' ')
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
          <History className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">История игр</h1>
          <p className="text-sm text-text-muted">
            {!loading && games.length > 0
              ? `${games.length} завершённых игр`
              : 'Завершённые партии'
            }
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }, (_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : games.length === 0 ? (
        <div className="bg-bg-card border border-dashed border-border rounded-2xl p-16 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-bg-subtle flex items-center justify-center">
              <History className="w-6 h-6 text-text-muted" />
            </div>
            <p className="text-text-muted">Завершённых игр пока нет.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {games.map(game => {
            const result = getResultInfo(game)
            const wager = (Number(game.wager) / 1_000_000).toFixed(0)

            return (
              <div
                key={game.id}
                onClick={() => router.push(`/game/${game.id}`)}
                className="group bg-bg-card border border-border rounded-2xl p-5 hover:border-border-hover hover:shadow-card-hover transition-all cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  {/* Result icon */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${result.bg} ${result.color}`}>
                    {result.icon}
                  </div>

                  {/* Game info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium truncate">
                        {game.blackPlayer?.slice(0, 6)}...
                        <span className="text-text-muted mx-1.5">vs</span>
                        {game.whitePlayer?.slice(0, 6)}...
                      </p>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${result.bg} ${result.color}`}>
                        {result.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-text-muted">
                      <span className="flex items-center gap-1">
                        <Swords className="w-3 h-3" />
                        {game.moveCount} ходов
                      </span>
                      <span className="flex items-center gap-1">
                        <CircleDot className="w-3 h-3" />
                        {wager} AXM
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {game.finishedAt ? new Date(game.finishedAt).toLocaleDateString() : ''}
                      </span>
                    </div>
                  </div>

                  {/* Right side */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-text-muted flex items-center gap-1 justify-end">
                        {game.status === 'timeout' && <Timer className="w-3 h-3" />}
                        {getStatusLabel(game.status)}
                      </p>
                    </div>
                    {game.moveCount > 0 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); router.push(`/replay/${game.id}`) }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-accent border border-accent/30 rounded-xl hover:bg-accent/10 transition-colors"
                        title="Повтор"
                      >
                        <Play className="w-3 h-3" />
                        Повтор
                      </button>
                    )}
                    <ChevronRight className="w-4 h-4 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
