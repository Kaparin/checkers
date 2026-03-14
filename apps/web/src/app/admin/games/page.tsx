'use client'

import { useState, useEffect, useCallback } from 'react'
import { getAdminGames, getStuckGames, forceCancel, forceResolve } from '@/lib/admin-api'
import { Skeleton, SkeletonTable } from '@/components/ui/skeleton'

const PAGE_SIZE = 20
const STATUS_FILTERS = ['all', 'waiting', 'playing', 'black_wins', 'white_wins', 'draw', 'timeout', 'canceled'] as const

function statusBadge(status: string) {
  const styles =
    status === 'playing' ? 'bg-success/10 text-success' :
    status === 'waiting' || status === 'ready_check' ? 'bg-warning/10 text-warning' :
    status === 'black_wins' || status === 'white_wins' || status === 'timeout' ? 'bg-accent/10 text-accent' :
    status === 'canceled' ? 'bg-danger/10 text-danger' :
    status === 'draw' ? 'bg-bg-subtle text-text-muted' :
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
  const [actionId, setActionId] = useState<string | null>(null)
  const [actionMsg, setActionMsg] = useState<string | null>(null)

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
    setActionId(gameId)
    try {
      await forceCancel(gameId)
      setActionMsg(`Canceled ${gameId.slice(0, 8)}`)
      load()
    } catch (err: any) {
      setActionMsg(`Error: ${err.message}`)
    } finally {
      setActionId(null)
    }
  }

  const handleForceResolve = async (gameId: string) => {
    if (!confirm(`Force resolve game ${gameId.slice(0, 8)}... on-chain?`)) return
    setActionId(gameId)
    try {
      const result = await forceResolve(gameId)
      setActionMsg(`Resolved ${gameId.slice(0, 8)}: tx=${result.txHash.slice(0, 12)}...`)
      load()
    } catch (err: any) {
      setActionMsg(`Error: ${err.message}`)
    } finally {
      setActionId(null)
    }
  }

  if (error) return <div className="text-danger text-sm">{error}</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Games</h1>
        <button onClick={load} className="text-xs text-accent hover:text-accent-hover">Refresh</button>
      </div>

      {/* Action result */}
      {actionMsg && (
        <div className={`p-3 rounded-xl text-sm ${actionMsg.startsWith('Error') ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'}`}>
          {actionMsg}
          <button onClick={() => setActionMsg(null)} className="ml-2 text-xs opacity-60 hover:opacity-100">dismiss</button>
        </div>
      )}

      {/* Stuck games alert */}
      {stuck && stuck.count > 0 && (
        <div className="p-4 bg-danger/10 border border-danger/30 rounded-xl space-y-3">
          <p className="text-sm font-medium text-danger">
            {stuck.count} stuck game{stuck.count !== 1 ? 's' : ''} (transitional state &gt; 5 min)
          </p>
          <div className="space-y-2">
            {stuck.games.map((game: any) => (
              <div key={game.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-text-muted">{game.id.slice(0, 12)}...</span>
                  {statusBadge(game.status)}
                </div>
                <button
                  onClick={() => handleForceCancel(game.id)}
                  disabled={actionId === game.id}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-danger/20 text-danger hover:bg-danger/30 transition-colors disabled:opacity-50"
                >
                  {actionId === game.id ? 'Working...' : 'Force Cancel'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              status === s
                ? 'bg-accent/10 text-accent border border-accent/30'
                : 'bg-bg-card border border-border text-text-muted hover:text-text'
            }`}
          >
            {s === 'all' ? 'All' : s.replace('_', ' ')}
          </button>
        ))}
        {data && (
          <span className="ml-auto text-xs text-text-muted self-center whitespace-nowrap">{data.total} total</span>
        )}
      </div>

      {/* Games table */}
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        {loading || !data ? (
          <SkeletonTable rows={8} cols={7} />
        ) : data.games.length === 0 ? (
          <div className="p-8 text-center text-sm text-text-muted">No games found</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-text-muted">
                    <th className="p-3 font-medium">ID</th>
                    <th className="p-3 font-medium">Status</th>
                    <th className="p-3 font-medium text-right">Wager</th>
                    <th className="p-3 font-medium text-right">Moves</th>
                    <th className="p-3 font-medium">Chain</th>
                    <th className="p-3 font-medium text-right">Date</th>
                    <th className="p-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.games.map((game: any) => {
                    const isFinished = ['black_wins','white_wins','draw','timeout','canceled'].includes(game.status)
                    const isStuckFunds = isFinished && game.onChainGameId && !game.txHashResolve
                    return (
                      <tr key={game.id} className="hover:bg-bg-subtle/50 transition-colors">
                        <td className="p-3 font-mono text-xs">{game.id.slice(0, 8)}...</td>
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            {statusBadge(game.status)}
                            {isStuckFunds && (
                              <span className="text-[10px] px-1 py-0.5 rounded bg-danger/15 text-danger font-medium">STUCK</span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-right tabular-nums">
                          {(Number(game.wager) / 1_000_000).toFixed(0)}
                        </td>
                        <td className="p-3 text-right tabular-nums">{game.moveCount ?? 0}</td>
                        <td className="p-3">
                          <div className="flex gap-1">
                            {game.txHashCreate && <span className="text-[10px] px-1 rounded bg-success/10 text-success" title="Created on-chain">C</span>}
                            {game.txHashJoin && <span className="text-[10px] px-1 rounded bg-success/10 text-success" title="Joined on-chain">J</span>}
                            {game.txHashResolve && <span className="text-[10px] px-1 rounded bg-success/10 text-success" title="Resolved on-chain">R</span>}
                            {!game.txHashCreate && !game.txHashJoin && !game.txHashResolve && (
                              <span className="text-[10px] text-text-muted">--</span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-right text-xs text-text-muted whitespace-nowrap">
                          {game.createdAt ? new Date(game.createdAt).toLocaleDateString() : '--'}
                        </td>
                        <td className="p-3 text-right">
                          {!isFinished && game.status !== 'canceled' && (
                            <button
                              onClick={() => handleForceCancel(game.id)}
                              disabled={actionId === game.id}
                              className="px-2 py-1 rounded text-[10px] font-medium bg-danger/20 text-danger hover:bg-danger/30 disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          )}
                          {isStuckFunds && (
                            <button
                              onClick={() => handleForceResolve(game.id)}
                              disabled={actionId === game.id}
                              className="px-2 py-1 rounded text-[10px] font-medium bg-accent/20 text-accent hover:bg-accent/30 disabled:opacity-50"
                            >
                              Resolve
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data.total > PAGE_SIZE && (
              <div className="flex items-center justify-between p-3 border-t border-border text-xs text-text-muted">
                <span>
                  {offset + 1}–{Math.min(offset + PAGE_SIZE, data.total)} of {data.total}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                    disabled={offset === 0}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-bg-subtle border border-border disabled:opacity-40 hover:bg-bg-subtle/80"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => setOffset(offset + PAGE_SIZE)}
                    disabled={offset + PAGE_SIZE >= data.total}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-bg-subtle border border-border disabled:opacity-40 hover:bg-bg-subtle/80"
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
