'use client'

import { useState, useEffect, useCallback } from 'react'
import { useWallet } from '@/contexts/wallet-context'
import { getChainConfig, checkAuthzGrant, getBalance, requestGasFunding } from '@/lib/chain-actions'
import { grantAuthzToRelayer } from '@/lib/chain-tx'
import { Shield, Loader2, CheckCircle2 } from 'lucide-react'

export function WalletSetup() {
  const { address, isConnected } = useWallet()
  const [needsSetup, setNeedsSetup] = useState(false)
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [done, setDone] = useState(false)

  const checkStatus = useCallback(async () => {
    if (!address) return
    setChecking(true)
    try {
      const [config, hasGrant] = await Promise.all([
        getChainConfig(),
        checkAuthzGrant(address),
      ])
      setNeedsSetup(config.relayerReady && !hasGrant)
    } catch {
      // silently fail
    } finally {
      setChecking(false)
    }
  }, [address])

  useEffect(() => {
    if (isConnected && address) checkStatus()
  }, [isConnected, address, checkStatus])

  const handleAuthorize = async () => {
    if (!address) return
    setLoading(true)
    setError(null)
    setStep('Проверка сети...')

    try {
      const config = await getChainConfig()
      if (!config.relayerAddress || !config.contractAddress) {
        throw new Error('Сеть не настроена')
      }

      setStep('Проверка баланса...')
      const balance = await getBalance(address)
      if (Number(balance) < 50000) {
        setStep('Получение газа...')
        await requestGasFunding()
        await new Promise(r => setTimeout(r, 4000))
      }

      setStep('Подпишите транзакцию...')
      await grantAuthzToRelayer(address, config.relayerAddress, config.contractAddress)

      setStep('Подтверждение...')
      await new Promise(r => setTimeout(r, 5000))
      const granted = await checkAuthzGrant(address)
      if (granted) {
        setDone(true)
        setTimeout(() => setNeedsSetup(false), 2000)
      } else {
        await new Promise(r => setTimeout(r, 5000))
        const g2 = await checkAuthzGrant(address)
        if (g2) {
          setDone(true)
          setTimeout(() => setNeedsSetup(false), 2000)
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ошибка авторизации'
      if (msg.includes('account from signer')) {
        setError('Не удалось получить аккаунт. Переподключите кошелёк.')
      } else if (msg.includes('Сеть не настроена')) {
        setError('Блокчейн ещё не настроен. Попробуйте позже.')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
      setStep(null)
    }
  }

  if (!isConnected || !needsSetup || checking) return null

  return (
    <div className="w-full max-w-2xl mx-auto mb-6">
      <div className={`border rounded-2xl p-5 transition-all ${
        done
          ? 'bg-success/5 border-success/20'
          : 'bg-accent/5 border-accent/20'
      }`}>
        <div className="flex items-start gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            done ? 'bg-success/10' : 'bg-accent/10'
          }`}>
            {done ? (
              <CheckCircle2 className="w-5 h-5 text-success" />
            ) : (
              <Shield className="w-5 h-5 text-accent" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text">
              {done ? 'Авторизация завершена' : 'Авторизация для игры на ставку'}
            </p>
            <p className="text-xs text-text-secondary mt-1 leading-relaxed">
              {done
                ? 'Вы можете создавать и принимать игры на AXM.'
                : 'Разрешите релеер управлять ставками от вашего имени. Это одноразовое действие.'
              }
            </p>

            {!done && (
              <button
                onClick={handleAuthorize}
                disabled={loading}
                className="mt-3 px-5 py-2 text-sm font-semibold text-white bg-accent rounded-xl hover:bg-accent-hover transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? (step || 'Авторизация...') : 'Авторизовать'}
              </button>
            )}

            {error && (
              <div className="mt-3 px-3 py-2 bg-danger/10 border border-danger/20 rounded-lg">
                <p className="text-xs text-danger">{error}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
