'use client'

import { useState, useEffect } from 'react'
import { getDashboard } from '@/lib/admin-api'
import { Skeleton } from '@/components/ui/skeleton'

export default function AdminDashboard() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getDashboard()
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (error) {
    return <div className="text-danger text-sm">{error}</div>
  }

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold">Dashboard</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="p-4 bg-bg-card border border-border rounded-xl space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-6 w-24" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const stats = [
    { label: 'Users', value: data.users },
    { label: 'Games', value: data.games },
    { label: 'Volume (AXM)', value: (Number(data.volume) / 1_000_000).toFixed(0) },
    { label: 'Commission (AXM)', value: (Number(data.totalCommission) / 1_000_000).toFixed(2) },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Dashboard</h1>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="p-4 bg-bg-card border border-border rounded-xl">
            <p className="text-xs text-text-muted mb-1">{stat.label}</p>
            <p className="text-lg font-bold tabular-nums">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Game status breakdown */}
      <div className="bg-bg-card border border-border rounded-xl p-4">
        <h2 className="text-sm font-semibold mb-3">Games by Status</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(data.gamesByStatus).map(([status, count]) => (
            <div key={status} className="text-center p-2 bg-bg-subtle rounded-lg">
              <p className="text-xs text-text-muted capitalize">{status.replace('_', ' ')}</p>
              <p className="text-sm font-bold">{count as number}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Pending sweep */}
      {Number(data.pendingSweep) > 0 && (
        <div className="p-4 bg-warning/10 border border-warning/30 rounded-xl">
          <p className="text-sm font-medium text-warning">
            Pending sweep: {(Number(data.pendingSweep) / 1_000_000).toFixed(2)} AXM
          </p>
        </div>
      )}

      {/* Recent games */}
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="text-sm font-semibold">Recent Games</h2>
        </div>
        <div className="divide-y divide-border">
          {data.recentGames.map((game: any) => (
            <div key={game.id} className="p-3 flex items-center justify-between text-sm">
              <div>
                <span className="font-mono text-xs text-text-muted">{game.id.slice(0, 8)}</span>
                <span className={`ml-2 text-xs px-1.5 py-0.5 rounded font-medium ${
                  game.status === 'playing' ? 'bg-success/10 text-success' :
                  game.status === 'waiting' ? 'bg-warning/10 text-warning' :
                  'bg-bg-subtle text-text-muted'
                }`}>
                  {game.status}
                </span>
              </div>
              <span className="text-xs text-text-muted">
                {(Number(game.wager) / 1_000_000).toFixed(0)} AXM
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
