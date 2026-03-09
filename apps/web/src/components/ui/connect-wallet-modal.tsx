'use client'

import { useState } from 'react'
import { useWallet } from '@/contexts/wallet-context'

type Step = 'choose' | 'import' | 'unlock' | 'confirm-delete'

export function ConnectWalletModal() {
  const {
    showConnectModal, closeConnectModal, hasSaved, savedWallets,
    connectWithMnemonic, unlockWithPin, forgetWallet, isConnecting, error,
    address: connectedAddress,
  } = useWallet()
  const [step, setStep] = useState<Step>('choose')
  const [mnemonic, setMnemonic] = useState('')
  const [pin, setPin] = useState('')
  const [label, setLabel] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ address: string; label?: string } | null>(null)

  if (!showConnectModal) return null

  const resetAndClose = () => {
    setStep('choose')
    setMnemonic('')
    setPin('')
    setLabel('')
    setLocalError(null)
    setSelectedAddress(null)
    setDeleteTarget(null)
    closeConnectModal()
  }

  const handleImport = async () => {
    if (!mnemonic.trim() || !pin || pin.length < 4) {
      setLocalError('Введите мнемонику и PIN (мин. 4 символа)')
      return
    }
    setLocalError(null)
    try {
      await connectWithMnemonic(mnemonic.trim(), pin, label || undefined)
      resetAndClose()
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Ошибка')
    }
  }

  const handleUnlock = async () => {
    if (!pin || pin.length < 4) {
      setLocalError('Введите PIN (мин. 4 символа)')
      return
    }
    setLocalError(null)
    try {
      await unlockWithPin(pin, selectedAddress || undefined)
      resetAndClose()
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Ошибка')
    }
  }

  const handleDelete = () => {
    if (!deleteTarget) return
    forgetWallet(deleteTarget.address)
    setDeleteTarget(null)
    setStep('choose')
  }

  const displayError = localError || error

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={resetAndClose}>
      <div className="bg-bg-card border border-border rounded-2xl shadow-xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text">
            {step === 'choose' && 'Подключить кошелёк'}
            {step === 'import' && 'Импорт кошелька'}
            {step === 'unlock' && 'Разблокировать'}
            {step === 'confirm-delete' && 'Удалить кошелёк'}
          </h2>
          <button onClick={resetAndClose} className="text-text-muted hover:text-text text-xl leading-none">&times;</button>
        </div>

        {/* Security banner */}
        {(step === 'choose' || step === 'import') && (
          <div className="mb-4 px-3 py-2.5 bg-success/5 border border-success/20 rounded-xl flex items-start gap-2.5">
            <svg className="w-4 h-4 text-success shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <div>
              <p className="text-xs text-success font-medium">Ваши ключи в безопасности</p>
              <p className="text-[11px] text-text-secondary mt-0.5 leading-relaxed">
                Сид-фразы шифруются AES-256 и хранятся только на вашем устройстве.
                Мы никогда не передаём и не сохраняем их на сервере.
              </p>
            </div>
          </div>
        )}

        {/* Choose step */}
        {step === 'choose' && (
          <div className="space-y-3">
            {hasSaved && (
              <>
                <p className="text-sm text-text-secondary mb-2">Сохранённые кошельки:</p>
                {savedWallets.map(w => (
                  <div
                    key={w.address}
                    className={`flex items-center gap-3 px-4 py-3 bg-bg-subtle border rounded-xl transition-colors ${
                      connectedAddress === w.address
                        ? 'border-success/40 bg-success/5'
                        : 'border-border hover:border-accent'
                    }`}
                  >
                    <button
                      onClick={() => {
                        if (connectedAddress === w.address) return
                        setSelectedAddress(w.address)
                        setStep('unlock')
                      }}
                      className="flex items-center gap-3 flex-1 min-w-0 text-left"
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                        connectedAddress === w.address
                          ? 'bg-success/10 text-success'
                          : 'bg-accent/10 text-accent'
                      }`}>
                        {(w.label || w.address)[0].toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {w.label && <p className="text-sm font-medium text-text truncate">{w.label}</p>}
                          {connectedAddress === w.address && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-success/10 text-success font-medium shrink-0">
                              активен
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-text-muted font-mono truncate">{w.address}</p>
                      </div>
                    </button>
                    {/* Delete button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteTarget({ address: w.address, label: w.label })
                        setStep('confirm-delete')
                      }}
                      className="p-1.5 text-text-muted hover:text-danger transition-colors shrink-0 rounded-lg hover:bg-danger/5"
                      title="Удалить кошелёк"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
                <div className="border-t border-border my-3" />
              </>
            )}
            <button
              onClick={() => setStep('import')}
              className="w-full px-4 py-3 bg-accent text-white font-medium rounded-xl hover:bg-accent-hover transition-colors"
            >
              Импортировать кошелёк
            </button>
          </div>
        )}

        {/* Import step */}
        {step === 'import' && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-text-secondary mb-1.5 block">Мнемоническая фраза</label>
              <textarea
                value={mnemonic}
                onChange={e => setMnemonic(e.target.value.toLowerCase())}
                placeholder="Введите 12 или 24 слова..."
                rows={3}
                className="w-full px-3 py-2.5 bg-bg-subtle border border-border rounded-xl text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-accent/50"
                autoFocus
              />
            </div>
            <div>
              <label className="text-sm font-medium text-text-secondary mb-1.5 block">PIN-код (для шифрования)</label>
              <input
                type="password"
                value={pin}
                onChange={e => setPin(e.target.value)}
                placeholder="Минимум 4 символа"
                className="w-full px-3 py-2.5 bg-bg-subtle border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-text-secondary mb-1.5 block">Название (необязательно)</label>
              <input
                type="text"
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="Например: Основной"
                className="w-full px-3 py-2.5 bg-bg-subtle border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
            </div>

            {displayError && <p className="text-sm text-danger">{displayError}</p>}

            <div className="flex gap-3">
              <button onClick={() => { setStep('choose'); setLocalError(null) }} className="flex-1 px-4 py-2.5 text-sm font-medium text-text-secondary border border-border rounded-xl hover:border-border-hover transition-colors">
                Назад
              </button>
              <button onClick={handleImport} disabled={isConnecting} className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-accent rounded-xl hover:bg-accent-hover transition-colors disabled:opacity-50">
                {isConnecting ? 'Подключение...' : 'Подключить'}
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
              <label className="text-sm font-medium text-text-secondary mb-1.5 block">Введите PIN-код</label>
              <input
                type="password"
                value={pin}
                onChange={e => setPin(e.target.value)}
                placeholder="PIN-код вашего кошелька"
                className="w-full px-3 py-2.5 bg-bg-subtle border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleUnlock()}
              />
            </div>

            {displayError && <p className="text-sm text-danger">{displayError}</p>}

            <div className="flex gap-3">
              <button onClick={() => { setStep('choose'); setLocalError(null); setPin('') }} className="flex-1 px-4 py-2.5 text-sm font-medium text-text-secondary border border-border rounded-xl hover:border-border-hover transition-colors">
                Назад
              </button>
              <button onClick={handleUnlock} disabled={isConnecting} className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-accent rounded-xl hover:bg-accent-hover transition-colors disabled:opacity-50">
                {isConnecting ? 'Разблокировка...' : 'Разблокировать'}
              </button>
            </div>
          </div>
        )}

        {/* Confirm delete step */}
        {step === 'confirm-delete' && deleteTarget && (
          <div className="space-y-4">
            <div className="px-4 py-4 bg-danger/5 border border-danger/20 rounded-xl text-center">
              <svg className="w-10 h-10 text-danger mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <p className="text-sm font-medium text-text mb-1">Удалить кошелёк?</p>
              <p className="text-xs text-text-secondary mb-2">
                {deleteTarget.label && <><span className="font-medium">{deleteTarget.label}</span> — </>}
                <span className="font-mono">{deleteTarget.address.slice(0, 12)}...{deleteTarget.address.slice(-6)}</span>
              </p>
              <p className="text-[11px] text-danger/80 leading-relaxed">
                Зашифрованная сид-фраза будет удалена с этого устройства.
                Убедитесь, что у вас есть резервная копия мнемоники.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setDeleteTarget(null); setStep('choose') }}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-text-secondary border border-border rounded-xl hover:border-border-hover transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-danger rounded-xl hover:bg-danger/90 transition-colors"
              >
                Удалить
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
