import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Checkers — Play & Earn',
  description: 'Play checkers with real wagers on Axiome blockchain',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg antialiased">
        <header className="border-b border-border bg-bg-card">
          <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-piece-black rounded-full shadow-sm" />
              <span className="text-xl font-semibold tracking-tight text-text">Checkers</span>
            </div>
            <nav className="flex items-center gap-6 text-sm font-medium text-text-secondary">
              <a href="/" className="hover:text-text transition-colors">Play</a>
              <a href="/leaderboard" className="hover:text-text transition-colors">Leaderboard</a>
            </nav>
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  )
}
