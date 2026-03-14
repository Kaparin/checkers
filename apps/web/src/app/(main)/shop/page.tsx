'use client'

import { useState, useEffect } from 'react'
import { useWallet } from '@/contexts/wallet-context'
import { getShopItems, purchaseItem, type ShopItem } from '@/lib/api'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ShoppingBag,
  Package,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Lock,
  Loader2,
  Star,
  Gem,
  Info,
  Award,
  Gift,
  Palette,
  Zap,
} from 'lucide-react'

const CHEST_COLORS: Record<string, string> = {
  chest_bronze: 'from-amber-600 to-amber-800',
  chest_silver: 'from-gray-300 to-gray-500',
  chest_gold: 'from-yellow-400 to-amber-500',
  chest_diamond: 'from-cyan-300 to-blue-500',
}

const CHEST_BORDER_GLOW: Record<string, string> = {
  chest_bronze: 'hover:border-amber-600/40',
  chest_silver: 'hover:border-gray-400/40',
  chest_gold: 'hover:border-yellow-400/40',
  chest_diamond: 'hover:border-cyan-400/40',
}

const CHEST_ICONS: Record<string, typeof Package> = {
  chest_bronze: Package,
  chest_silver: Star,
  chest_gold: Gem,
  chest_diamond: Sparkles,
}

export default function ShopPage() {
  const { isConnected } = useWallet()
  const [items, setItems] = useState<ShopItem[]>([])
  const [loading, setLoading] = useState(true)
  const [buying, setBuying] = useState<string | null>(null)
  const [result, setResult] = useState<{ item: string; reward: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getShopItems()
      .then(data => setItems(data.items))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleBuy = async (itemId: string) => {
    if (!isConnected || buying) return
    setBuying(itemId)
    setResult(null)
    setError(null)
    try {
      const res = await purchaseItem(itemId)
      setResult({ item: itemId, reward: res.reward })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка покупки')
    }
    setBuying(null)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Page header */}
      <div className="text-center space-y-3">
        <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto">
          <ShoppingBag className="w-7 h-7 text-accent" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-text">Магазин</h1>
        <p className="text-text-secondary text-sm max-w-md mx-auto leading-relaxed">
          Покупайте сундуки за AXM и получайте токены CHECKER для косметики и функций.
        </p>
      </div>

      {/* Result banners */}
      {result && (
        <div className="flex items-center gap-3 p-4 bg-success/10 border border-success/20 rounded-2xl">
          <div className="w-9 h-9 rounded-xl bg-success/10 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 text-success" />
          </div>
          <p className="text-sm font-medium text-success">
            +{result.reward} CHECKER получено!
          </p>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-danger/10 border border-danger/20 rounded-2xl">
          <div className="w-9 h-9 rounded-xl bg-danger/10 flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5 text-danger" />
          </div>
          <p className="text-sm font-medium text-danger">{error}</p>
        </div>
      )}

      {/* Chests grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="bg-bg-card border border-border rounded-2xl p-6">
              <Skeleton className="w-16 h-16 rounded-2xl mx-auto mb-4" />
              <Skeleton className="h-5 w-20 mx-auto mb-2" />
              <Skeleton className="h-4 w-16 mx-auto mb-2" />
              <Skeleton className="h-4 w-24 mx-auto mb-4" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {items.map(item => {
            const ChestIcon = CHEST_ICONS[item.id] || Package
            const isBuying = buying === item.id
            return (
              <div
                key={item.id}
                className={`group bg-bg-card border border-border rounded-2xl p-5 flex flex-col items-center text-center hover:shadow-card-hover transition-all ${CHEST_BORDER_GLOW[item.id] || 'hover:border-border-hover'}`}
              >
                {/* Chest icon */}
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${CHEST_COLORS[item.id] || 'from-gray-400 to-gray-500'} flex items-center justify-center shadow-lg mb-4 group-hover:scale-105 transition-transform`}>
                  <ChestIcon className="w-7 h-7 text-white drop-shadow" />
                </div>

                <h3 className="font-semibold text-sm text-text mb-1.5">{item.name}</h3>

                <div className="flex items-center gap-1 mb-1">
                  <span className="text-sm font-bold text-text tabular-nums">
                    {(Number(item.price) / 1_000_000).toFixed(0)}
                  </span>
                  <span className="text-xs text-text-muted">AXM</span>
                </div>

                <div className="flex items-center gap-1 text-accent mb-4">
                  <Zap className="w-3 h-3" />
                  <span className="text-xs font-semibold">+{item.reward} CHECKER</span>
                </div>

                <button
                  onClick={() => handleBuy(item.id)}
                  disabled={!isConnected || isBuying}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-accent text-white text-sm font-semibold rounded-xl hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isBuying ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Покупка...
                    </>
                  ) : !isConnected ? (
                    <>
                      <Lock className="w-3.5 h-3.5" />
                      Войти
                    </>
                  ) : (
                    'Купить'
                  )}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Info section */}
      <div className="bg-bg-card border border-border rounded-2xl overflow-hidden hover:border-border-hover transition-colors">
        <div className="flex items-center gap-3 p-5 border-b border-border">
          <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
            <Info className="w-4 h-4 text-accent" />
          </div>
          <h2 className="text-lg font-semibold text-text">О токенах CHECKER</h2>
        </div>
        <div className="p-5 space-y-3">
          {[
            { icon: Sparkles, text: 'CHECKER — виртуальный игровой токен, не на блокчейне, используется только внутри Checkers.' },
            { icon: Palette, text: 'Используйте CHECKER для разблокировки тем доски, скинов фигур и косметики.' },
            { icon: Award, text: 'VIP-подписчики получают ежемесячные бонусы CHECKER.' },
            { icon: Gift, text: 'Зарабатывайте CHECKER через сундуки, достижения и события.' },
          ].map((item, i) => {
            const Icon = item.icon
            return (
              <div key={i} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-bg-subtle flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="w-3.5 h-3.5 text-text-secondary" />
                </div>
                <p className="text-sm text-text-secondary leading-relaxed">{item.text}</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
