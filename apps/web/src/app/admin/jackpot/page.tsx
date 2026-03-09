'use client'

import { useState, useEffect } from 'react'
import { getJackpotPools, getJackpotWinners, type JackpotPool, type JackpotWinner } from '@/lib/api'

export default function AdminJackpotPage() {
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

  const fmt = (uaxm: string) => (Number(uaxm) / 1_000_000).toFixed(2)

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Jackpot Management</h1>

      {/* Active pools */}
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold">Active Pools</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-text-muted text-sm">Loading...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-text-secondary">
                <th className="text-left p-3">Tier</th>
                <th className="text-right p-3">Current</th>
                <th className="text-right p-3">Target</th>
                <th className="text-right p-3">Progress</th>
                <th className="text-right p-3">Cycle</th>
                <th className="text-right p-3">BPS</th>
              </tr>
            </thead>
            <tbody>
              {pools.map(pool => {
                const pct = Number(pool.targetAmount) > 0
                  ? ((Number(pool.currentAmount) / Number(pool.targetAmount)) * 100).toFixed(1)
                  : '0'
                return (
                  <tr key={pool.tier} className="border-b border-border last:border-0">
                    <td className="p-3 font-medium capitalize">{pool.tier.replace('_', ' ')}</td>
                    <td className="p-3 text-right font-mono">{fmt(pool.currentAmount)}</td>
                    <td className="p-3 text-right font-mono">{fmt(pool.targetAmount)}</td>
                    <td className="p-3 text-right">{pct}%</td>
                    <td className="p-3 text-right">#{pool.cycle}</td>
                    <td className="p-3 text-right">{pool.contributionBps}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Recent winners */}
      {winners.length > 0 && (
        <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="font-semibold">Recent Winners</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-text-secondary">
                <th className="text-left p-3">Tier</th>
                <th className="text-left p-3">Winner</th>
                <th className="text-right p-3">Amount</th>
                <th className="text-right p-3">Cycle</th>
                <th className="text-right p-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {winners.map(w => (
                <tr key={w.id} className="border-b border-border last:border-0">
                  <td className="p-3 font-medium capitalize">{w.tier.replace('_', ' ')}</td>
                  <td className="p-3 font-mono text-xs">{w.winnerAddress?.slice(0, 12)}...</td>
                  <td className="p-3 text-right font-mono text-success">{w.winAmount ? fmt(w.winAmount) : '—'}</td>
                  <td className="p-3 text-right">#{w.cycle}</td>
                  <td className="p-3 text-right text-xs text-text-muted">{w.drawnAt ? new Date(w.drawnAt).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
