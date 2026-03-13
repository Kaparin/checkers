'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useWallet } from '@/contexts/wallet-context'
import { getBalance, formatAXM } from '@/lib/chain-actions'

interface CreateGameModalProps {
  onClose: () => void
  onCreate: (wager: string, timePerMove: number, variant: 'russian' | 'american') => Promise<void>
}

const WAGER_PRESETS = [1, 5, 10, 25, 50, 100]
const TIME_PRESETS = [
  { label: '30с', value: 30 },
  { label: '1 мин', value: 60 },
  { label: '3 мин', value: 180 },
  { label: '5 мин', value: 300 },
]

const VARIANTS = [
  {
    id: 'russian' as const,
    name: 'Русские',
    desc: 'Дамки летают, захват назад, превращение в цепи',
  },
  {
    id: 'american' as const,
    name: 'Американские',
    desc: 'Стандартные правила, дамка на 1 клетку',
  },
]

export function CreateGameModal({ onClose, onCreate }: CreateGameModalProps) {
  const [wager, setWager] = useState(5)
  const [timePerMove, setTimePerMove] = useState(60)
  const [variant, setVariant] = useState<'russian' | 'american'>('russian')
  const [creating, setCreating] = useState(false)
  const [balance, setBalance] = useState<string | null>(null)
  const [balanceLoading, setBalanceLoading] = useState(true)
  const { address } = useWallet()

  useEffect(() => {
    if (!address) return
    setBalanceLoading(true)
    getBalance(address)
      .then(setBalance)
      .catch(() => setBalance(null))
      .finally(() => setBalanceLoading(false))
  }, [address])

  const balanceNum = balance ? Number(balance) : 0
  const wagerMicro = wager * 1_000_000
  const insufficientBalance = balance !== null && balanceNum < wagerMicro

  const handleCreate = async () => {
    setCreating(true)
    try {
      await onCreate(String(wager * 1_000_000), timePerMove, variant)
    } catch (err) {
      // Error will be handled by the parent, but reset state
      setCreating(false)
      return
    }
    setCreating(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative bg-bg-card border border-border rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-5"
      >
        <h2 className="text-xl font-bold text-center">Создать игру</h2>

        {/* Balance display */}
        <div className="text-center text-sm">
          {balanceLoading ? (
            <span className="text-text-muted">Загрузка баланса...</span>
          ) : balance !== null ? (
            <span className={insufficientBalance ? 'text-danger' : 'text-success'}>
              Ваш баланс: {formatAXM(balance)} AXM
            </span>
          ) : (
            <span className="text-text-muted">Баланс недоступен</span>
          )}
        </div>

        {/* Variant selector */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-text-muted uppercase tracking-wider">Правила</label>
          <div className="grid grid-cols-2 gap-2">
            {VARIANTS.map(v => (
              <button
                key={v.id}
                onClick={() => setVariant(v.id)}
                className={`p-3 rounded-xl text-left transition-all border ${
                  variant === v.id
                    ? 'bg-accent/10 border-accent text-accent'
                    : 'bg-bg-subtle border-border text-text-secondary hover:border-border-hover'
                }`}
              >
                <span className="text-sm font-semibold block">{v.name}</span>
                <span className="text-[10px] leading-tight block mt-0.5 opacity-60">{v.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Wager */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-text-muted uppercase tracking-wider">Ставка (AXM)</label>
          <div className="grid grid-cols-3 gap-2">
            {WAGER_PRESETS.map(w => (
              <button
                key={w}
                onClick={() => setWager(w)}
                className={`py-2 rounded-lg text-sm font-medium transition-all ${
                  wager === w
                    ? 'bg-accent text-white shadow-sm'
                    : 'bg-bg-subtle text-text-secondary hover:bg-bg-elevated border border-border'
                }`}
              >
                {w} AXM
              </button>
            ))}
          </div>
          <input
            type="number"
            min="1"
            value={wager}
            onChange={(e) => setWager(Math.max(1, Number(e.target.value)))}
            className="w-full px-4 py-2.5 bg-bg-subtle border border-border rounded-lg text-sm focus:outline-none focus:border-accent"
            placeholder="Другая сумма"
          />
          {insufficientBalance && (
            <p className="text-xs text-danger">Недостаточно средств для этой ставки</p>
          )}
        </div>

        {/* Time */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-text-muted uppercase tracking-wider">Время на ход</label>
          <div className="grid grid-cols-4 gap-2">
            {TIME_PRESETS.map(t => (
              <button
                key={t.value}
                onClick={() => setTimePerMove(t.value)}
                className={`py-2 rounded-lg text-sm font-medium transition-all ${
                  timePerMove === t.value
                    ? 'bg-accent text-white shadow-sm'
                    : 'bg-bg-subtle text-text-secondary hover:bg-bg-elevated border border-border'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-border text-text-secondary font-medium rounded-lg hover:border-border-hover transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || insufficientBalance || balanceLoading}
            className="flex-1 py-2.5 bg-accent text-white font-medium rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            {creating ? 'Создание...' : 'Создать'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
