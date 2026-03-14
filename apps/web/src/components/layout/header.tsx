'use client'

import { useState, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useWallet } from '@/contexts/wallet-context'
import { getBalance } from '@/lib/chain-actions'
import Image from 'next/image'
import {
  Trophy,
  Clock,
  Gift,
  ShoppingBag,
  Users,
  Wallet,
  ChevronDown,
  Menu,
  X,
  LogOut,
  User,
  ArrowLeftRight,
  Gamepad2,
} from 'lucide-react'

const NAV_LINKS = [
  { href: '/', label: 'Играть', icon: Gamepad2 },
  { href: '/leaderboard', label: 'Рейтинг', icon: Trophy },
  { href: '/history', label: 'История', icon: Clock },
  { href: '/jackpot', label: 'Джекпот', icon: Gift },
  { href: '/shop', label: 'Магазин', icon: ShoppingBag },
  { href: '/referrals', label: 'Рефералы', icon: Users },
]

export function Header() {
  const pathname = usePathname()
  const { address, isConnected, openConnectModal, disconnect, savedWallets } = useWallet()
  const hasMultipleWallets = savedWallets.length > 1
  const [menuOpen, setMenuOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [balance, setBalance] = useState<string | null>(null)
  const profileRef = useRef<HTMLDivElement>(null)

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
    const interval = setInterval(load, 30_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [address])

  // Close profile dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Close mobile menu on route change
  useEffect(() => { setMenuOpen(false) }, [pathname])

  const formatBalance = (uaxm: string) => {
    const n = Number(uaxm) / 1_000_000
    return n < 0.01 ? '0' : n.toFixed(2)
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-bg/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-[72px]">
            {/* Logo */}
            <a href="/" className="flex items-center gap-2 shrink-0">
              <Image
                src="/checkers-logo-with-text2.png"
                alt="Checkers"
                width={160}
                height={48}
                className="h-10 w-auto sm:h-12"
                priority
              />
            </a>

            {/* Desktop nav */}
            <nav className="hidden lg:flex items-center gap-1">
              {NAV_LINKS.map(link => {
                const isActive = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href)
                const Icon = link.icon
                return (
                  <a
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-colors ${
                      isActive
                        ? 'text-text bg-bg-subtle'
                        : 'text-text-secondary hover:text-text hover:bg-bg-subtle'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {link.label}
                  </a>
                )
              })}
            </nav>

            {/* Right section */}
            <div className="flex items-center gap-2">
              {isConnected ? (
                <>
                  {/* Balance pill */}
                  {balance !== null && (
                    <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-bg-subtle rounded-xl text-sm font-medium">
                      <div className="w-2 h-2 rounded-full bg-success" />
                      <span className="text-text tabular-nums">{formatBalance(balance)}</span>
                      <span className="text-text-muted">AXM</span>
                    </div>
                  )}

                  {/* Profile dropdown */}
                  <div className="relative" ref={profileRef}>
                    <button
                      onClick={() => setProfileOpen(!profileOpen)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-bg-subtle hover:bg-bg-elevated rounded-xl transition-colors"
                    >
                      <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center">
                        <User className="w-3.5 h-3.5 text-accent" />
                      </div>
                      <span className="text-sm font-mono text-text-secondary hidden sm:block">
                        {address!.slice(0, 6)}...{address!.slice(-4)}
                      </span>
                      <ChevronDown className={`w-3.5 h-3.5 text-text-muted transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {profileOpen && (
                      <div className="absolute right-0 mt-2 w-64 bg-bg-card border border-border rounded-2xl shadow-card-hover overflow-hidden animate-scale-in">
                        {/* Balance on mobile */}
                        {balance !== null && (
                          <div className="sm:hidden px-4 py-3 border-b border-border">
                            <p className="text-xs text-text-muted mb-1">Баланс</p>
                            <p className="text-sm font-medium tabular-nums">{formatBalance(balance)} AXM</p>
                          </div>
                        )}
                        <div className="p-1.5">
                          <a
                            href="/profile"
                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-text-secondary hover:text-text hover:bg-bg-subtle transition-colors"
                            onClick={() => setProfileOpen(false)}
                          >
                            <User className="w-4 h-4" />
                            Профиль
                          </a>
                          {hasMultipleWallets && (
                            <button
                              onClick={() => { openConnectModal(); setProfileOpen(false) }}
                              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-text-secondary hover:text-text hover:bg-bg-subtle transition-colors"
                            >
                              <ArrowLeftRight className="w-4 h-4" />
                              Сменить кошелёк
                            </button>
                          )}
                        </div>
                        <div className="border-t border-border p-1.5">
                          <button
                            onClick={() => { disconnect(); setProfileOpen(false) }}
                            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-danger hover:bg-danger/5 transition-colors"
                          >
                            <LogOut className="w-4 h-4" />
                            Отключить
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <button
                  onClick={openConnectModal}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-accent hover:bg-accent-hover rounded-xl shadow-sm transition-colors"
                >
                  <Wallet className="w-4 h-4" />
                  <span className="hidden sm:inline">Подключить</span>
                  <span className="sm:hidden">Войти</span>
                </button>
              )}

              {/* Mobile hamburger */}
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="lg:hidden p-2 text-text-secondary hover:text-text hover:bg-bg-subtle rounded-xl transition-colors"
              >
                {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile menu overlay */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setMenuOpen(false)} />
          <div className="fixed top-[73px] left-0 right-0 z-30 bg-bg-card border-b border-border lg:hidden animate-slide-down">
            <nav className="max-w-7xl mx-auto px-4 py-3 space-y-0.5">
              {NAV_LINKS.map(link => {
                const isActive = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href)
                const Icon = link.icon
                return (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                      isActive
                        ? 'text-text bg-bg-subtle'
                        : 'text-text-secondary hover:text-text hover:bg-bg-subtle'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {link.label}
                  </a>
                )
              })}
            </nav>
          </div>
        </>
      )}
    </>
  )
}
