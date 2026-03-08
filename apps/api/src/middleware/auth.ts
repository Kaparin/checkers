import type { Context, Next } from 'hono'
import { getCookie } from 'hono/cookie'
import { verifySessionToken, SESSION_COOKIE } from '../services/session.service'

/**
 * Auth middleware — resolves session from cookie or Bearer token.
 * Sets c.address if authenticated. Does NOT block unauthenticated requests
 * (routes should check c.get('address') themselves if they require auth).
 */
export async function authMiddleware(c: Context, next: Next) {
  let token: string | undefined

  // 1. Try httpOnly cookie
  token = getCookie(c, SESSION_COOKIE)

  // 2. Fallback: Bearer token (iOS Safari / WS handshake)
  if (!token) {
    const authHeader = c.req.header('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7)
    }
  }

  // 3. Verify token
  if (token) {
    const session = verifySessionToken(token)
    if (session) {
      c.set('address' as never, session.address)
    }
  }

  await next()
}

/**
 * Strict auth guard — returns 401 if not authenticated.
 * Use after authMiddleware on routes that require auth.
 */
export async function requireAuth(c: Context, next: Next) {
  const address = c.get('address' as never) as string | undefined
  if (!address) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  await next()
}
