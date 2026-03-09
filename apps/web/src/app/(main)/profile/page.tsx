'use client'

import { useState, useEffect } from 'react'
import { useWallet } from '@/contexts/wallet-context'
import { getUserProfile, listGames, type UserProfile, type GameListItem } from '@/lib/api'
import { Skeleton } from '@/components/ui/skeleton'

export default function ProfilePage() {
  const { address, isConnected } = useWallet()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [recentGames, setRecentGames] = useState<GameListItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!address) return
    setLoading(true)
    Promise.all([
      getUserProfile(address).catch(() => null),
      listGames('finished', 10).catch(() => ({ games: [] })),
    ]).then(([profileRes, gamesRes]) => {
      if (profileRes) setProfile(profileRes.user)
      setRecentGames(
        (gamesRes?.games || []).filter(
          (g: GameListItem) => g.blackPlayer === address || g.whitePlayer === address
        ).slice(0, 10)
      )
    }).finally(() => setLoading(false))
  }, [address])

  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <h1 className="text-2xl font-bold mb-4">Profile</h1>
        <p className="text-text-secondary">Connect your wallet to view your profile.</p>
      </div>
    )
  }

  const winRate = profile && profile.gamesPlayed > 0
    ? ((profile.gamesWon / profile.gamesPlayed) * 100).toFixed(1)
    : '0'

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Profile</h1>

      {/* Profile card */}
      <div className="bg-bg-card border border-border rounded-2xl p-6">
        {loading ? (
          <div className="flex items-center gap-4">
            <Skeleton className="w-16 h-16 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center text-2xl font-bold text-accent">
              {profile?.username?.[0]?.toUpperCase() || address?.[3]?.toUpperCase() || '?'}
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold">
                {profile?.username || `${address?.slice(0, 10)}...${address?.slice(-4)}`}
              </h2>
              <p className="text-sm font-mono text-text-muted">{address}</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">{profile?.elo ?? 1200}</div>
              <div className="text-xs text-text-secondary">ELO Rating</div>
            </div>
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Games', value: profile?.gamesPlayed ?? 0 },
          { label: 'Wins', value: profile?.gamesWon ?? 0, color: 'text-success' },
          { label: 'Losses', value: profile?.gamesLost ?? 0, color: 'text-danger' },
          { label: 'Win Rate', value: `${winRate}%` },
        ].map((stat) => (
          <div key={stat.label} className="bg-bg-card border border-border rounded-2xl p-4 text-center">
            {loading ? (
              <Skeleton className="h-8 w-12 mx-auto mb-1" />
            ) : (
              <div className={`text-2xl font-bold ${stat.color || ''}`}>{stat.value}</div>
            )}
            <div className="text-xs text-text-secondary mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Earnings */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-bg-card border border-border rounded-2xl p-5 text-center">
          {loading ? (
            <Skeleton className="h-8 w-20 mx-auto mb-1" />
          ) : (
            <div className="text-2xl font-bold text-success">
              {((Number(profile?.totalWon ?? 0)) / 1_000_000).toFixed(2)}
            </div>
          )}
          <div className="text-xs text-text-secondary mt-1">Total Won (AXM)</div>
        </div>
        <div className="bg-bg-card border border-border rounded-2xl p-5 text-center">
          {loading ? (
            <Skeleton className="h-8 w-20 mx-auto mb-1" />
          ) : (
            <div className="text-2xl font-bold">
              {((Number(profile?.totalWagered ?? 0)) / 1_000_000).toFixed(2)}
            </div>
          )}
          <div className="text-xs text-text-secondary mt-1">Total Wagered (AXM)</div>
        </div>
      </div>

      {/* Recent games */}
      {recentGames.length > 0 && (
        <div className="bg-bg-card border border-border rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="text-lg font-semibold">Recent Games</h2>
          </div>
          <div className="divide-y divide-border">
            {recentGames.map(game => {
              const isWinner = game.winner === address
              const isDraw = game.status === 'draw'
              return (
                <a
                  key={game.id}
                  href={`/game/${game.id}`}
                  className="flex items-center justify-between p-4 hover:bg-bg-subtle transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      isDraw ? 'bg-warning' : isWinner ? 'bg-success' : 'bg-danger'
                    }`} />
                    <div>
                      <p className="text-sm font-medium">
                        vs {game.blackPlayer === address
                          ? `${game.whitePlayer?.slice(0, 8)}...`
                          : `${game.blackPlayer?.slice(0, 8)}...`
                        }
                      </p>
                      <p className="text-xs text-text-muted">
                        {(Number(game.wager) / 1_000_000).toFixed(0)} AXM &middot; {game.moveCount} moves
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    isDraw ? 'bg-warning/10 text-warning'
                      : isWinner ? 'bg-success/10 text-success'
                      : 'bg-danger/10 text-danger'
                  }`}>
                    {isDraw ? 'Draw' : isWinner ? 'Won' : 'Lost'}
                  </span>
                </a>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
