'use client'

import { useState, useEffect, useCallback } from 'react'
import { useWallet } from '@/contexts/wallet-context'
import { getReferralCode, getReferralStats, applyReferralCode, type ReferralStats } from '@/lib/api'
import { Skeleton } from '@/components/ui/skeleton'

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
      <div className="max-w-2xl mx-auto text-center py-16">
        <h1 className="text-2xl font-bold mb-4">Реферальная программа</h1>
        <p className="text-text-secondary">Подключите кошелёк для доступа к реферальной программе.</p>
      </div>
    )
  }

  const earned = stats ? (Number(stats.totalEarned) / 1_000_000).toFixed(2) : '0.00'
  const claimed = stats ? (Number(stats.totalClaimed) / 1_000_000).toFixed(2) : '0.00'

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Реферальная программа</h1>

      {/* Your referral link */}
      <div className="bg-bg-card border border-border rounded-2xl p-6 space-y-4">
        <h2 className="text-lg font-semibold">Ваша реферальная ссылка</h2>
        <p className="text-sm text-text-secondary">
          Поделитесь ссылкой и получайте до 5% от комиссий с игр ваших рефералов (3 уровня).
        </p>

        {loading ? (
          <Skeleton className="h-11 w-full" />
        ) : (
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={referralLink}
              className="flex-1 bg-bg-subtle border border-border rounded-lg px-3 py-2.5 text-sm font-mono text-text-secondary select-all"
            />
            <button
              onClick={handleCopy}
              className="px-4 py-2.5 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-hover transition-colors shrink-0"
            >
              {copied ? 'Скопировано!' : 'Копировать'}
            </button>
          </div>
        )}

        <div className="text-xs text-text-muted">
          Код: <span className="font-mono font-semibold text-text">{code || '...'}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-bg-card border border-border rounded-2xl p-5 text-center">
          {loading ? (
            <Skeleton className="h-8 w-12 mx-auto mb-1" />
          ) : (
            <div className="text-2xl font-bold">{stats?.referralCount ?? 0}</div>
          )}
          <div className="text-xs text-text-secondary mt-1">Рефералы</div>
        </div>
        <div className="bg-bg-card border border-border rounded-2xl p-5 text-center">
          {loading ? (
            <Skeleton className="h-8 w-16 mx-auto mb-1" />
          ) : (
            <div className="text-2xl font-bold text-success">{earned}</div>
          )}
          <div className="text-xs text-text-secondary mt-1">Заработано (AXM)</div>
        </div>
        <div className="bg-bg-card border border-border rounded-2xl p-5 text-center">
          {loading ? (
            <Skeleton className="h-8 w-16 mx-auto mb-1" />
          ) : (
            <div className="text-2xl font-bold">{claimed}</div>
          )}
          <div className="text-xs text-text-secondary mt-1">Выведено (AXM)</div>
        </div>
      </div>

      {/* Apply referral code */}
      <div className="bg-bg-card border border-border rounded-2xl p-6 space-y-4">
        <h2 className="text-lg font-semibold">Есть реферальный код?</h2>
        <div className="flex items-center gap-2">
          <input
            value={applyCode}
            onChange={(e) => { setApplyCode(e.target.value.toUpperCase()); setApplyError(''); setApplySuccess(false) }}
            placeholder="Введите код..."
            maxLength={8}
            className="flex-1 bg-bg-subtle border border-border rounded-lg px-3 py-2.5 text-sm font-mono placeholder:text-text-muted uppercase"
          />
          <button
            onClick={handleApply}
            disabled={applying || !applyCode.trim()}
            className="px-4 py-2.5 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-hover transition-colors shrink-0 disabled:opacity-50"
          >
            {applying ? 'Применение...' : 'Применить'}
          </button>
        </div>
        {applyError && <p className="text-sm text-danger">{applyError}</p>}
        {applySuccess && <p className="text-sm text-success">Реферальный код успешно применён!</p>}
      </div>

      {/* Reward tiers */}
      <div className="bg-bg-card border border-border rounded-2xl p-6 space-y-3">
        <h2 className="text-lg font-semibold">Уровни наград</h2>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between py-2 border-b border-border">
            <span className="text-text-secondary">Уровень 1 (прямой реферал)</span>
            <span className="font-semibold">3% от комиссии</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border">
            <span className="text-text-secondary">Уровень 2 (реферал реферала)</span>
            <span className="font-semibold">1.5% от комиссии</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-text-secondary">Уровень 3</span>
            <span className="font-semibold">0.5% от комиссии</span>
          </div>
        </div>
      </div>

      {/* Recent rewards */}
      {stats && stats.recentRewards.length > 0 && (
        <div className="bg-bg-card border border-border rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="text-lg font-semibold">Последние награды</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-text-secondary">
                <th className="text-left p-4 font-medium">От</th>
                <th className="text-center p-4 font-medium">Уровень</th>
                <th className="text-right p-4 font-medium">Сумма</th>
                <th className="text-right p-4 font-medium">Дата</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentRewards.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="p-4 font-mono text-xs">
                    {r.fromPlayerAddress.slice(0, 8)}...{r.fromPlayerAddress.slice(-4)}
                  </td>
                  <td className="p-4 text-center">
                    <span className="px-2 py-0.5 bg-accent/10 text-accent text-xs font-semibold rounded-full">
                      L{r.level}
                    </span>
                  </td>
                  <td className="p-4 text-right font-medium text-success">
                    +{(Number(r.amount) / 1_000_000).toFixed(2)} AXM
                  </td>
                  <td className="p-4 text-right text-text-muted text-xs">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
