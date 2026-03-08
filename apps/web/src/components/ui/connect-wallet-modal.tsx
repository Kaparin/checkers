'use client'

import { useState } from 'react'
import { useWallet } from '@/contexts/wallet-context'

type Step = 'choose' | 'import' | 'unlock'

export function ConnectWalletModal() {
  const { showConnectModal, closeConnectModal, hasSaved, savedWallets, connectWithMnemonic, unlockWithPin, isConnecting, error } = useWallet()
  const [step, setStep] = useState<Step>('choose')
  const [mnemonic, setMnemonic] = useState('')
  const [pin, setPin] = useState('')
  const [label, setLabel] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null)

  if (!showConnectModal) return null

  const resetAndClose = () => {
    setStep('choose')
    setMnemonic('')
    setPin('')
    setLabel('')
    setLocalError(null)
    setSelectedAddress(null)
    closeConnectModal()
  }

  const handleImport = async () => {
    if (!mnemonic.trim() || !pin || pin.length < 4) {
      setLocalError('Enter mnemonic and PIN (min 4 chars)')
      return
    }
    setLocalError(null)
    try {
      await connectWithMnemonic(mnemonic.trim(), pin, label || undefined)
      resetAndClose()
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed')
    }
  }

  const handleUnlock = async () => {
    if (!pin || pin.length < 4) {
      setLocalError('Enter PIN (min 4 chars)')
      return
    }
    setLocalError(null)
    try {
      await unlockWithPin(pin, selectedAddress || undefined)
      resetAndClose()
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed')
    }
  }

  const displayError = localError || error

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={resetAndClose}>
      <div className="bg-bg-card border border-border rounded-2xl shadow-xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-text">
            {step === 'choose' && 'Connect Wallet'}
            {step === 'import' && 'Import Wallet'}
            {step === 'unlock' && 'Unlock Wallet'}
          </h2>
          <button onClick={resetAndClose} className="text-text-muted hover:text-text text-xl leading-none">&times;</button>
        </div>

        {/* Choose step */}
        {step === 'choose' && (
          <div className="space-y-3">
            {hasSaved && (
              <>
                <p className="text-sm text-text-secondary mb-2">Saved wallets:</p>
                {savedWallets.map(w => (
                  <button
                    key={w.address}
                    onClick={() => { setSelectedAddress(w.address); setStep('unlock') }}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-bg-subtle border border-border rounded-xl hover:border-accent transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent text-sm font-bold">
                      {(w.label || w.address)[0].toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      {w.label && <p className="text-sm font-medium text-text truncate">{w.label}</p>}
                      <p className="text-xs text-text-muted font-mono truncate">{w.address}</p>
                    </div>
                  </button>
                ))}
                <div className="border-t border-border my-3" />
              </>
            )}
            <button
              onClick={() => setStep('import')}
              className="w-full px-4 py-3 bg-accent text-white font-medium rounded-xl hover:bg-accent-hover transition-colors"
            >
              Import with Mnemonic
            </button>
          </div>
        )}

        {/* Import step */}
        {step === 'import' && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-text-secondary mb-1.5 block">Mnemonic phrase</label>
              <textarea
                value={mnemonic}
                onChange={e => setMnemonic(e.target.value.toLowerCase())}
                placeholder="Enter 12 or 24 words..."
                rows={3}
                className="w-full px-3 py-2.5 bg-bg-subtle border border-border rounded-xl text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-accent/50"
                autoFocus
              />
            </div>
            <div>
              <label className="text-sm font-medium text-text-secondary mb-1.5 block">PIN (to encrypt wallet)</label>
              <input
                type="password"
                value={pin}
                onChange={e => setPin(e.target.value)}
                placeholder="Min 4 characters"
                className="w-full px-3 py-2.5 bg-bg-subtle border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-text-secondary mb-1.5 block">Label (optional)</label>
              <input
                type="text"
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="e.g. Main wallet"
                className="w-full px-3 py-2.5 bg-bg-subtle border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
            </div>

            {displayError && <p className="text-sm text-danger">{displayError}</p>}

            <div className="flex gap-3">
              <button onClick={() => { setStep('choose'); setLocalError(null) }} className="flex-1 px-4 py-2.5 text-sm font-medium text-text-secondary border border-border rounded-xl hover:border-border-hover transition-colors">
                Back
              </button>
              <button onClick={handleImport} disabled={isConnecting} className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-accent rounded-xl hover:bg-accent-hover transition-colors disabled:opacity-50">
                {isConnecting ? 'Connecting...' : 'Connect'}
              </button>
            </div>
          </div>
        )}

        {/* Unlock step */}
        {step === 'unlock' && (
          <div className="space-y-4">
            <div className="px-4 py-3 bg-bg-subtle border border-border rounded-xl">
              <p className="text-xs text-text-muted font-mono truncate">{selectedAddress}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-text-secondary mb-1.5 block">Enter PIN</label>
              <input
                type="password"
                value={pin}
                onChange={e => setPin(e.target.value)}
                placeholder="Your wallet PIN"
                className="w-full px-3 py-2.5 bg-bg-subtle border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleUnlock()}
              />
            </div>

            {displayError && <p className="text-sm text-danger">{displayError}</p>}

            <div className="flex gap-3">
              <button onClick={() => { setStep('choose'); setLocalError(null); setPin('') }} className="flex-1 px-4 py-2.5 text-sm font-medium text-text-secondary border border-border rounded-xl hover:border-border-hover transition-colors">
                Back
              </button>
              <button onClick={handleUnlock} disabled={isConnecting} className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-accent rounded-xl hover:bg-accent-hover transition-colors disabled:opacity-50">
                {isConnecting ? 'Unlocking...' : 'Unlock'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
