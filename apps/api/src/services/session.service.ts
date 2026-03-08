/**
 * Session Service — HMAC-based stateless session tokens.
 *
 * Flow:
 *   1. GET /auth/challenge?address=axm1... → random nonce (5min TTL)
 *   2. Frontend signs nonce with wallet private key
 *   3. POST /auth/verify { address, signature, pubkey }
 *   4. Backend verifies Secp256k1 signature, derives address from pubkey
 *   5. Returns stateless HMAC session token (cookie + Bearer)
 */

import { createHmac, randomBytes, timingSafeEqual } from 'crypto'
import { Secp256k1, Secp256k1Signature, Sha256, ripemd160 } from '@cosmjs/crypto'
import { toBech32, fromHex } from '@cosmjs/encoding'
import { AXIOME_PREFIX } from '@checkers/shared/chain'

const SESSION_SECRET = process.env.SESSION_SECRET || 'checkers-dev-secret-change-in-prod'
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const CHALLENGE_TTL_MS = 5 * 60 * 1000 // 5 minutes

// In-memory challenge store
const challenges = new Map<string, { nonce: string; expiresAt: number }>()

// Cleanup expired challenges every 60s
setInterval(() => {
  const now = Date.now()
  for (const [key, val] of challenges) {
    if (val.expiresAt < now) challenges.delete(key)
  }
}, 60_000)

export function generateChallenge(address: string): string {
  const nonce = randomBytes(32).toString('hex')
  challenges.set(address.toLowerCase(), {
    nonce,
    expiresAt: Date.now() + CHALLENGE_TTL_MS,
  })
  return nonce
}

export function consumeChallenge(address: string): string | null {
  const key = address.toLowerCase()
  const entry = challenges.get(key)
  if (!entry || entry.expiresAt < Date.now()) {
    challenges.delete(key)
    return null
  }
  challenges.delete(key)
  return entry.nonce
}

/**
 * Verify Secp256k1 signature against a Bech32 address.
 * 1. Derive address from pubkey: bech32(ripemd160(sha256(pubkey)))
 * 2. Compare derived address to claimed address
 * 3. Verify signature over SHA256(challenge_nonce)
 */
export async function verifySignature(
  address: string,
  challenge: string,
  signatureHex: string,
  pubkeyHex: string,
): Promise<boolean> {
  try {
    const pubkeyBytes = fromHex(pubkeyHex)
    const signatureBytes = fromHex(signatureHex)

    // Derive address from pubkey
    const sha256Hash = new Sha256(pubkeyBytes).digest()
    const addressBytes = ripemd160(sha256Hash)
    const derivedAddress = toBech32(AXIOME_PREFIX, addressBytes)

    if (derivedAddress.toLowerCase() !== address.toLowerCase()) {
      console.warn(`[auth] pubkey does not match address: derived=${derivedAddress}, claimed=${address}`)
      return false
    }

    // Verify signature over SHA256(challenge)
    const messageHash = new Sha256(Buffer.from(challenge, 'utf-8')).digest()
    const sig = Secp256k1Signature.fromFixedLength(signatureBytes)
    return await Secp256k1.verifySignature(sig, messageHash, pubkeyBytes)
  } catch (err) {
    console.error('[auth] signature verification failed:', err)
    return false
  }
}

/** Create stateless HMAC session token */
export function createSessionToken(address: string): { token: string; expiresAt: Date } {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS)
  const payload = `${address}:${expiresAt.getTime()}`
  const mac = createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url')
  const token = Buffer.from(`${payload}:${mac}`).toString('base64url')
  return { token, expiresAt }
}

/** Verify and decode session token */
export function verifySessionToken(token: string): { address: string; expiresAt: Date } | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8')
    const parts = decoded.split(':')
    if (parts.length !== 3) return null

    const [address, expiresStr, providedMac] = parts
    if (!address || !expiresStr || !providedMac) return null

    const expiresMs = parseInt(expiresStr, 10)
    if (isNaN(expiresMs) || expiresMs < Date.now()) return null

    const payload = `${address}:${expiresStr}`
    const expectedMac = createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url')

    const a = Buffer.from(expectedMac)
    const b = Buffer.from(providedMac)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null

    return { address, expiresAt: new Date(expiresMs) }
  } catch {
    return null
  }
}

export const SESSION_COOKIE = 'checkers_session'

export function getSessionCookieOptions(expiresAt: Date) {
  const isProd = process.env.NODE_ENV === 'production'
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' as const : 'lax' as const,
    maxAge: SESSION_DURATION_MS / 1000,
    path: '/',
  }
}
