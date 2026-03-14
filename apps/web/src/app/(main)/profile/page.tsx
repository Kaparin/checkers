'use client'

import { useState, useEffect } from 'react'
import { useWallet } from '@/contexts/wallet-context'
import { getUserProfile, listGames, type UserProfile, type GameListItem } from '@/lib/api'
import { Skeleton } from '@/components/ui/skeleton'
import {
  User,
  Trophy,
  Gamepad2,
  Target,
  Percent,
  TrendingUp,
  Coins,
  Swords,
  ChevronRight,
  WalletCards,
  Crown,
  XCircle,
  Minus,
} from 'lucide-react'

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
      listGames('finished', 10, 0, address).catch(() => ({ games: [] })),
    ]).then(([profileRes, gamesRes]) => {
      if (profileRes) setProfile(profileRes.user)
      setRecentGames(gamesRes?.games || [])
    }).finally(() => setLoading(false))
  }, [address])

  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-5">
          <WalletCards className="w-8 h-8 text-accent" />
        </div>
        <h1 className="text-2xl font-bold mb-3 text-text">Профиль</h1>
        <p className="text-text-secondary text-sm leading-relaxed">
          Подключите кошелёк для просмотра профиля.
        </p>
      </div>
    )
  }

  const winRate = profile && profile.gamesPlayed > 0
    ? ((profile.gamesWon / profile.gamesPlayed) * 100).toFixed(1)
    : '0'

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
          <User className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text">Профиль</h1>
          <p className="text-xs text-text-muted">Статистика и история игр</p>
        </div>
      </div>

      {/* Profile card */}
      <div className="bg-bg-card border border-border rounded-2xl overflow-hidden hover:border-border-hover hover:shadow-card-hover transition-all">
        {/* Decorative accent bar */}
        <div className="h-1 bg-gradient-to-r from-accent via-accent/60 to-transparent" />
        <div className="p-6">
          {loading ? (
            <div className="flex items-center gap-4">
              <Skeleton className="w-16 h-16 rounded-2xl" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-56" />
              </div>
              <Skeleton className="h-12 w-20" />
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center text-2xl font-bold text-accent shrink-0">
                {profile?.username?.[0]?.toUpperCase() || address?.[3]?.toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold text-text truncate">
                  {profile?.username || `${address?.slice(0, 10)}...${address?.slice(-4)}`}
                </h2>
                <p className="text-xs font-mono text-text-muted truncate mt-0.5">{address}</p>
              </div>
              <div className="text-right shrink-0">
                <div className="flex items-center gap-1.5 justify-end">
                  <Trophy className="w-4 h-4 text-gold" />
                  <span className="text-2xl font-bold text-text tabular-nums">{profile?.elo ?? 1200}</span>
                </div>
                <div className="text-xs text-text-secondary mt-0.5">Рейтинг ELO</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Игры', value: profile?.gamesPlayed ?? 0, icon: Gamepad2, iconColor: 'text-accent', iconBg: 'bg-accent/10' },
          { label: 'Победы', value: profile?.gamesWon ?? 0, color: 'text-success', icon: Target, iconColor: 'text-success', iconBg: 'bg-success/10' },
          { label: 'Поражения', value: profile?.gamesLost ?? 0, color: 'text-danger', icon: XCircle, iconColor: 'text-danger', iconBg: 'bg-danger/10' },
          { label: 'Винрейт', value: `${winRate}%`, icon: Percent, iconColor: 'text-warning', iconBg: 'bg-warning/10' },
        ].map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="bg-bg-card border border-border rounded-2xl p-4 hover:border-border-hover hover:shadow-card-hover transition-all">
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-8 h-8 rounded-lg ${stat.iconBg} flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${stat.iconColor}`} />
                </div>
              </div>
              {loading ? (
                <Skeleton className="h-8 w-12 mb-1" />
              ) : (
                <div className={`text-2xl font-bold tabular-nums ${stat.color || 'text-text'}`}>{stat.value}</div>
              )}
              <div className="text-xs text-text-secondary mt-1">{stat.label}</div>
            </div>
          )
        })}
      </div>

      {/* Earnings */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-bg-card border border-border rounded-2xl p-5 hover:border-border-hover hover:shadow-card-hover transition-all">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-success" />
            </div>
            <span className="text-xs text-text-secondary">Выиграно (AXM)</span>
          </div>
          {loading ? (
            <Skeleton className="h-8 w-20" />
          ) : (
            <div className="text-2xl font-bold text-success tabular-nums">
              {((Number(profile?.totalWon ?? 0)) / 1_000_000).toFixed(2)}
            </div>
          )}
        </div>
        <div className="bg-bg-card border border-border rounded-2xl p-5 hover:border-border-hover hover:shadow-card-hover transition-all">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
              <Coins className="w-4 h-4 text-accent" />
            </div>
            <span className="text-xs text-text-secondary">Поставлено (AXM)</span>
          </div>
          {loading ? (
            <Skeleton className="h-8 w-20" />
          ) : (
            <div className="text-2xl font-bold text-text tabular-nums">
              {((Number(profile?.totalWagered ?? 0)) / 1_000_000).toFixed(2)}
            </div>
          )}
        </div>
      </div>

      {/* Recent games */}
      {recentGames.length > 0 && (
        <div className="bg-bg-card border border-border rounded-2xl overflow-hidden hover:border-border-hover transition-colors">
          <div className="flex items-center gap-3 p-5 border-b border-border">
            <div className="w-8 h-8 rounded-lg bg-bg-subtle flex items-center justify-center">
              <Swords className="w-4 h-4 text-text-secondary" />
            </div>
            <h2 className="text-lg font-semibold text-text">Последние игры</h2>
          </div>
          <div className="divide-y divide-border">
            {recentGames.map(game => {
              const isWinner = game.winner === address
              const isDraw = game.status === 'draw'
              const ResultIcon = isDraw ? Minus : isWinner ? Crown : XCircle
              return (
                <a
                  key={game.id}
                  href={`/game/${game.id}`}
                  className="group flex items-center justify-between p-4 hover:bg-bg-subtle transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                      isDraw ? 'bg-warning/10' : isWinner ? 'bg-success/10' : 'bg-danger/10'
                    }`}>
                      <ResultIcon className={`w-4 h-4 ${
                        isDraw ? 'text-warning' : isWinner ? 'text-success' : 'text-danger'
                      }`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text">
                        vs {game.blackPlayer === address
                          ? `${game.whitePlayer?.slice(0, 8)}...`
                          : `${game.blackPlayer?.slice(0, 8)}...`
                        }
                      </p>
                      <p className="text-xs text-text-muted mt-0.5">
                        {(Number(game.wager) / 1_000_000).toFixed(0)} AXM &middot; {game.moveCount} ходов
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${
                      isDraw ? 'bg-warning/10 text-warning'
                        : isWinner ? 'bg-success/10 text-success'
                        : 'bg-danger/10 text-danger'
                    }`}>
                      {isDraw ? 'Ничья' : isWinner ? 'Победа' : 'Поражение'}
                    </span>
                    <ChevronRight className="w-4 h-4 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </a>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
