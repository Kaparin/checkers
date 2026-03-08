'use client'

import { useState, useEffect, useCallback } from 'react'
import { useWallet } from '@/contexts/wallet-context'
import { getChainConfig, checkAuthzGrant, getBalance, requestGasFunding, formatAXM } from '@/lib/chain-actions'
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
        throw new Error('Chain not configured')
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
      setError(err instanceof Error ? err.message : 'Authorization failed')
    } finally {
      setLoading(false)
    }
  }

  if (!isConnected || !needsSetup || checking) return null

  return (
    <div className="w-full max-w-md mx-auto mb-6">
      <div className="bg-bg-card border border-accent/20 rounded-xl p-4 space-y-3">
        <p className="text-sm text-text-secondary">
          Authorize the relayer to manage wager games on your behalf (one-time).
        </p>

        <button
          onClick={handleAuthorize}
          disabled={loading}
          className="w-full py-2.5 text-sm font-medium text-white bg-accent rounded-xl hover:bg-accent-hover transition-colors disabled:opacity-50"
        >
          {loading ? 'Authorizing...' : 'Authorize for Wagering'}
        </button>

        {error && (
          <p className="text-xs text-danger">{error}</p>
        )}
      </div>
    </div>
  )
}
