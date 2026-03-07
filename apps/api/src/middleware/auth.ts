import type { Context, Next } from 'hono'
import { eq, and, gt } from 'drizzle-orm'
import { sessions } from '@checkers/db'
import type { Db } from '@checkers/db'

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const token = authHeader.slice(7)
  const db = c.get('db' as never) as Db

  const [session] = await db
    .select()
    .from(sessions)
    .where(and(
      eq(sessions.token, token),
      gt(sessions.expiresAt, new Date()),
    ))
    .limit(1)

  if (!session) {
    return c.json({ error: 'Invalid or expired session' }, 401)
  }

  c.set('address' as never, session.address)
  c.set('sessionId' as never, session.id)
  await next()
}
