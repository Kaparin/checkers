'use client'

import { useState, useEffect } from 'react'
import { getLeaderboard, type UserProfile } from '@/lib/api'
import { Skeleton } from '@/components/ui/skeleton'
import { Trophy, Crown, Medal, TrendingUp, Swords, Award } from 'lucide-react'

export default function LeaderboardPage() {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getLeaderboard()
      .then(data => setUsers(data.users))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="w-5 h-5 text-gold" />
    if (rank === 2) return <Medal className="w-5 h-5 text-text-secondary" />
    if (rank === 3) return <Medal className="w-5 h-5 text-amber-700" />
    return <span className="text-sm text-text-muted font-mono">{rank}</span>
  }

  const getRankBg = (rank: number) => {
    if (rank === 1) return 'bg-gold/5 border-gold/20'
    if (rank === 2) return 'bg-text-secondary/5 border-text-secondary/20'
    if (rank === 3) return 'bg-amber-700/5 border-amber-700/20'
    return ''
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
          <Trophy className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Рейтинг</h1>
          <p className="text-sm text-text-muted">Лучшие игроки по ELO</p>
        </div>
      </div>

      {/* Stats bar */}
      {!loading && users.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-bg-card border border-border rounded-2xl p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Award className="w-4 h-4 text-gold" />
              <span className="text-xs text-text-muted">Топ ELO</span>
            </div>
            <p className="text-xl font-bold font-mono">{users[0]?.elo ?? '-'}</p>
          </div>
          <div className="bg-bg-card border border-border rounded-2xl p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Swords className="w-4 h-4 text-accent" />
              <span className="text-xs text-text-muted">Игроков</span>
            </div>
            <p className="text-xl font-bold font-mono">{users.length}</p>
          </div>
          <div className="bg-bg-card border border-border rounded-2xl p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-success" />
              <span className="text-xs text-text-muted">Лучший W/L</span>
            </div>
            <p className="text-xl font-bold font-mono">
              {users.length > 0
                ? Math.max(
                    ...users.map(u => (u.gamesWon + u.gamesLost > 0 ? u.gamesWon / (u.gamesWon + u.gamesLost) : 0))
                  ).toFixed(0) + '%'
                : '-'
              }
            </p>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-bg-card border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left p-4 font-medium text-text-secondary w-16">Место</th>
              <th className="text-left p-4 font-medium text-text-secondary">Игрок</th>
              <th className="text-right p-4 font-medium text-text-secondary">
                <span className="flex items-center justify-end gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" />
                  ELO
                </span>
              </th>
              <th className="text-right p-4 font-medium text-text-secondary">
                <span className="flex items-center justify-end gap-1.5">
                  <Swords className="w-3.5 h-3.5" />
                  П/П
                </span>
              </th>
              <th className="text-right p-4 font-medium text-text-secondary">Выиграл</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <>
                {Array.from({ length: 8 }, (_, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="p-4"><Skeleton className="h-5 w-5 rounded-full" /></td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                        <Skeleton className="h-4 w-28" />
                      </div>
                    </td>
                    <td className="p-4"><Skeleton className="h-4 w-14 ml-auto" /></td>
                    <td className="p-4"><Skeleton className="h-4 w-12 ml-auto" /></td>
                    <td className="p-4"><Skeleton className="h-4 w-12 ml-auto" /></td>
                  </tr>
                ))}
              </>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-bg-subtle flex items-center justify-center">
                      <Trophy className="w-6 h-6 text-text-muted" />
                    </div>
                    <p className="text-text-muted">Игроков пока нет. Будьте первым!</p>
                  </div>
                </td>
              </tr>
            ) : (
              users.map((user, i) => {
                const rank = i + 1
                const winRate = user.gamesWon + user.gamesLost > 0
                  ? ((user.gamesWon / (user.gamesWon + user.gamesLost)) * 100).toFixed(0)
                  : null

                return (
                  <tr
                    key={user.address}
                    className={`border-b border-border last:border-0 hover:bg-bg-subtle transition-colors ${getRankBg(rank)}`}
                  >
                    <td className="p-4">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center">
                        {getRankIcon(rank)}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-accent/10 rounded-full flex items-center justify-center text-sm font-bold text-accent shrink-0">
                          {user.username?.[0]?.toUpperCase() || user.address[3].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <span className="font-medium truncate block">
                            {user.username || `${user.address.slice(0, 8)}...${user.address.slice(-4)}`}
                          </span>
                          {winRate !== null && (
                            <span className="text-xs text-text-muted">{winRate}% побед</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <span className="font-mono font-semibold text-base">{user.elo}</span>
                    </td>
                    <td className="p-4 text-right">
                      <span className="text-success font-medium">{user.gamesWon}</span>
                      <span className="text-text-muted mx-0.5">/</span>
                      <span className="text-danger font-medium">{user.gamesLost}</span>
                    </td>
                    <td className="p-4 text-right">
                      <span className="font-medium font-mono">
                        {(Number(user.totalWon) / 1_000_000).toFixed(0)}
                      </span>
                      <span className="text-text-muted text-xs ml-1">AXM</span>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
