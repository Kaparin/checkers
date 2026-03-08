'use client'

import { useState, useEffect, useCallback } from 'react'
import { useWallet } from '@/contexts/wallet-context'
import { getChainConfig, checkAuthzGrant, getBalance, requestGasFunding, formatAXM } from '@/lib/chain-actions'
import { grantAuthzToRelayer } from '@/lib/chain-tx'

type SetupStep = 'checking' | 'need-gas' | 'need-authz' | 'ready' | 'error'

export function WalletSetup() {
  const { address, isConnected } = useWallet()
  const [step, setStep] = useState<SetupStep>('checking')
  const [balance, setBalance] = useState('0')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(false)

  const checkStatus = useCallback(async () => {
    if (!address) return
    setStep('checking')
    setError(null)

    try {
      const [config, bal, hasGrant] = await Promise.all([
        getChainConfig(),
        getBalance(address),
        checkAuthzGrant(address),
      ])

      setBalance(bal)

      if (!config.relayerReady) {
        setStep('ready') // relayer not set up — skip for now
        return
      }

      if (hasGrant) {
        setStep('ready')
        return
      }

      // Need authz. Check if user has gas
      if (Number(bal) < 50000) {
        setStep('need-gas')
      } else {
        setStep('need-authz')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Check failed')
      setStep('error')
    }
  }, [address])

  useEffect(() => {
    if (isConnected && address) {
      checkStatus()
    }
  }, [isConnected, address, checkStatus])

  const handleRequestGas = async () => {
    setLoading(true)
    setError(null)
    try {
      await requestGasFunding()
      // Wait a moment for the tx to be included
      await new Promise(r => setTimeout(r, 3000))
      await checkStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Funding failed')
    } finally {
      setLoading(false)
    }
  }

  const handleGrantAuthz = async () => {
    setLoading(true)
    setError(null)
    try {
      const config = await getChainConfig()
      if (!config.relayerAddress || !config.contractAddress) {
        throw new Error('Chain config not ready')
      }

      await grantAuthzToRelayer(address!, config.relayerAddress, config.contractAddress)

      // Wait for indexing
      await new Promise(r => setTimeout(r, 5000))
      await checkStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authorization failed')
    } finally {
      setLoading(false)
    }
  }

  if (!isConnected || step === 'ready' || step === 'checking' || dismissed) return null

  return (
    <div className="w-full max-w-md mx-auto mb-6">
      <div className="bg-bg-card border border-accent/20 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text">Wallet Setup</h3>
          <button
            onClick={() => setDismissed(true)}
            className="text-text-muted hover:text-text text-xs"
          >
            Later
          </button>
        </div>

        <p className="text-xs text-text-secondary">
          To play with AXM wagers, authorize the relayer to manage games on your behalf.
        </p>

        {/* Balance display */}
        <div className="flex items-center justify-between px-3 py-2 bg-bg-subtle rounded-lg">
          <span className="text-xs text-text-muted">Balance</span>
          <span className="text-sm font-mono font-medium">{formatAXM(balance)} AXM</span>
        </div>

        {step === 'need-gas' && (
          <div className="space-y-2">
            <p className="text-xs text-warning">
              You need a small amount of AXM for the authorization transaction gas.
            </p>
            <button
              onClick={handleRequestGas}
              disabled={loading}
              className="w-full py-2 text-sm font-medium text-white bg-accent rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              {loading ? 'Requesting...' : 'Get Gas (free)'}
            </button>
          </div>
        )}

        {step === 'need-authz' && (
          <div className="space-y-2">
            <p className="text-xs text-text-secondary">
              Sign a one-time authorization to allow the relayer to create and manage games with your wagers.
            </p>
            <button
              onClick={handleGrantAuthz}
              disabled={loading}
              className="w-full py-2 text-sm font-medium text-white bg-accent rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              {loading ? 'Authorizing...' : 'Authorize Relayer'}
            </button>
          </div>
        )}

        {error && (
          <div className="text-xs text-danger bg-danger/5 px-3 py-2 rounded-lg">
            {error}
          </div>
        )}

        {step === 'error' && (
          <button
            onClick={checkStatus}
            className="text-xs text-accent hover:underline"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  )
}
