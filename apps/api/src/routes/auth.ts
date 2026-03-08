import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { setCookie } from 'hono/cookie'
import { users } from '@checkers/db'
import type { Db } from '@checkers/db'
import { eq } from 'drizzle-orm'
import {
  generateChallenge,
  consumeChallenge,
  verifySignature,
  createSessionToken,
  SESSION_COOKIE,
  getSessionCookieOptions,
} from '../services/session.service'

export const authRoutes = new Hono()

// ── GET /auth/challenge ─────────────────────────────────────────────
// Returns a random nonce for the wallet to sign

const ChallengeQuery = z.object({
  address: z.string().regex(/^axm[a-z0-9]{39}$/, 'Invalid Axiome address'),
})

authRoutes.get('/challenge', zValidator('query', ChallengeQuery), (c) => {
  const { address } = c.req.valid('query')
  const nonce = generateChallenge(address)
  return c.json({ nonce })
})

// ── POST /auth/verify ───────────────────────────────────────────────
// Verify wallet signature, create session, set cookie + return token

const VerifyBody = z.object({
  address: z.string().regex(/^axm[a-z0-9]{39}$/),
  signature: z.string().min(1),
  pubkey: z.string().min(1),
})

authRoutes.post('/verify', zValidator('json', VerifyBody), async (c) => {
  const { address, signature, pubkey } = c.req.valid('json')
  const db = c.get('db' as never) as Db

  // Consume the challenge nonce
  const challenge = consumeChallenge(address)
  if (!challenge) {
    return c.json({ error: 'No pending challenge or challenge expired' }, 400)
  }

  // Verify signature
  const valid = await verifySignature(address, challenge, signature, pubkey)
  if (!valid) {
    return c.json({ error: 'Invalid signature' }, 401)
  }

  // Upsert user
  const [existing] = await db.select().from(users).where(eq(users.address, address)).limit(1)
  if (!existing) {
    await db.insert(users).values({ address })
  }

  // Create session token
  const { token, expiresAt } = createSessionToken(address)

  // Set httpOnly cookie
  setCookie(c, SESSION_COOKIE, token, getSessionCookieOptions(expiresAt))

  return c.json({
    token,
    address,
    expiresAt: expiresAt.toISOString(),
  })
})

// ── GET /auth/me ────────────────────────────────────────────────────
// Returns current user profile (requires auth)

authRoutes.get('/me', async (c) => {
  const address = c.get('address' as never) as string | undefined
  if (!address) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const db = c.get('db' as never) as Db
  const [user] = await db.select().from(users).where(eq(users.address, address)).limit(1)
  if (!user) {
    return c.json({ error: 'User not found' }, 404)
  }

  return c.json({ user })
})

// ── POST /auth/logout ───────────────────────────────────────────────

authRoutes.post('/logout', (c) => {
  setCookie(c, SESSION_COOKIE, '', {
    httpOnly: true,
    maxAge: 0,
    path: '/',
  })
  return c.json({ success: true })
})
