'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing'
import {
  validateMnemonic,
  deriveWallet,
  encryptMnemonic,
  decryptMnemonic,
  listSavedWallets,
  saveWallet,
  forgetWallet as forgetStoredWallet,
  loadStoredWalletByAddress,
  saveSessionWallet,
  loadSessionWallet,
  clearSessionWallet,
  type SavedWallet,
} from '@/lib/wallet-core'
import { signChallenge } from '@/lib/wallet-signer'
import { getChallenge, verifyAuth, logout } from '@/lib/api'
import {
  setStoredToken,
  setStoredAddress,
  clearStoredToken,
  clearStoredAddress,
  getStoredAddress,
  getStoredToken,
} from '@/lib/auth-headers'
import { AXIOME_PREFIX } from '@checkers/shared/chain'

export interface UseWebWalletReturn {
  address: string | null
  isConnected: boolean
  isConnecting: boolean
  hasSaved: boolean
  savedWallets: SavedWallet[]
  error: string | null
  connectWithMnemonic: (mnemonic: string, pin: string, label?: string) => Promise<void>
  unlockWithPin: (pin: string, address?: string) => Promise<void>
  disconnect: () => void
  forgetWallet: (address?: string) => void
  refreshSavedWallets: () => void
}

export function useWebWallet(): UseWebWalletReturn {
  const [address, setAddress] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedWallets, setSavedWallets] = useState<SavedWallet[]>([])
  const mnemonicRef = useRef<string | null>(null)

  // Load saved wallets list on mount
  useEffect(() => {
    setSavedWallets(listSavedWallets())
  }, [])

  // Try to restore session on mount
  useEffect(() => {
    const storedAddress = getStoredAddress()
    const storedToken = getStoredToken()
    if (storedAddress && storedToken) {
      // Check token expiry client-side (token format: base64url(address:expiresMs:hmac))
      try {
        const decoded = atob(storedToken.replace(/-/g, '+').replace(/_/g, '/'))
        const parts = decoded.split(':')
        if (parts.length >= 2 && parseInt(parts[1], 10) < Date.now()) {
          clearStoredToken()
          clearStoredAddress()
          return
        }
      } catch {
        // If decode fails, clear stale data
        clearStoredToken()
        clearStoredAddress()
        return
      }
      setAddress(storedAddress)
    }
  }, [])

  const refreshSavedWallets = useCallback(() => {
    setSavedWallets(listSavedWallets())
  }, [])

  // Register session with backend (challenge-response)
  const registerSession = useCallback(async (mnemonic: string, walletAddress: string) => {
    // 1. Get challenge nonce from server
    const { nonce } = await getChallenge(walletAddress)

    // 2. Sign the nonce
    const { signature, pubkey } = await signChallenge(mnemonic, nonce)

    // 3. Verify with backend → get token
    const { token } = await verifyAuth(walletAddress, signature, pubkey)

    // 4. Store token for Bearer auth (iOS Safari fallback)
    setStoredToken(token)
    setStoredAddress(walletAddress)
  }, [])

  const connectWithMnemonic = useCallback(async (mnemonic: string, pin: string, label?: string) => {
    setIsConnecting(true)
    setError(null)
    try {
      const validation = validateMnemonic(mnemonic)
      if (!validation.valid) throw new Error(validation.error)

      // Derive wallet
      const { address: walletAddress } = await deriveWallet(mnemonic)
      mnemonicRef.current = mnemonic

      // Encrypt and save
      const encrypted = await encryptMnemonic(mnemonic, pin)
      saveWallet({
        address: walletAddress,
        encryptedMnemonic: encrypted,
        label,
        createdAt: Date.now(),
      })
      refreshSavedWallets()

      // Register backend session
      await registerSession(mnemonic, walletAddress)

      // Save serialized wallet to sessionStorage for refresh survival
      const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic.trim(), {
        prefix: AXIOME_PREFIX,
      })
      saveSessionWallet(await wallet.serialize('session-password'))

      setAddress(walletAddress)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed')
      throw err
    } finally {
      setIsConnecting(false)
    }
  }, [registerSession, refreshSavedWallets])

  const unlockWithPin = useCallback(async (pin: string, targetAddress?: string) => {
    setIsConnecting(true)
    setError(null)
    try {
      const addr = targetAddress || savedWallets[0]?.address
      if (!addr) throw new Error('No saved wallet found')

      const saved = loadStoredWalletByAddress(addr)
      if (!saved) throw new Error('Wallet not found')

      // Decrypt mnemonic
      const mnemonic = await decryptMnemonic(saved.encryptedMnemonic, pin)
      mnemonicRef.current = mnemonic

      // Validate decryption produced a valid mnemonic
      const validation = validateMnemonic(mnemonic)
      if (!validation.valid) throw new Error('Wrong PIN or corrupted wallet')

      // Derive wallet
      const { address: walletAddress } = await deriveWallet(mnemonic)
      if (walletAddress !== addr) throw new Error('Address mismatch — wrong PIN?')

      // Register backend session
      await registerSession(mnemonic, walletAddress)

      // Save to session
      const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic.trim(), {
        prefix: AXIOME_PREFIX,
      })
      saveSessionWallet(await wallet.serialize('session-password'))

      setAddress(walletAddress)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unlock failed'
      setError(msg.includes('Unsupported state') || msg.includes('decrypt') ? 'Wrong PIN' : msg)
      throw err
    } finally {
      setIsConnecting(false)
    }
  }, [savedWallets, registerSession])

  const disconnect = useCallback(() => {
    logout().catch(() => {}) // clear server session
    setAddress(null)
    mnemonicRef.current = null
    clearStoredToken()
    clearStoredAddress()
    clearSessionWallet()
  }, [])

  const forgetWallet = useCallback((targetAddress?: string) => {
    const addr = targetAddress || address
    if (addr) {
      forgetStoredWallet(addr)
      refreshSavedWallets()
      if (addr === address) disconnect()
    }
  }, [address, disconnect, refreshSavedWallets])

  return {
    address,
    isConnected: !!address,
    isConnecting,
    hasSaved: savedWallets.length > 0,
    savedWallets,
    error,
    connectWithMnemonic,
    unlockWithPin,
    disconnect,
    forgetWallet,
    refreshSavedWallets,
  }
}
