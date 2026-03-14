import type { Metadata, Viewport } from 'next'
import { ToastProvider } from '@/components/ui/toast'
import { WalletProvider } from '@/contexts/wallet-context'
import { ConnectWalletModal } from '@/components/ui/connect-wallet-modal'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import './globals.css'

export const metadata: Metadata = {
  title: 'Checkers — Play & Earn',
  description: 'Играй в шашки на ставку в блокчейне Axiome',
  manifest: '/manifest.json',
  icons: {
    icon: '/checkers-logo.png',
    apple: '/checkers-logo.png',
  },
  openGraph: {
    title: 'Checkers — Play & Earn',
    description: 'Играй в шашки на ставку в блокчейне Axiome',
    type: 'website',
    images: ['/checkers-logo-with-text2.png'],
  },
}

export const viewport: Viewport = {
  themeColor: '#2081e2',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
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
