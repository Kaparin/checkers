'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { getAdminSecret, setAdminSecret } from '@/lib/admin-api'
import Image from 'next/image'
import {
  LayoutDashboard,
  Users,
  Gamepad2,
  Settings,
  Activity,
  ArrowLeftRight,
  Gift,
  Gem,
  ScrollText,
  Megaphone,
  Lock,
  LogOut,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/games', label: 'Games', icon: Gamepad2 },
  { href: '/admin/config', label: 'Config', icon: Settings },
  { href: '/admin/diagnostics', label: 'Diagnostics', icon: Activity },
  { href: '/admin/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { href: '/admin/referrals', label: 'Referrals', icon: Gift },
  { href: '/admin/jackpot', label: 'Jackpot', icon: Gem },
  { href: '/admin/events', label: 'Events', icon: ScrollText },
  { href: '/admin/announcements', label: 'Announcements', icon: Megaphone },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [authed, setAuthed] = useState(false)
  const [secret, setSecret] = useState('')

  useEffect(() => {
    const stored = getAdminSecret()
    if (stored) setAuthed(true)
  }, [])

  if (!authed) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="bg-bg-card border border-border rounded-2xl p-8 space-y-6">
            <div className="text-center">
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
                <Lock className="w-6 h-6 text-accent" />
              </div>
              <h1 className="text-xl font-bold">Admin Panel</h1>
              <p className="text-sm text-text-muted mt-1">Enter admin secret to continue</p>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                setAdminSecret(secret)
                setAuthed(true)
              }}
              className="space-y-3"
            >
              <input
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="Admin secret"
                className="w-full px-4 py-3 bg-bg-subtle border border-border rounded-xl text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
                autoFocus
              />
              <button
                type="submit"
                className="w-full px-4 py-3 bg-accent text-white rounded-xl text-sm font-semibold hover:bg-accent-hover transition-colors"
              >
                Login
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg flex">
      {/* Sidebar */}
      <aside className="w-60 bg-bg-card border-r border-border shrink-0 hidden md:flex md:flex-col">
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <Image
              src="/checkers-logo-with-text2.png"
              alt="Checkers"
              width={120}
              height={36}
              className="h-8 w-auto"
            />
          </div>
        </div>
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href
            const Icon = item.icon
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={`w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-xl text-sm transition-colors ${
                  active
                    ? 'bg-accent/10 text-accent font-medium'
                    : 'text-text-secondary hover:bg-bg-subtle hover:text-text'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {item.label}
              </button>
            )
          })}
        </nav>
        <div className="p-4 border-t border-border">
          <button
            onClick={() => {
              setAdminSecret('')
              setAuthed(false)
            }}
            className="flex items-center gap-2 text-xs text-text-muted hover:text-danger transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Logout
          </button>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-bg-card/95 backdrop-blur-lg border-t border-border z-30 flex overflow-x-auto">
        {NAV_ITEMS.slice(0, 6).map((item) => {
          const active = pathname === item.href
          const Icon = item.icon
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={`flex-1 min-w-0 flex flex-col items-center gap-0.5 px-1 py-2.5 text-[10px] font-medium transition-colors ${
                active ? 'text-accent' : 'text-text-muted'
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <main className="flex-1 p-4 md:p-8 overflow-auto pb-20 md:pb-8">
        {children}
      </main>
    </div>
  )
}
