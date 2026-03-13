'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { listGames, type GameListItem } from '@/lib/api'
import { useWallet } from '@/contexts/wallet-context'
import { SkeletonCard } from '@/components/ui/skeleton'

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

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">История игр</h1>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : games.length === 0 ? (
        <div className="border border-dashed border-border rounded-2xl p-12 text-center">
          <p className="text-text-muted">Завершённых игр пока нет.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {games.map(game => {
            const iWon = game.winner === address
            const isMyGame = game.blackPlayer === address || game.whitePlayer === address
            const wager = (Number(game.wager) / 1_000_000).toFixed(0)

            return (
              <div
                key={game.id}
                onClick={() => router.push(`/game/${game.id}`)}
                className="flex items-center justify-between p-4 bg-bg-card border border-border rounded-xl hover:border-border-hover transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    !isMyGame ? 'bg-bg-subtle text-text-muted' :
                    iWon ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
                  }`}>
                    {!isMyGame ? '-' : iWon ? 'П' : 'Р'}
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {game.blackPlayer?.slice(0, 6)}... vs {game.whitePlayer?.slice(0, 6)}...
                    </p>
                    <p className="text-xs text-text-muted">
                      {game.moveCount} ходов &middot; {wager} AXM
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs text-text-muted">
                      {game.finishedAt ? new Date(game.finishedAt).toLocaleDateString() : ''}
                    </p>
                    <p className="text-xs text-text-muted">
                      {game.status === 'black_wins' ? 'Победа чёрных' :
                       game.status === 'white_wins' ? 'Победа белых' :
                       game.status === 'draw' ? 'Ничья' :
                       game.status === 'timeout' ? 'Время вышло' :
                       game.status.replace('_', ' ')}
                    </p>
                  </div>
                  {game.moveCount > 0 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); router.push(`/replay/${game.id}`) }}
                      className="px-2 py-1 text-[10px] font-medium text-accent border border-accent/30 rounded-md hover:bg-accent/5 transition-colors"
                      title="Повтор"
                    >
                      Повтор
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
