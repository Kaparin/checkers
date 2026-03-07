'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { listGames, getStoredAddress, type GameListItem } from '@/lib/api'

export default function HistoryPage() {
  const router = useRouter()
  const [games, setGames] = useState<GameListItem[]>([])
  const [loading, setLoading] = useState(true)
  const address = getStoredAddress()

  useEffect(() => {
    listGames('finished', 50)
      .then(data => setGames(data.games))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Game History</h1>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : games.length === 0 ? (
        <div className="border border-dashed border-border rounded-2xl p-12 text-center">
          <p className="text-text-muted">No finished games yet.</p>
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
                    {!isMyGame ? '-' : iWon ? 'W' : 'L'}
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {game.blackPlayer?.slice(0, 6)}... vs {game.whitePlayer?.slice(0, 6)}...
                    </p>
                    <p className="text-xs text-text-muted">
                      {game.moveCount} moves &middot; {wager} COIN
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-text-muted">
                    {game.finishedAt ? new Date(game.finishedAt).toLocaleDateString() : ''}
                  </p>
                  <p className="text-xs text-text-muted capitalize">
                    {game.status.replace('_', ' ')}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
