import type { Metadata, Viewport } from 'next'
import { ToastProvider } from '@/components/ui/toast'
import { WalletProvider } from '@/contexts/wallet-context'
import { ConnectWalletModal } from '@/components/ui/connect-wallet-modal'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import './globals.css'

export const metadata: Metadata = {
  title: 'Checkers — Play & Earn',
  description: 'Play checkers with real wagers on Axiome blockchain',
  manifest: '/manifest.json',
  openGraph: {
    title: 'Checkers — Play & Earn',
    description: 'Play checkers with real wagers on Axiome blockchain',
    type: 'website',
  },
}

export const viewport: Viewport = {
  themeColor: '#7c3aed',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg antialiased">
        <ErrorBoundary>
          <ToastProvider>
            <WalletProvider>
              {children}
              <ConnectWalletModal />
            </WalletProvider>
          </ToastProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}
