'use client'

import { useState, useEffect } from 'react'
import { getLeaderboard, type UserProfile } from '@/lib/api'

export default function LeaderboardPage() {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getLeaderboard()
      .then(data => setUsers(data.users))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Leaderboard</h1>

      <div className="bg-bg-card border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-text-secondary">
              <th className="text-left p-4 font-medium">#</th>
              <th className="text-left p-4 font-medium">Player</th>
              <th className="text-right p-4 font-medium">ELO</th>
              <th className="text-right p-4 font-medium">W/L</th>
              <th className="text-right p-4 font-medium">Won</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="p-8 text-center">
                  <div className="w-6 h-6 mx-auto border-2 border-accent border-t-transparent rounded-full animate-spin" />
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-12 text-center text-text-muted">
                  No players yet. Be the first!
                </td>
              </tr>
            ) : (
              users.map((user, i) => (
                <tr key={user.address} className="border-b border-border last:border-0 hover:bg-bg-subtle transition-colors">
                  <td className="p-4 font-medium text-text-muted">{i + 1}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-accent/20 rounded-full flex items-center justify-center text-xs font-bold text-accent">
                        {user.username?.[0]?.toUpperCase() || user.address[3].toUpperCase()}
                      </div>
                      <span className="font-medium">
                        {user.username || `${user.address.slice(0, 8)}...${user.address.slice(-4)}`}
                      </span>
                    </div>
                  </td>
                  <td className="p-4 text-right font-mono font-semibold">{user.elo}</td>
                  <td className="p-4 text-right">
                    <span className="text-success">{user.gamesWon}</span>
                    <span className="text-text-muted">/</span>
                    <span className="text-danger">{user.gamesLost}</span>
                  </td>
                  <td className="p-4 text-right font-medium">
                    {(Number(user.totalWon) / 1_000_000).toFixed(0)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
