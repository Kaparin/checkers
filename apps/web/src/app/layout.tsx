import type { Metadata, Viewport } from 'next'
import { ToastProvider } from '@/components/ui/toast'
import { WalletProvider } from '@/contexts/wallet-context'
import { ConnectWalletModal } from '@/components/ui/connect-wallet-modal'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import './globals.css'

export const metadata: Metadata = {
  title: 'Шашки — Играй и Зарабатывай',
  description: 'Играй в шашки на ставку в блокчейне Axiome',
  manifest: '/manifest.json',
  openGraph: {
    title: 'Шашки — Играй и Зарабатывай',
    description: 'Играй в шашки на ставку в блокчейне Axiome',
    type: 'website',
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
