'use client'

import { useState, useEffect } from 'react'
import { getJackpotPools, getJackpotWinners, type JackpotPool, type JackpotWinner } from '@/lib/api'
import { Skeleton } from '@/components/ui/skeleton'

const TIER_COLORS: Record<string, string> = {
  mini: 'from-emerald-500 to-emerald-600',
  medium: 'from-blue-500 to-blue-600',
  large: 'from-purple-500 to-purple-600',
  mega: 'from-amber-500 to-amber-600',
  super_mega: 'from-red-500 to-red-600',
}

const TIER_BG: Record<string, string> = {
  mini: 'bg-emerald-500/10 border-emerald-500/20',
  medium: 'bg-blue-500/10 border-blue-500/20',
  large: 'bg-purple-500/10 border-purple-500/20',
  mega: 'bg-amber-500/10 border-amber-500/20',
  super_mega: 'bg-red-500/10 border-red-500/20',
}

function formatAXM(uaxm: string): string {
  return (Number(uaxm) / 1_000_000).toFixed(2)
}

function progressPercent(current: string, target: string): number {
  const c = Number(current)
  const t = Number(target)
  if (t <= 0) return 0
  return Math.min(100, (c / t) * 100)
}

export default function JackpotPage() {
  const [pools, setPools] = useState<JackpotPool[]>([])
  const [winners, setWinners] = useState<JackpotWinner[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      getJackpotPools().catch(() => ({ pools: [] })),
      getJackpotWinners().catch(() => ({ winners: [] })),
    ]).then(([p, w]) => {
      setPools(p.pools)
      setWinners(w.winners)
    }).finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Jackpot</h1>
        <p className="text-text-secondary text-sm">
          Every game contributes to the jackpot pools. When a pool reaches its target, a random winner is drawn!
        </p>
      </div>

      {/* Pools */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="bg-bg-card border border-border rounded-2xl p-6">
              <Skeleton className="h-5 w-24 mb-4" />
              <Skeleton className="h-8 w-32 mb-2" />
              <Skeleton className="h-3 w-full rounded-full mb-2" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      ) : pools.length === 0 ? (
        <div className="border border-dashed border-border rounded-2xl p-12 text-center">
          <p className="text-text-muted">No jackpot pools active yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {pools.map((pool) => {
            const pct = progressPercent(pool.currentAmount, pool.targetAmount)
            return (
              <div
                key={pool.tier}
                className={`border rounded-2xl p-6 space-y-3 ${TIER_BG[pool.tier] || 'bg-bg-card border-border'}`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{pool.name}</h3>
                  <span className="text-xs text-text-muted">Cycle #{pool.cycle}</span>
                </div>

                <div className="text-2xl font-bold">
                  {formatAXM(pool.currentAmount)} <span className="text-sm font-normal text-text-secondary">AXM</span>
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="h-2.5 bg-black/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${TIER_COLORS[pool.tier] || 'from-accent to-accent-hover'} transition-all duration-500`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-text-muted">
                    <span>{pct.toFixed(1)}%</span>
                    <span>Target: {formatAXM(pool.targetAmount)} AXM</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Recent winners */}
      {winners.length > 0 && (
        <div className="bg-bg-card border border-border rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="text-lg font-semibold">Recent Winners</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-text-secondary">
                <th className="text-left p-4 font-medium">Tier</th>
                <th className="text-left p-4 font-medium">Winner</th>
                <th className="text-right p-4 font-medium">Amount</th>
                <th className="text-right p-4 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {winners.map((w) => (
                <tr key={w.id} className="border-b border-border last:border-0">
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold text-white bg-gradient-to-r ${TIER_COLORS[w.tier] || 'from-accent to-accent-hover'}`}>
                      {w.tier.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="p-4 font-mono text-xs">
                    {w.winnerAddress ? `${w.winnerAddress.slice(0, 8)}...${w.winnerAddress.slice(-4)}` : '—'}
                  </td>
                  <td className="p-4 text-right font-medium text-success">
                    {w.winAmount ? `${formatAXM(w.winAmount)} AXM` : '—'}
                  </td>
                  <td className="p-4 text-right text-text-muted text-xs">
                    {w.drawnAt ? new Date(w.drawnAt).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Info */}
      <div className="bg-bg-card border border-border rounded-2xl p-6 space-y-3">
        <h2 className="text-lg font-semibold">How It Works</h2>
        <ul className="space-y-2 text-sm text-text-secondary">
          <li>A small percentage of each game's commission is split across jackpot pools.</li>
          <li>Each pool has a target amount. When the target is reached, a random winner is drawn.</li>
          <li>Your chances of winning are proportional to how many games you've played — more games = more tickets.</li>
          <li>After a winner is drawn, the pool resets to a new cycle.</li>
        </ul>
      </div>
    </div>
  )
}
