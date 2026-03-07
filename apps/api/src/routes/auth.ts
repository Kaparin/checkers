import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { LoginSchema } from '@checkers/shared'
import { users, sessions } from '@checkers/db'
import type { Db } from '@checkers/db'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'

export const authRoutes = new Hono()

authRoutes.post('/login', zValidator('json', LoginSchema), async (c) => {
  const { address } = c.req.valid('json')
  const db = c.get('db' as never) as Db

  // Upsert user
  const [existing] = await db.select().from(users).where(eq(users.address, address)).limit(1)
  if (!existing) {
    await db.insert(users).values({ address })
  }

  // Create session (7 days)
  const token = randomUUID()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  const [session] = await db.insert(sessions).values({
    address,
    token,
    expiresAt,
  }).returning()

  return c.json({
    token: session.token,
    address,
    expiresAt: expiresAt.toISOString(),
  })
})

authRoutes.get('/me', async (c) => {
  const authHeader = c.req.header('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const token = authHeader.slice(7)
  const db = c.get('db' as never) as Db

  const [session] = await db.select().from(sessions).where(eq(sessions.token, token)).limit(1)
  if (!session) {
    return c.json({ error: 'Invalid session' }, 401)
  }

  const [user] = await db.select().from(users).where(eq(users.address, session.address)).limit(1)
  if (!user) {
    return c.json({ error: 'User not found' }, 404)
  }

  return c.json({ user })
})
