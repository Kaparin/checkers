import type { Context, Next } from 'hono'

/**
 * Admin guard — validates ADMIN_SECRET header.
 * Returns 403 if the secret doesn't match.
 */
export async function requireAdmin(c: Context, next: Next) {
  const secret = c.req.header('x-admin-secret') || c.req.query('secret')
  const expected = process.env.ADMIN_SECRET

  if (!expected || secret !== expected) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  await next()
}
