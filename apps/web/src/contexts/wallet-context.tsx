'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { useWebWallet, type UseWebWalletReturn } from '@/hooks/use-web-wallet'

interface WalletContextType extends UseWebWalletReturn {
  showConnectModal: boolean
  openConnectModal: () => void
  closeConnectModal: () => void
}

const WalletContext = createContext<WalletContextType | null>(null)

export function WalletProvider({ children }: { children: ReactNode }) {
  const wallet = useWebWallet()
  const [showConnectModal, setShowConnectModal] = useState(false)

  const openConnectModal = useCallback(() => setShowConnectModal(true), [])
  const closeConnectModal = useCallback(() => setShowConnectModal(false), [])

  return (
    <WalletContext.Provider value={{ ...wallet, showConnectModal, openConnectModal, closeConnectModal }}>
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  const ctx = useContext(WalletContext)
  if (!ctx) throw new Error('useWallet must be used within WalletProvider')
  return ctx
}
