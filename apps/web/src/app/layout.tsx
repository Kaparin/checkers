import type { Metadata } from 'next'
import { ToastProvider } from '@/components/ui/toast'
import './globals.css'

export const metadata: Metadata = {
  title: 'Checkers — Play & Earn',
  description: 'Play checkers with real wagers on Axiome blockchain',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg antialiased">
        <ToastProvider>
          <header className="border-b border-border bg-bg-card sticky top-0 z-40">
            <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
              <a href="/" className="flex items-center gap-2.5">
                <div className="w-7 h-7 bg-piece-black rounded-full shadow-sm" />
                <span className="text-lg font-semibold tracking-tight text-text">Checkers</span>
              </a>
              <nav className="flex items-center gap-5 text-sm font-medium text-text-secondary">
                <a href="/" className="hover:text-text transition-colors">Play</a>
                <a href="/leaderboard" className="hover:text-text transition-colors">Leaderboard</a>
                <a href="/history" className="hover:text-text transition-colors">History</a>
              </nav>
            </div>
          </header>
          <main className="max-w-6xl mx-auto px-4 py-8">
            {children}
          </main>
        </ToastProvider>
      </body>
    </html>
  )
}
