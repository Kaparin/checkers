'use client'

import { useState, useEffect } from 'react'
import { useWallet } from '@/contexts/wallet-context'
import { getBalance } from '@/lib/chain-actions'

const NAV_LINKS = [
  { href: '/', label: 'Играть' },
  { href: '/leaderboard', label: 'Рейтинг' },
  { href: '/history', label: 'История' },
  { href: '/jackpot', label: 'Джекпот' },
  { href: '/shop', label: 'Магазин' },
  { href: '/referrals', label: 'Рефералы' },
]

export function Header() {
  const { address, isConnected, openConnectModal, disconnect, savedWallets } = useWallet()
  const hasMultipleWallets = savedWallets.length > 1
  const [menuOpen, setMenuOpen] = useState(false)
  const [balance, setBalance] = useState<string | null>(null)

  // Fetch balance when connected
  useEffect(() => {
    if (!address) { setBalance(null); return }
    let cancelled = false
    const load = async () => {
      try {
        const bal = await getBalance(address)
        if (!cancelled) setBalance(bal)
      } catch {
        if (!cancelled) setBalance(null)
      }
    }
    load()
    const interval = setInterval(load, 30_000) // refresh every 30s
    return () => { cancelled = true; clearInterval(interval) }
  }, [address])

  const formatBalance = (uaxm: string) => {
    const n = Number(uaxm) / 1_000_000
    return n < 0.01 ? '0' : n.toFixed(2)
  }

  return (
    <header className="border-b border-border bg-bg-card/80 backdrop-blur-sm sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-accent to-purple-800 shadow-sm" />
          <span className="text-lg font-bold tracking-tight text-text">Checkers</span>
        </a>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-4">
          <nav className="flex items-center gap-4 text-sm font-medium text-text-secondary">
            {NAV_LINKS.map(link => (
              <a key={link.href} href={link.href} className="hover:text-text transition-colors">
                {link.label}
              </a>
            ))}
          </nav>

          {isConnected ? (
            <div className="flex items-center gap-2 ml-2">
              {/* Balance */}
              {balance !== null && (
                <div className="text-xs font-mono text-gold bg-gold/10 px-2 py-1 rounded-lg">
                  {formatBalance(balance)} AXM
                </div>
              )}
              <a
                href="/profile"
                className="text-xs font-mono text-text-secondary px-2 py-1 bg-bg-subtle rounded-lg hover:bg-bg-elevated transition-colors"
              >
                {address!.slice(0, 8)}...{address!.slice(-4)}
              </a>
              {hasMultipleWallets && (
                <button
                  onClick={openConnectModal}
                  className="text-xs text-accent hover:text-accent-hover transition-colors"
                  title="Переключить кошелёк"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                </button>
              )}
              <button
                onClick={disconnect}
                className="text-xs text-text-muted hover:text-danger transition-colors"
                title="Отключить"
              >
                &times;
              </button>
            </div>
          ) : (
            <button
              onClick={openConnectModal}
              className="px-3.5 py-1.5 text-sm font-medium text-white bg-accent rounded-lg hover:bg-accent-hover transition-colors ml-2"
            >
              Войти
            </button>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden p-2 text-text-secondary hover:text-text transition-colors"
        >
          {menuOpen ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-border bg-bg-card px-4 py-3 space-y-1">
          {NAV_LINKS.map(link => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="block px-3 py-2 text-sm font-medium text-text-secondary hover:text-text hover:bg-bg-subtle rounded-lg transition-colors"
            >
              {link.label}
            </a>
          ))}
          <div className="border-t border-border pt-2 mt-2">
            {isConnected ? (
              <div className="space-y-2">
                {/* Balance on mobile */}
                {balance !== null && (
                  <div className="px-3 py-1.5 text-xs font-mono text-gold">
                    Баланс: {formatBalance(balance)} AXM
                  </div>
                )}
                <div className="flex items-center justify-between px-3 py-2">
                  <a href="/profile" onClick={() => setMenuOpen(false)} className="text-xs font-mono text-text-secondary">
                    {address!.slice(0, 10)}...{address!.slice(-4)}
                  </a>
                  <div className="flex items-center gap-3">
                    {hasMultipleWallets && (
                      <button
                        onClick={() => { openConnectModal(); setMenuOpen(false) }}
                        className="text-xs text-accent"
                      >
                        Сменить
                      </button>
                    )}
                    <button onClick={disconnect} className="text-xs text-danger">
                      Выйти
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => { openConnectModal(); setMenuOpen(false) }}
                className="w-full px-3 py-2 text-sm font-medium text-white bg-accent rounded-lg"
              >
                Подключить кошелёк
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
