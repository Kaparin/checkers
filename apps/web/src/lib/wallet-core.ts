/**
 * Wallet Core — client-side mnemonic wallet management.
 *
 * - HD wallet derivation (BIP-44 for Axiome: m/44'/546'/0'/0/0)
 * - AES-256-GCM encryption of mnemonic with user PIN
 * - Multi-wallet persistent storage (localStorage)
 * - Session wallet (sessionStorage for tab-refresh survival)
 */

import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing'
import { Slip10RawIndex } from '@cosmjs/crypto'
import { AXIOME_PREFIX, AXIOME_HD_PATH } from '@checkers/shared/chain'

// ── Mnemonic validation ─────────────────────────────────────────────

const BIP39_WORD_COUNTS = [12, 15, 18, 21, 24]

export function validateMnemonic(mnemonic: string): { valid: boolean; error?: string } {
  const words = mnemonic.trim().split(/\s+/)
  if (!BIP39_WORD_COUNTS.includes(words.length)) {
    return { valid: false, error: `Expected 12 or 24 words, got ${words.length}` }
  }
  if (words.some(w => !/^[a-z]+$/.test(w))) {
    return { valid: false, error: 'Words must be lowercase English letters only' }
  }
  return { valid: true }
}

// ── HD wallet derivation ────────────────────────────────────────────

export async function deriveWallet(mnemonic: string) {
  const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic.trim(), {
    prefix: AXIOME_PREFIX,
    hdPaths: [stringToHdPath(AXIOME_HD_PATH)],
  })
  const [account] = await wallet.getAccounts()
  return { wallet, address: account.address, pubkey: account.pubkey }
}

function stringToHdPath(path: string) {
  const parts = path.replace('m/', '').split('/')
  return parts.map(part => {
    const hardened = part.endsWith("'")
    const num = parseInt(hardened ? part.slice(0, -1) : part, 10)
    return hardened ? Slip10RawIndex.hardened(num) : Slip10RawIndex.normal(num)
  })
}

// ── AES-256-GCM encryption ──────────────────────────────────────────

async function deriveKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptMnemonic(mnemonic: string, pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(pin, salt)
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(mnemonic),
  )
  // Format: base64(salt + iv + ciphertext)
  const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength)
  combined.set(salt, 0)
  combined.set(iv, salt.length)
  combined.set(new Uint8Array(encrypted), salt.length + iv.length)
  return btoa(String.fromCharCode(...combined))
}

export async function decryptMnemonic(encryptedB64: string, pin: string): Promise<string> {
  const combined = Uint8Array.from(atob(encryptedB64), c => c.charCodeAt(0))
  const salt = combined.slice(0, 16)
  const iv = combined.slice(16, 28)
  const ciphertext = combined.slice(28)
  const key = await deriveKey(pin, salt)
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext,
  )
  return new TextDecoder().decode(decrypted)
}

// ── Multi-wallet storage ────────────────────────────────────────────

const WALLETS_KEY = 'checkers_wallets'

export interface SavedWallet {
  address: string
  encryptedMnemonic: string
  label?: string
  createdAt: number
}

export function listSavedWallets(): SavedWallet[] {
  try {
    const raw = localStorage.getItem(WALLETS_KEY)
    if (!raw) return []
    return JSON.parse(raw) as SavedWallet[]
  } catch {
    return []
  }
}

export function saveWallet(wallet: SavedWallet) {
  const wallets = listSavedWallets().filter(w => w.address !== wallet.address)
  wallets.push(wallet)
  localStorage.setItem(WALLETS_KEY, JSON.stringify(wallets))
}

export function forgetWallet(address: string) {
  const wallets = listSavedWallets().filter(w => w.address !== address)
  localStorage.setItem(WALLETS_KEY, JSON.stringify(wallets))
}

export function loadStoredWalletByAddress(address: string): SavedWallet | null {
  return listSavedWallets().find(w => w.address === address) || null
}

// ── Session wallet (survives tab refresh) ───────────────────────────

const SESSION_WALLET_KEY = 'checkers_session_wallet'

export function saveSessionWallet(serialized: string) {
  sessionStorage.setItem(SESSION_WALLET_KEY, serialized)
}

export function loadSessionWallet(): string | null {
  return sessionStorage.getItem(SESSION_WALLET_KEY)
}

export function clearSessionWallet() {
  sessionStorage.removeItem(SESSION_WALLET_KEY)
}
