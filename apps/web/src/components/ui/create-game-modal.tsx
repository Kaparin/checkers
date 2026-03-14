'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useWallet } from '@/contexts/wallet-context'
import { getBalance, formatAXM, checkAuthzGrant, getChainConfig, requestGasFunding } from '@/lib/chain-actions'
import { grantAuthzToRelayer } from '@/lib/chain-tx'
import { X, Shield, Loader2 } from 'lucide-react'

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
    desc: 'Летающие дамки, захват назад',
  },
  {
    id: 'american' as const,
    name: 'Американские',
    desc: 'Стандартные правила',
  },
]

export function CreateGameModal({ onClose, onCreate }: CreateGameModalProps) {
  const [wager, setWager] = useState(5)
  const [timePerMove, setTimePerMove] = useState(60)
  const [variant, setVariant] = useState<'russian' | 'american'>('russian')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [balance, setBalance] = useState<string | null>(null)
  const [balanceLoading, setBalanceLoading] = useState(true)
  const [hasAuthz, setHasAuthz] = useState<boolean | null>(null)
  const [granting, setGranting] = useState(false)
  const [grantStep, setGrantStep] = useState<string | null>(null)
  const { address } = useWallet()

  useEffect(() => {
    if (!address) return
    setBalanceLoading(true)
    Promise.all([
      getBalance(address),
      checkAuthzGrant(address),
    ])
      .then(([bal, granted]) => {
        setBalance(bal)
        setHasAuthz(granted)
      })
      .catch(() => {
        setBalance(null)
        setHasAuthz(null)
      })
      .finally(() => setBalanceLoading(false))
  }, [address])

  const handleGrantAuthz = async () => {
    if (!address) return
    setGranting(true)
    setGrantStep('Проверка сети...')
    setCreateError(null)
    try {
      const config = await getChainConfig()
      if (!config.relayerAddress || !config.contractAddress) {
        throw new Error('Сеть не настроена: relayer или контракт не указаны')
      }

      setGrantStep('Проверка баланса...')
      const bal = await getBalance(address)
      console.log('[authz] Balance:', bal)

      if (Number(bal) < 50000) {
        setGrantStep('Получение газа для транзакции...')
        try {
          await requestGasFunding()
          // Wait for funding tx to be included
          await new Promise(r => setTimeout(r, 4000))
        } catch (fundErr) {
          console.error('[authz] Gas funding failed:', fundErr)
          // Continue anyway — maybe they have enough gas, or will get a clearer error on sign
        }
      }

      setGrantStep('Подписание транзакции...')
      const txHash = await grantAuthzToRelayer(address, config.relayerAddress, config.contractAddress)
      console.log('[authz] Grant tx hash:', txHash)

      // Poll for grant confirmation (tx needs to be included in a block)
      setGrantStep('Ожидание подтверждения...')
      let confirmed = false
      for (let attempt = 0; attempt < 5; attempt++) {
        await new Promise(r => setTimeout(r, 4000))
        const granted = await checkAuthzGrant(address)
        if (granted) {
          confirmed = true
          break
        }
        setGrantStep(`Ожидание подтверждения... (${attempt + 2}/5)`)
      }

      // Grant confirmed or broadcast succeeded — mark as authorized and auto-create
      setHasAuthz(true)
      setCreateError(null)
      // Auto-trigger game creation so user doesn't have to click again
      setTimeout(() => handleCreate(), 500)
    } catch (err) {
      console.error('[authz] Grant failed:', err)
      const msg = err instanceof Error ? err.message : 'Ошибка авторизации'
      if (msg.includes('account from signer') || msg.includes('десериализации')) {
        setCreateError('Не удалось получить аккаунт. Переподключите кошелёк.')
      } else if (msg.includes('не найден')) {
        setCreateError('Кошелёк не найден. Переподключите кошелёк.')
      } else {
        setCreateError(msg)
      }
    } finally {
      setGranting(false)
      setGrantStep(null)
    }
  }

  const balanceNum = balance ? Number(balance) : 0
  const wagerMicro = wager * 1_000_000
  const insufficientBalance = balance !== null && balanceNum < wagerMicro

  const handleCreate = async () => {
    setCreating(true)
    setCreateError(null)
    if (address) {
      try {
        const freshBalance = await getBalance(address)
        setBalance(freshBalance)
        if (freshBalance && Number(freshBalance) < wager * 1_000_000) {
          setCreateError('Недостаточно средств для этой ставки')
          setCreating(false)
          return
        }
      } catch {
        // proceed — backend will validate
      }
    }
    try {
      await onCreate(String(wager * 1_000_000), timePerMove, variant)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ошибка создания игры'
      // If backend says "not authorized" — show the authorize button
      if (msg.includes('не авторизовали') || msg.includes('unauthorized')) {
        setCreateError(msg)
        setHasAuthz(false)
      } else if (msg.includes('уже есть') || msg.includes('already')) {
        // User already has a waiting game — close modal so they see it in lobby
        setCreateError('У вас уже есть игра. Отмените её или дождитесь соперника.')
      } else {
        setCreateError(msg)
      }
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
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="relative bg-bg-card border border-border rounded-2xl shadow-xl p-6 max-w-[420px] w-full"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Создать игру</h2>
          <button onClick={onClose} className="p-1.5 text-text-muted hover:text-text hover:bg-bg-subtle rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-5">
          {/* Balance */}
          <div className="flex items-center justify-between px-4 py-3 bg-bg-subtle rounded-xl">
            <span className="text-sm text-text-secondary">Баланс</span>
            {balanceLoading ? (
              <div className="h-5 w-20 rounded animate-shimmer" />
            ) : balance !== null ? (
              <span className={`text-sm font-semibold tabular-nums ${insufficientBalance ? 'text-danger' : 'text-text'}`}>
                {formatAXM(balance)} AXM
              </span>
            ) : (
              <span className="text-sm text-text-muted">---</span>
            )}
          </div>

          {/* Authz warning */}
          {hasAuthz === false && !balanceLoading && (
            <div className="bg-accent/5 border border-accent/20 rounded-xl p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-text">Авторизация релеера</p>
                  <p className="text-xs text-text-muted mt-0.5">
                    Разрешите управление ставками. Одноразовое действие.
                  </p>
                </div>
              </div>
              <button
                onClick={handleGrantAuthz}
                disabled={granting}
                className="w-full py-2.5 text-sm font-semibold text-white bg-accent rounded-xl hover:bg-accent-hover transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {granting && <Loader2 className="w-4 h-4 animate-spin" />}
                {granting ? (grantStep || 'Авторизация...') : 'Авторизовать'}
              </button>
            </div>
          )}

          {/* Variant */}
          <div>
            <label className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2 block">Правила</label>
            <div className="grid grid-cols-2 gap-2">
              {VARIANTS.map(v => (
                <button
                  key={v.id}
                  onClick={() => setVariant(v.id)}
                  className={`p-3 rounded-xl text-left transition-all border ${
                    variant === v.id
                      ? 'bg-accent/10 border-accent/40 ring-1 ring-accent/20'
                      : 'bg-bg-subtle border-border hover:border-border-hover'
                  }`}
                >
                  <span className={`text-sm font-semibold block ${variant === v.id ? 'text-accent' : 'text-text'}`}>{v.name}</span>
                  <span className="text-[11px] text-text-muted block mt-0.5">{v.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Wager */}
          <div>
            <label className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2 block">Ставка (AXM)</label>
            <div className="grid grid-cols-3 gap-2 mb-2">
              {WAGER_PRESETS.map(w => (
                <button
                  key={w}
                  onClick={() => setWager(w)}
                  className={`py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    wager === w
                      ? 'bg-accent text-white shadow-sm'
                      : 'bg-bg-subtle text-text-secondary hover:bg-bg-elevated border border-border'
                  }`}
                >
                  {w}
                </button>
              ))}
            </div>
            <input
              type="number"
              min="1"
              max="1000"
              value={wager}
              onChange={(e) => setWager(Math.min(1000, Math.max(1, Number(e.target.value) || 1)))}
              className="w-full px-4 py-2.5 bg-bg-subtle border border-border rounded-xl text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 tabular-nums"
              placeholder="Другая сумма"
            />
            {insufficientBalance && (
              <p className="text-xs text-danger mt-1.5">Недостаточно средств</p>
            )}
          </div>

          {/* Time */}
          <div>
            <label className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2 block">Время на ход</label>
            <div className="grid grid-cols-4 gap-2">
              {TIME_PRESETS.map(t => (
                <button
                  key={t.value}
                  onClick={() => setTimePerMove(t.value)}
                  className={`py-2.5 rounded-xl text-sm font-semibold transition-all ${
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

          {/* Error */}
          {createError && (
            <div className={`px-4 py-3 rounded-xl border ${
              hasAuthz === false
                ? 'bg-accent/5 border-accent/20'
                : 'bg-danger/10 border-danger/20'
            }`}>
              <p className={`text-xs ${hasAuthz === false ? 'text-accent' : 'text-danger'}`}>{createError}</p>
              {hasAuthz === false && !granting && (
                <button
                  onClick={handleGrantAuthz}
                  className="mt-2 w-full py-2 text-sm font-semibold text-white bg-accent rounded-lg hover:bg-accent-hover transition-colors flex items-center justify-center gap-2"
                >
                  <Shield className="w-4 h-4" />
                  Авторизовать сейчас
                </button>
              )}
              {granting && (
                <div className="mt-2 flex items-center justify-center gap-2 py-2 text-sm text-accent">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {grantStep || 'Авторизация...'}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 text-sm font-semibold text-text-secondary bg-bg-subtle border border-border rounded-xl hover:bg-bg-elevated transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || insufficientBalance || balanceLoading || hasAuthz === false || granting}
              className="flex-1 py-2.5 text-sm font-semibold text-white bg-accent rounded-xl hover:bg-accent-hover transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {creating && <Loader2 className="w-4 h-4 animate-spin" />}
              {creating ? 'Создание...' : 'Создать'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
