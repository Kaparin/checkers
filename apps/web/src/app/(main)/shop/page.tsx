'use client'

import { useState, useEffect } from 'react'
import { useWallet } from '@/contexts/wallet-context'
import { getShopItems, purchaseItem, type ShopItem } from '@/lib/api'
import { Skeleton } from '@/components/ui/skeleton'

const CHEST_COLORS: Record<string, string> = {
  chest_bronze: 'from-amber-600 to-amber-700',
  chest_silver: 'from-gray-400 to-gray-500',
  chest_gold: 'from-yellow-400 to-yellow-500',
  chest_diamond: 'from-cyan-400 to-cyan-500',
}

const CHEST_ICONS: Record<string, string> = {
  chest_bronze: 'B',
  chest_silver: 'S',
  chest_gold: 'G',
  chest_diamond: 'D',
}

export default function ShopPage() {
  const { isConnected } = useWallet()
  const [items, setItems] = useState<ShopItem[]>([])
  const [loading, setLoading] = useState(true)
  const [buying, setBuying] = useState<string | null>(null)
  const [result, setResult] = useState<{ item: string; reward: string } | null>(null)

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
    try {
      const res = await purchaseItem(itemId)
      setResult({ item: itemId, reward: res.reward })
    } catch {}
    setBuying(null)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Магазин</h1>
        <p className="text-text-secondary text-sm">
          Покупайте сундуки за AXM и получайте токены CHECKER для косметики и функций.
        </p>
      </div>

      {/* Success banner */}
      {result && (
        <div className="p-4 bg-success/10 border border-success/30 rounded-xl text-center">
          <p className="text-sm font-medium text-success">
            +{result.reward} CHECKER получено!
          </p>
        </div>
      )}

      {/* Chests grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="bg-bg-card border border-border rounded-2xl p-6">
              <Skeleton className="w-16 h-16 rounded-xl mx-auto mb-4" />
              <Skeleton className="h-5 w-20 mx-auto mb-2" />
              <Skeleton className="h-4 w-16 mx-auto mb-4" />
              <Skeleton className="h-9 w-full rounded-lg" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {items.map(item => (
            <div key={item.id} className="bg-bg-card border border-border rounded-2xl p-5 flex flex-col items-center text-center">
              {/* Chest icon */}
              <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${CHEST_COLORS[item.id] || 'from-gray-400 to-gray-500'} flex items-center justify-center text-white text-2xl font-bold shadow-lg mb-4`}>
                {CHEST_ICONS[item.id] || '?'}
              </div>

              <h3 className="font-semibold text-sm mb-1">{item.name}</h3>
              <p className="text-xs text-text-secondary mb-1">
                {(Number(item.price) / 1_000_000).toFixed(0)} AXM
              </p>
              <p className="text-xs text-accent font-medium mb-4">
                +{item.reward} CHECKER
              </p>

              <button
                onClick={() => handleBuy(item.id)}
                disabled={!isConnected || buying === item.id}
                className="w-full py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50"
              >
                {buying === item.id ? 'Покупка...' : isConnected ? 'Купить' : 'Войти'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Info */}
      <div className="bg-bg-card border border-border rounded-2xl p-6 space-y-3">
        <h2 className="text-lg font-semibold">О токенах CHECKER</h2>
        <ul className="space-y-2 text-sm text-text-secondary">
          <li>CHECKER — виртуальный игровой токен, не на блокчейне, используется только внутри Checkers.</li>
          <li>Используйте CHECKER для разблокировки тем доски, скинов фигур и косметики.</li>
          <li>VIP-подписчики получают ежемесячные бонусы CHECKER.</li>
          <li>Зарабатывайте CHECKER через сундуки, достижения и события.</li>
        </ul>
      </div>
    </div>
  )
}
