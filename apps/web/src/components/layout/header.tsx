'use client'

import { useState } from 'react'
import { useWallet } from '@/contexts/wallet-context'

const NAV_LINKS = [
  { href: '/', label: 'Play' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/history', label: 'History' },
  { href: '/jackpot', label: 'Jackpot' },
  { href: '/shop', label: 'Shop' },
  { href: '/referrals', label: 'Referrals' },
]

export function Header() {
  const { address, isConnected, openConnectModal, disconnect } = useWallet()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="border-b border-border bg-bg-card sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-piece-black rounded-full shadow-sm" />
          <span className="text-lg font-semibold tracking-tight text-text">Checkers</span>
        </a>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-5">
          <nav className="flex items-center gap-5 text-sm font-medium text-text-secondary">
            {NAV_LINKS.map(link => (
              <a key={link.href} href={link.href} className="hover:text-text transition-colors">
                {link.label}
              </a>
            ))}
          </nav>

          {isConnected ? (
            <div className="flex items-center gap-2">
              <a
                href="/profile"
                className="text-xs font-mono text-text-secondary px-2 py-1 bg-bg-subtle rounded-lg hover:bg-bg-subtle/70 transition-colors"
              >
                {address!.slice(0, 8)}...{address!.slice(-4)}
              </a>
              <button
                onClick={disconnect}
                className="text-xs text-text-muted hover:text-danger transition-colors"
                title="Disconnect"
              >
                &times;
              </button>
            </div>
          ) : (
            <button
              onClick={openConnectModal}
              className="px-3.5 py-1.5 text-sm font-medium text-white bg-accent rounded-lg hover:bg-accent-hover transition-colors"
            >
              Connect
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
              <div className="flex items-center justify-between px-3 py-2">
                <a href="/profile" onClick={() => setMenuOpen(false)} className="text-xs font-mono text-text-secondary">
                  {address!.slice(0, 10)}...{address!.slice(-4)}
                </a>
                <button onClick={disconnect} className="text-xs text-danger">
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={() => { openConnectModal(); setMenuOpen(false) }}
                className="w-full px-3 py-2 text-sm font-medium text-white bg-accent rounded-lg"
              >
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
