'use client'

import { useState, useEffect, useCallback } from 'react'
import { getAdminGames, getStuckGames, forceCancel } from '@/lib/admin-api'
import { Skeleton, SkeletonTable } from '@/components/ui/skeleton'

const PAGE_SIZE = 20
const STATUS_FILTERS = ['all', 'waiting', 'playing', 'finished'] as const

function statusBadge(status: string) {
  const styles =
    status === 'playing' ? 'bg-success/10 text-success' :
    status === 'waiting' ? 'bg-warning/10 text-warning' :
    status === 'finished' ? 'bg-bg-subtle text-text-muted' :
    status === 'cancelled' ? 'bg-danger/10 text-danger' :
    'bg-bg-subtle text-text-muted'
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${styles}`}>
      {status}
    </span>
  )
}

export default function AdminGamesPage() {
  const [data, setData] = useState<{ games: any[]; total: number } | null>(null)
  const [stuck, setStuck] = useState<{ games: any[]; count: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('all')
  const [offset, setOffset] = useState(0)
  const [cancelling, setCancelling] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    const statusParam = status === 'all' ? undefined : status
    Promise.all([
      getAdminGames({ limit: PAGE_SIZE, offset, status: statusParam }),
      getStuckGames(),
    ])
      .then(([gamesData, stuckData]) => {
        setData(gamesData)
        setStuck(stuckData)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [offset, status])

  useEffect(() => { load() }, [load])
  useEffect(() => { setOffset(0) }, [status])

  const handleForceCancel = async (gameId: string) => {
    if (!confirm(`Force cancel game ${gameId.slice(0, 8)}...?`)) return
    setCancelling(gameId)
    try {
      await forceCancel(gameId)
      load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCancelling(null)
    }
  }

  if (error) {
    return <div className="text-danger text-sm">{error}</div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Games</h1>

      {/* Stuck games alert */}
      {stuck && stuck.count > 0 && (
        <div className="p-4 bg-danger/10 border border-danger/30 rounded-xl space-y-3">
          <p className="text-sm font-medium text-danger">
            {stuck.count} stuck game{stuck.count !== 1 ? 's' : ''} detected
          </p>
          <div className="space-y-2">
            {stuck.games.map((game: any) => (
              <div key={game.id} className="flex items-center justify-between text-sm">
                <span className="font-mono text-xs text-text-muted">{game.id.slice(0, 12)}...</span>
                <button
                  onClick={() => handleForceCancel(game.id)}
                  disabled={cancelling === game.id}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-danger/20 text-danger hover:bg-danger/30 transition-colors disabled:opacity-50"
                >
                  {cancelling === game.id ? 'Cancelling...' : 'Force Cancel'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status filter */}
      <div className="flex gap-2">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
              status === s
                ? 'bg-accent/10 text-accent border border-accent/30'
                : 'bg-bg-card border border-border text-text-muted hover:text-text'
            }`}
          >
            {s}
          </button>
        ))}
        {data && (
          <span className="ml-auto text-xs text-text-muted self-center">{data.total} games</span>
        )}
      </div>

      {/* Games table */}
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        {loading || !data ? (
          <SkeletonTable rows={8} cols={5} />
        ) : data.games.length === 0 ? (
          <div className="p-8 text-center text-sm text-text-muted">No games found</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-text-muted">
                    <th className="p-3 font-medium">ID</th>
                    <th className="p-3 font-medium">Black</th>
                    <th className="p-3 font-medium">White</th>
                    <th className="p-3 font-medium">Status</th>
                    <th className="p-3 font-medium text-right">Wager</th>
                    <th className="p-3 font-medium text-right">Moves</th>
                    <th className="p-3 font-medium text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.games.map((game: any) => (
                    <tr key={game.id} className="hover:bg-bg-subtle/50 transition-colors">
                      <td className="p-3 font-mono text-xs">{game.id.slice(0, 8)}...</td>
                      <td className="p-3 font-mono text-xs">
                        {game.black ? `${game.black.slice(0, 8)}...` : <span className="text-text-muted">--</span>}
                      </td>
                      <td className="p-3 font-mono text-xs">
                        {game.white ? `${game.white.slice(0, 8)}...` : <span className="text-text-muted">--</span>}
                      </td>
                      <td className="p-3">{statusBadge(game.status)}</td>
                      <td className="p-3 text-right tabular-nums">
                        {(Number(game.wager) / 1_000_000).toFixed(0)}
                      </td>
                      <td className="p-3 text-right tabular-nums">{game.moveCount ?? game.moves ?? 0}</td>
                      <td className="p-3 text-right text-xs text-text-muted whitespace-nowrap">
                        {game.createdAt
                          ? new Date(game.createdAt).toLocaleDateString()
                          : '--'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data.total > PAGE_SIZE && (
              <div className="flex items-center justify-between p-3 border-t border-border text-xs text-text-muted">
                <span>
                  Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, data.total)} of {data.total}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                    disabled={offset === 0}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-bg-subtle border border-border disabled:opacity-40 hover:bg-bg-subtle/80 transition-colors"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => setOffset(offset + PAGE_SIZE)}
                    disabled={offset + PAGE_SIZE >= data.total}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-bg-subtle border border-border disabled:opacity-40 hover:bg-bg-subtle/80 transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
