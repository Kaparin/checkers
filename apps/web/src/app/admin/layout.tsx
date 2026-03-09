'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { getAdminSecret, setAdminSecret } from '@/lib/admin-api'

const NAV_ITEMS = [
  { href: '/admin', label: 'Dashboard', icon: '~' },
  { href: '/admin/users', label: 'Users', icon: 'U' },
  { href: '/admin/games', label: 'Games', icon: 'G' },
  { href: '/admin/config', label: 'Config', icon: 'C' },
  { href: '/admin/diagnostics', label: 'Diagnostics', icon: 'D' },
  { href: '/admin/transactions', label: 'Transactions', icon: 'T' },
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
        <div className="w-full max-w-sm space-y-4">
          <h1 className="text-xl font-bold text-center">Admin Panel</h1>
          <p className="text-sm text-text-muted text-center">Enter admin secret to continue</p>
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
              className="w-full px-4 py-2.5 bg-bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              autoFocus
            />
            <button
              type="submit"
              className="w-full px-4 py-2.5 bg-accent text-white rounded-xl text-sm font-medium hover:bg-accent/90 transition-colors"
            >
              Login
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg flex">
      {/* Sidebar */}
      <aside className="w-56 bg-bg-card border-r border-border shrink-0 hidden md:block">
        <div className="p-4 border-b border-border">
          <h1 className="font-bold text-sm">Checkers Admin</h1>
        </div>
        <nav className="p-2 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  active
                    ? 'bg-accent/10 text-accent font-medium'
                    : 'text-text-secondary hover:bg-bg-subtle hover:text-text'
                }`}
              >
                {item.label}
              </button>
            )
          })}
        </nav>
        <div className="absolute bottom-0 p-4 w-56">
          <button
            onClick={() => {
              setAdminSecret('')
              setAuthed(false)
            }}
            className="text-xs text-text-muted hover:text-danger transition-colors"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Mobile nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-bg-card border-t border-border z-30 flex overflow-x-auto">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={`flex-1 min-w-0 px-2 py-3 text-[10px] font-medium text-center transition-colors ${
                active ? 'text-accent' : 'text-text-muted'
              }`}
            >
              {item.label}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <main className="flex-1 p-4 md:p-6 overflow-auto pb-20 md:pb-6">
        {children}
      </main>
    </div>
  )
}
