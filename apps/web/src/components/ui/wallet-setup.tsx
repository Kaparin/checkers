'use client'

import { useState, useEffect, useCallback } from 'react'
import { useWallet } from '@/contexts/wallet-context'
import { getChainConfig, checkAuthzGrant, getBalance, requestGasFunding } from '@/lib/chain-actions'
import { grantAuthzToRelayer } from '@/lib/chain-tx'

export function WalletSetup() {
  const { address, isConnected } = useWallet()
  const [needsSetup, setNeedsSetup] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

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
      // silently fail — don't block the user
    } finally {
      setChecking(false)
    }
  }, [address])

  useEffect(() => {
    if (isConnected && address) checkStatus()
  }, [isConnected, address, checkStatus])

  /** Single button: fund gas if needed → sign authz grant → done */
  const handleAuthorize = async () => {
    if (!address) return
    setLoading(true)
    setError(null)

    try {
      const config = await getChainConfig()
      if (!config.relayerAddress || !config.contractAddress) {
        throw new Error('Сеть не настроена')
      }

      // Check balance, fund gas if needed (invisible to user)
      const balance = await getBalance(address)
      if (Number(balance) < 50000) {
        await requestGasFunding()
        // Wait for tx inclusion
        await new Promise(r => setTimeout(r, 4000))
      }

      // Sign and broadcast authz grant
      await grantAuthzToRelayer(address, config.relayerAddress, config.contractAddress)

      // Wait for indexing, then verify
      await new Promise(r => setTimeout(r, 5000))
      const granted = await checkAuthzGrant(address)
      if (granted) {
        setNeedsSetup(false)
      } else {
        // May need more time
        await new Promise(r => setTimeout(r, 5000))
        setNeedsSetup(!(await checkAuthzGrant(address)))
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ошибка авторизации'
      // Friendly error messages
      if (msg.includes('Failed to retrieve account from signer') || msg.includes('account from signer')) {
        setError('Не удалось получить аккаунт из кошелька. Попробуйте отключиться и подключиться заново.')
      } else if (msg.includes('Chain not configured') || msg.includes('Сеть не настроена')) {
        setError('Блокчейн ещё не настроен. Попробуйте позже.')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  if (!isConnected || !needsSetup || checking) return null

  return (
    <div className="w-full max-w-lg mx-auto mb-4">
      <div className="bg-bg-card border border-accent/20 rounded-xl p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-accent/10 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
            <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-text">Авторизация для ставок</p>
            <p className="text-xs text-text-muted mt-0.5">
              Разрешите релейеру управлять ставками от вашего имени. Это одноразовое действие.
            </p>
          </div>
        </div>

        <button
          onClick={handleAuthorize}
          disabled={loading}
          className="w-full py-2.5 text-sm font-medium text-white bg-accent rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50"
        >
          {loading ? 'Авторизация...' : 'Авторизовать'}
        </button>

        {error && (
          <p className="text-xs text-danger">{error}</p>
        )}
      </div>
    </div>
  )
}
