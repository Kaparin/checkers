'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'

interface CreateGameModalProps {
  onClose: () => void
  onCreate: (wager: string, timePerMove: number, variant: 'russian' | 'american') => Promise<void>
}

const WAGER_PRESETS = [1, 5, 10, 25, 50, 100]
const TIME_PRESETS = [
  { label: '30s', value: 30 },
  { label: '1 min', value: 60 },
  { label: '3 min', value: 180 },
  { label: '5 min', value: 300 },
]

const VARIANTS = [
  {
    id: 'russian' as const,
    name: 'Russian',
    nameRu: 'Русские',
    desc: 'Flying kings, backward captures, mid-chain promotion',
  },
  {
    id: 'american' as const,
    name: 'American',
    nameRu: 'Американские',
    desc: 'Standard rules, kings move one square',
  },
]

export function CreateGameModal({ onClose, onCreate }: CreateGameModalProps) {
  const [wager, setWager] = useState(5)
  const [timePerMove, setTimePerMove] = useState(60)
  const [variant, setVariant] = useState<'russian' | 'american'>('russian')
  const [creating, setCreating] = useState(false)

  const handleCreate = async () => {
    setCreating(true)
    try {
      await onCreate(String(wager * 1_000_000), timePerMove, variant)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative bg-bg-card border border-border rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-5"
      >
        <h2 className="text-xl font-bold text-center">Create Game</h2>

        {/* Variant selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-text-secondary">Rules</label>
          <div className="grid grid-cols-2 gap-2">
            {VARIANTS.map(v => (
              <button
                key={v.id}
                onClick={() => setVariant(v.id)}
                className={`p-3 rounded-xl text-left transition-all border ${
                  variant === v.id
                    ? 'bg-accent/10 border-accent text-accent'
                    : 'bg-bg-subtle border-transparent text-text-secondary hover:bg-border'
                }`}
              >
                <span className="text-sm font-semibold block">{v.nameRu}</span>
                <span className="text-[11px] leading-tight block mt-0.5 opacity-70">{v.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Wager */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-text-secondary">Wager (COIN)</label>
          <div className="grid grid-cols-3 gap-2">
            {WAGER_PRESETS.map(w => (
              <button
                key={w}
                onClick={() => setWager(w)}
                className={`py-2 rounded-xl text-sm font-medium transition-all ${
                  wager === w
                    ? 'bg-accent text-white shadow-sm'
                    : 'bg-bg-subtle text-text-secondary hover:bg-border'
                }`}
              >
                {w} COIN
              </button>
            ))}
          </div>
          <input
            type="number"
            value={wager}
            onChange={(e) => setWager(Math.max(1, Number(e.target.value)))}
            className="w-full px-4 py-2.5 bg-bg-subtle border border-border rounded-xl text-sm focus:outline-none focus:border-accent"
            placeholder="Custom amount"
          />
        </div>

        {/* Time */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-text-secondary">Time per move</label>
          <div className="grid grid-cols-4 gap-2">
            {TIME_PRESETS.map(t => (
              <button
                key={t.value}
                onClick={() => setTimePerMove(t.value)}
                className={`py-2 rounded-xl text-sm font-medium transition-all ${
                  timePerMove === t.value
                    ? 'bg-accent text-white shadow-sm'
                    : 'bg-bg-subtle text-text-secondary hover:bg-border'
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
            className="flex-1 py-2.5 border border-border text-text-secondary font-medium rounded-xl hover:border-border-hover transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="flex-1 py-2.5 bg-accent text-white font-medium rounded-xl hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Create'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
