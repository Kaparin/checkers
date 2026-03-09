'use client'

import { useState, useEffect } from 'react'
import { getDiagnostics, healSystem } from '@/lib/admin-api'
import { Skeleton, SkeletonTable } from '@/components/ui/skeleton'

export default function AdminDiagnosticsPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [healing, setHealing] = useState(false)
  const [healResults, setHealResults] = useState<string[] | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    getDiagnostics()
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleHeal = async () => {
    if (!confirm('Run system heal? This will attempt to fix stuck games and other issues.')) return
    setHealing(true)
    setHealResults(null)
    try {
      const result = await healSystem()
      setHealResults(result.results)
      // Reload diagnostics after healing
      load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setHealing(false)
    }
  }

  if (error) {
    return <div className="text-danger text-sm">{error}</div>
  }

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold">Diagnostics</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="p-4 bg-bg-card border border-border rounded-xl space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-6 w-24" />
            </div>
          ))}
        </div>
        <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
          <SkeletonTable rows={5} cols={3} />
        </div>
      </div>
    )
  }

  const totalGames = Object.values(data.gameDistribution as Record<string, number>)
    .reduce((sum: number, n) => sum + (n as number), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold">Diagnostics</h1>
        <button
          onClick={handleHeal}
          disabled={healing}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-accent text-white hover:bg-accent/90 transition-colors disabled:opacity-50"
        >
          {healing ? 'Healing...' : 'Heal System'}
        </button>
      </div>

      {/* Heal results */}
      {healResults && (
        <div className="p-4 bg-success/10 border border-success/30 rounded-xl space-y-1">
          <p className="text-sm font-medium text-success">Heal completed</p>
          {healResults.map((r, i) => (
            <p key={i} className="text-xs text-text-muted">{r}</p>
          ))}
        </div>
      )}

      {/* Stuck games warning */}
      {data.stuckGames > 0 && (
        <div className="p-4 bg-danger/10 border border-danger/30 rounded-xl">
          <p className="text-sm font-medium text-danger">
            {data.stuckGames} stuck game{data.stuckGames !== 1 ? 's' : ''} detected — consider running Heal System
          </p>
        </div>
      )}

      {/* Game distribution */}
      <div className="bg-bg-card border border-border rounded-xl p-4">
        <h2 className="text-sm font-semibold mb-3">Game Distribution</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(data.gameDistribution as Record<string, number>).map(([status, count]) => {
            const pct = totalGames > 0 ? (((count as number) / totalGames) * 100).toFixed(1) : '0'
            return (
              <div key={status} className="text-center p-3 bg-bg-subtle rounded-lg">
                <p className="text-xs text-text-muted capitalize">{status.replace('_', ' ')}</p>
                <p className="text-lg font-bold tabular-nums">{count as number}</p>
                <p className="text-[10px] text-text-muted">{pct}%</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-bg-card border border-border rounded-xl">
          <p className="text-xs text-text-muted mb-1">Stuck Games</p>
          <p className={`text-lg font-bold tabular-nums ${data.stuckGames > 0 ? 'text-danger' : 'text-success'}`}>
            {data.stuckGames}
          </p>
        </div>
        <div className="p-4 bg-bg-card border border-border rounded-xl">
          <p className="text-xs text-text-muted mb-1">Failed Transactions</p>
          <p className={`text-lg font-bold tabular-nums ${data.failedRelayerTxs > 0 ? 'text-warning' : 'text-success'}`}>
            {data.failedRelayerTxs}
          </p>
        </div>
      </div>

      {/* Recent relayer transactions */}
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="text-sm font-semibold">Recent Relayer Transactions</h2>
        </div>
        {data.recentRelayerTxs.length === 0 ? (
          <div className="p-8 text-center text-sm text-text-muted">No recent transactions</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-text-muted">
                  <th className="p-3 font-medium">Hash</th>
                  <th className="p-3 font-medium">Type</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 font-medium text-right">Gas</th>
                  <th className="p-3 font-medium text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.recentRelayerTxs.map((tx: any, i: number) => (
                  <tr key={tx.hash || i} className="hover:bg-bg-subtle/50 transition-colors">
                    <td className="p-3 font-mono text-xs">
                      {tx.hash ? `${tx.hash.slice(0, 10)}...` : '--'}
                    </td>
                    <td className="p-3 text-xs">{tx.msgType || tx.type || '--'}</td>
                    <td className="p-3">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        tx.status === 'success' ? 'bg-success/10 text-success' :
                        tx.status === 'failed' ? 'bg-danger/10 text-danger' :
                        tx.status === 'pending' ? 'bg-warning/10 text-warning' :
                        'bg-bg-subtle text-text-muted'
                      }`}>
                        {tx.status || '--'}
                      </span>
                    </td>
                    <td className="p-3 text-right tabular-nums text-xs">{tx.gasUsed ?? '--'}</td>
                    <td className="p-3 text-right text-xs text-text-muted whitespace-nowrap">
                      {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : '--'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
