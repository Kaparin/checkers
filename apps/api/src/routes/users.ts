import { Hono } from 'hono'
import { users } from '@checkers/db'
import type { Db } from '@checkers/db'
import { eq, desc, gte } from 'drizzle-orm'

export const userRoutes = new Hono()

// Get user profile
userRoutes.get('/:address', async (c) => {
  const db = c.get('db' as never) as Db
  const address = c.req.param('address')

  const [user] = await db.select().from(users).where(eq(users.address, address)).limit(1)
  if (!user) return c.json({ error: 'User not found' }, 404)

  return c.json({ user })
})

// Leaderboard
userRoutes.get('/', async (c) => {
  const db = c.get('db' as never) as Db

  const rows = await db
    .select()
    .from(users)
    .where(gte(users.gamesPlayed, 1))
    .orderBy(desc(users.elo))
    .limit(50)

  return c.json({ users: rows })
})
