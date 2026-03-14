'use client'

import { useState } from 'react'
import { useWallet } from '@/contexts/wallet-context'
import { X, Shield, Trash2, ArrowLeft, Loader2 } from 'lucide-react'

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={resetAndClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-bg-card border border-border rounded-2xl shadow-xl w-full max-w-md animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            {(step === 'import' || step === 'unlock' || step === 'confirm-delete') && (
              <button
                onClick={() => { setStep('choose'); setLocalError(null); setPin('') }}
                className="p-1 text-text-muted hover:text-text rounded-lg hover:bg-bg-subtle transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <h2 className="text-lg font-bold text-text">
              {step === 'choose' && 'Подключить кошелёк'}
              {step === 'import' && 'Импорт кошелька'}
              {step === 'unlock' && 'Разблокировать'}
              {step === 'confirm-delete' && 'Удалить кошелёк'}
            </h2>
          </div>
          <button onClick={resetAndClose} className="p-1.5 text-text-muted hover:text-text hover:bg-bg-subtle rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pb-6">
          {/* Security banner */}
          {(step === 'choose' || step === 'import') && (
            <div className="mb-5 px-4 py-3 bg-success/5 border border-success/15 rounded-xl flex items-start gap-3">
              <Shield className="w-4 h-4 text-success shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-success font-medium">Ваши ключи в безопасности</p>
                <p className="text-[11px] text-text-secondary mt-0.5 leading-relaxed">
                  Сид-фразы шифруются AES-256 и хранятся только локально.
                </p>
              </div>
            </div>
          )}

          {/* Choose step */}
          {step === 'choose' && (
            <div className="space-y-2">
              {hasSaved && (
                <>
                  <p className="text-sm text-text-secondary mb-3">Сохранённые кошельки</p>
                  {savedWallets.map(w => (
                    <div
                      key={w.address}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                        connectedAddress === w.address
                          ? 'border-success/30 bg-success/5'
                          : 'border-border bg-bg-subtle hover:border-border-hover'
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
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
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
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleteTarget({ address: w.address, label: w.label })
                          setStep('confirm-delete')
                        }}
                        className="p-2 text-text-muted hover:text-danger hover:bg-danger/5 rounded-lg transition-colors shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <div className="border-t border-border my-4" />
                </>
              )}
              <button
                onClick={() => setStep('import')}
                className="w-full px-4 py-3 bg-accent text-white font-semibold rounded-xl hover:bg-accent-hover transition-colors text-sm"
              >
                Импортировать кошелёк
              </button>
            </div>
          )}

          {/* Import step */}
          {step === 'import' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2 block">Мнемоническая фраза</label>
                <textarea
                  value={mnemonic}
                  onChange={e => setMnemonic(e.target.value.toLowerCase())}
                  placeholder="Введите 12 или 24 слова..."
                  rows={3}
                  className="w-full px-4 py-3 bg-bg-subtle border border-border rounded-xl text-sm font-mono resize-none focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2 block">PIN-код</label>
                <input
                  type="password"
                  value={pin}
                  onChange={e => setPin(e.target.value)}
                  placeholder="Минимум 4 символа"
                  className="w-full px-4 py-3 bg-bg-subtle border border-border rounded-xl text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2 block">Название (необязательно)</label>
                <input
                  type="text"
                  value={label}
                  onChange={e => setLabel(e.target.value)}
                  placeholder="Например: Основной"
                  className="w-full px-4 py-3 bg-bg-subtle border border-border rounded-xl text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
                />
              </div>

              {displayError && (
                <div className="px-4 py-3 bg-danger/10 border border-danger/20 rounded-xl">
                  <p className="text-xs text-danger">{displayError}</p>
                </div>
              )}

              <button
                onClick={handleImport}
                disabled={isConnecting}
                className="w-full px-4 py-3 text-sm font-semibold text-white bg-accent rounded-xl hover:bg-accent-hover transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isConnecting && <Loader2 className="w-4 h-4 animate-spin" />}
                {isConnecting ? 'Подключение...' : 'Подключить'}
              </button>
            </div>
          )}

          {/* Unlock step */}
          {step === 'unlock' && (
            <div className="space-y-4">
              <div className="px-4 py-3 bg-bg-subtle border border-border rounded-xl">
                <p className="text-xs text-text-muted font-mono truncate">{selectedAddress}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2 block">PIN-код</label>
                <input
                  type="password"
                  value={pin}
                  onChange={e => setPin(e.target.value)}
                  placeholder="PIN-код вашего кошелька"
                  className="w-full px-4 py-3 bg-bg-subtle border border-border rounded-xl text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleUnlock()}
                />
              </div>

              {displayError && (
                <div className="px-4 py-3 bg-danger/10 border border-danger/20 rounded-xl">
                  <p className="text-xs text-danger">{displayError}</p>
                </div>
              )}

              <button
                onClick={handleUnlock}
                disabled={isConnecting}
                className="w-full px-4 py-3 text-sm font-semibold text-white bg-accent rounded-xl hover:bg-accent-hover transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isConnecting && <Loader2 className="w-4 h-4 animate-spin" />}
                {isConnecting ? 'Разблокировка...' : 'Разблокировать'}
              </button>
            </div>
          )}

          {/* Confirm delete */}
          {step === 'confirm-delete' && deleteTarget && (
            <div className="space-y-4">
              <div className="px-4 py-5 bg-danger/5 border border-danger/15 rounded-xl text-center">
                <div className="w-12 h-12 rounded-full bg-danger/10 flex items-center justify-center mx-auto mb-3">
                  <Trash2 className="w-6 h-6 text-danger" />
                </div>
                <p className="text-sm font-semibold text-text mb-1">Удалить кошелёк?</p>
                <p className="text-xs text-text-secondary mb-2">
                  {deleteTarget.label && <><span className="font-medium">{deleteTarget.label}</span> — </>}
                  <span className="font-mono">{deleteTarget.address.slice(0, 12)}...{deleteTarget.address.slice(-6)}</span>
                </p>
                <p className="text-[11px] text-danger/70 leading-relaxed">
                  Зашифрованная сид-фраза будет удалена. Убедитесь в наличии резервной копии.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { setDeleteTarget(null); setStep('choose') }}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold text-text-secondary bg-bg-subtle border border-border rounded-xl hover:bg-bg-elevated transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-danger rounded-xl hover:bg-danger/80 transition-colors"
                >
                  Удалить
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
