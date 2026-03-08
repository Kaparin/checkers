import type { Metadata } from 'next'
import { ToastProvider } from '@/components/ui/toast'
import { WalletProvider } from '@/contexts/wallet-context'
import { Header } from '@/components/layout/header'
import { ConnectWalletModal } from '@/components/ui/connect-wallet-modal'
import './globals.css'

export const metadata: Metadata = {
  title: 'Checkers — Play & Earn',
  description: 'Play checkers with real wagers on Axiome blockchain',
  manifest: '/manifest.json',
  themeColor: '#7c3aed',
  openGraph: {
    title: 'Checkers — Play & Earn',
    description: 'Play checkers with real wagers on Axiome blockchain',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg antialiased">
        <ToastProvider>
          <WalletProvider>
            <Header />
            <main className="max-w-6xl mx-auto px-4 py-8">
              {children}
            </main>
            <ConnectWalletModal />
          </WalletProvider>
        </ToastProvider>
      </body>
    </html>
  )
}
