'use client'

import { useState, useEffect, useCallback } from 'react'
import { useWallet } from '@/contexts/wallet-context'
import { getReferralCode, getReferralStats, applyReferralCode, type ReferralStats } from '@/lib/api'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Users,
  Link2,
  Copy,
  Check,
  Gift,
  Layers,
  Wallet,
  TrendingUp,
  Clock,
  ArrowRight,
  WalletCards,
  Info,
} from 'lucide-react'

export default function ReferralsPage() {
  const { isConnected } = useWallet()
  const [stats, setStats] = useState<ReferralStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [code, setCode] = useState('')
  const [copied, setCopied] = useState(false)
  const [applyCode, setApplyCode] = useState('')
  const [applyError, setApplyError] = useState('')
  const [applySuccess, setApplySuccess] = useState(false)
  const [applying, setApplying] = useState(false)

  const loadData = useCallback(async () => {
    if (!isConnected) return
    setLoading(true)
    try {
      const [codeRes, statsRes] = await Promise.all([
        getReferralCode(),
        getReferralStats(),
      ])
      setCode(codeRes.code)
      setStats(statsRes)
    } catch {
      // not authed or error
    } finally {
      setLoading(false)
    }
  }, [isConnected])

  useEffect(() => { loadData() }, [loadData])

  const referralLink = code
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}?ref=${code}`
    : ''

  const handleCopy = async () => {
    if (!referralLink) return
    await navigator.clipboard.writeText(referralLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleApply = async () => {
    if (!applyCode.trim()) return
    setApplying(true)
    setApplyError('')
    setApplySuccess(false)
    try {
      await applyReferralCode(applyCode.trim().toUpperCase())
      setApplySuccess(true)
      setApplyCode('')
      loadData()
    } catch (err: any) {
      setApplyError(err.message || 'Не удалось применить код')
    } finally {
      setApplying(false)
    }
  }

  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16 space-y-4">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent/10 mb-2">
          <WalletCards className="w-7 h-7 text-accent" />
        </div>
        <h1 className="text-2xl font-bold">Реферальная программа</h1>
        <p className="text-text-secondary text-sm max-w-sm mx-auto">
          Подключите кошелёк для доступа к реферальной программе.
        </p>
      </div>
    )
  }

  const earned = stats ? (Number(stats.totalEarned) / 1_000_000).toFixed(2) : '0.00'
  const claimed = stats ? (Number(stats.totalClaimed) / 1_000_000).toFixed(2) : '0.00'

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-accent/10">
          <Users className="w-6 h-6 text-accent" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Реферальная программа</h1>
          <p className="text-text-secondary text-sm">Приглашайте друзей и зарабатывайте</p>
        </div>
      </div>

      {/* Your referral link */}
      <div className="bg-bg-card border border-border rounded-2xl p-6 space-y-4 hover:border-border-hover transition-all">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent/10">
            <Link2 className="w-4 h-4 text-accent" />
          </div>
          <h2 className="text-lg font-semibold">Ваша реферальная ссылка</h2>
        </div>
        <p className="text-sm text-text-secondary">
          Поделитесь ссылкой и получайте до 5% от комиссий с игр ваших рефералов (3 уровня).
        </p>

        {loading ? (
          <Skeleton className="h-11 w-full rounded-xl" />
        ) : (
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={referralLink}
              className="flex-1 bg-bg-subtle border border-border rounded-xl px-4 py-2.5 text-sm font-mono text-text-secondary select-all focus:outline-none focus:border-border-hover transition-colors"
            />
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-accent text-white text-sm font-medium rounded-xl hover:bg-accent-hover transition-colors shrink-0"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  Скопировано!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Копировать
                </>
              )}
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-text-muted">
          <span>Код:</span>
          <span className="font-mono font-semibold text-text bg-bg-subtle px-2 py-0.5 rounded-md">{code || '...'}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-bg-card border border-border rounded-2xl p-5 hover:border-border-hover hover:shadow-card-hover transition-all">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent/10 mx-auto mb-3">
            <Users className="w-4 h-4 text-accent" />
          </div>
          {loading ? (
            <Skeleton className="h-8 w-12 mx-auto mb-1" />
          ) : (
            <div className="text-2xl font-bold text-center">{stats?.referralCount ?? 0}</div>
          )}
          <div className="text-xs text-text-secondary text-center mt-1">Рефералы</div>
        </div>

        <div className="bg-bg-card border border-border rounded-2xl p-5 hover:border-border-hover hover:shadow-card-hover transition-all">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-success/10 mx-auto mb-3">
            <TrendingUp className="w-4 h-4 text-success" />
          </div>
          {loading ? (
            <Skeleton className="h-8 w-16 mx-auto mb-1" />
          ) : (
            <div className="text-2xl font-bold text-center text-success">{earned}</div>
          )}
          <div className="text-xs text-text-secondary text-center mt-1">Заработано (AXM)</div>
        </div>

        <div className="bg-bg-card border border-border rounded-2xl p-5 hover:border-border-hover hover:shadow-card-hover transition-all">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gold/10 mx-auto mb-3">
            <Wallet className="w-4 h-4 text-gold" />
          </div>
          {loading ? (
            <Skeleton className="h-8 w-16 mx-auto mb-1" />
          ) : (
            <div className="text-2xl font-bold text-center">{claimed}</div>
          )}
          <div className="text-xs text-text-secondary text-center mt-1">Выведено (AXM)</div>
        </div>
      </div>

      {/* Apply referral code */}
      <div className="bg-bg-card border border-border rounded-2xl p-6 space-y-4 hover:border-border-hover transition-all">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gold/10">
            <Gift className="w-4 h-4 text-gold" />
          </div>
          <h2 className="text-lg font-semibold">Есть реферальный код?</h2>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={applyCode}
            onChange={(e) => { setApplyCode(e.target.value.toUpperCase()); setApplyError(''); setApplySuccess(false) }}
            placeholder="Введите код..."
            maxLength={8}
            className="flex-1 bg-bg-subtle border border-border rounded-xl px-4 py-2.5 text-sm font-mono placeholder:text-text-muted uppercase focus:outline-none focus:border-border-hover transition-colors"
          />
          <button
            onClick={handleApply}
            disabled={applying || !applyCode.trim()}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-accent text-white text-sm font-medium rounded-xl hover:bg-accent-hover transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {applying ? (
              'Применение...'
            ) : (
              <>
                <ArrowRight className="w-4 h-4" />
                Применить
              </>
            )}
          </button>
        </div>
        {applyError && (
          <div className="flex items-center gap-2 text-sm text-danger">
            <Info className="w-4 h-4 shrink-0" />
            {applyError}
          </div>
        )}
        {applySuccess && (
          <div className="flex items-center gap-2 text-sm text-success">
            <Check className="w-4 h-4 shrink-0" />
            Реферальный код успешно применён!
          </div>
        )}
      </div>

      {/* Reward tiers */}
      <div className="bg-bg-card border border-border rounded-2xl p-6 space-y-4 hover:border-border-hover transition-all">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-purple-500/10">
            <Layers className="w-4 h-4 text-purple-400" />
          </div>
          <h2 className="text-lg font-semibold">Уровни наград</h2>
        </div>
        <div className="space-y-0">
          <div className="flex items-center justify-between py-3 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-6 h-6 rounded-md bg-accent/10">
                <span className="text-xs font-bold text-accent">1</span>
              </div>
              <span className="text-sm text-text-secondary">Прямой реферал</span>
            </div>
            <span className="text-sm font-semibold text-success">3%</span>
          </div>
          <div className="flex items-center justify-between py-3 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-6 h-6 rounded-md bg-accent/10">
                <span className="text-xs font-bold text-accent">2</span>
              </div>
              <span className="text-sm text-text-secondary">Реферал реферала</span>
            </div>
            <span className="text-sm font-semibold text-gold">1.5%</span>
          </div>
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-6 h-6 rounded-md bg-accent/10">
                <span className="text-xs font-bold text-accent">3</span>
              </div>
              <span className="text-sm text-text-secondary">Уровень 3</span>
            </div>
            <span className="text-sm font-semibold text-text-secondary">0.5%</span>
          </div>
        </div>
      </div>

      {/* Recent rewards */}
      {stats && stats.recentRewards.length > 0 && (
        <div className="bg-bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-success/10">
              <TrendingUp className="w-4 h-4 text-success" />
            </div>
            <h2 className="text-lg font-semibold">Последние награды</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-6 py-3 font-medium text-text-secondary text-xs uppercase tracking-wider">От</th>
                  <th className="text-center px-6 py-3 font-medium text-text-secondary text-xs uppercase tracking-wider">Уровень</th>
                  <th className="text-right px-6 py-3 font-medium text-text-secondary text-xs uppercase tracking-wider">Сумма</th>
                  <th className="text-right px-6 py-3 font-medium text-text-secondary text-xs uppercase tracking-wider">Дата</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentRewards.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-bg-subtle/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-text-secondary">
                      {r.fromPlayerAddress.slice(0, 8)}...{r.fromPlayerAddress.slice(-4)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-accent/10 text-accent text-xs font-semibold rounded-lg">
                        <Layers className="w-3 h-3" />
                        L{r.level}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-success">
                      +{(Number(r.amount) / 1_000_000).toFixed(2)} AXM
                    </td>
                    <td className="px-6 py-4 text-right text-text-muted text-xs">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(r.createdAt).toLocaleDateString()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
