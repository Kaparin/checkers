'use client'

import { useWallet } from '@/contexts/wallet-context'

export function Header() {
  const { address, isConnected, openConnectModal, disconnect } = useWallet()

  return (
    <header className="border-b border-border bg-bg-card sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-piece-black rounded-full shadow-sm" />
          <span className="text-lg font-semibold tracking-tight text-text">Checkers</span>
        </a>

        <div className="flex items-center gap-5">
          <nav className="flex items-center gap-5 text-sm font-medium text-text-secondary">
            <a href="/" className="hover:text-text transition-colors">Play</a>
            <a href="/leaderboard" className="hover:text-text transition-colors">Leaderboard</a>
            <a href="/history" className="hover:text-text transition-colors">History</a>
            <a href="/jackpot" className="hover:text-text transition-colors">Jackpot</a>
            <a href="/referrals" className="hover:text-text transition-colors">Referrals</a>
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
      </div>
    </header>
  )
}
