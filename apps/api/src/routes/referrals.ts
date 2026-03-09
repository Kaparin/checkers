import { Hono } from 'hono'
import type { Db } from '@checkers/db'
import { requireAuth } from '../middleware/auth'
import { ReferralService } from '../services/referral.service'

export const referralRoutes = new Hono()

// Get my referral code (creates if needed)
referralRoutes.get('/code', requireAuth, async (c) => {
  const db = c.get('db' as never) as Db
  const address = c.get('address' as never) as string

  const service = new ReferralService(db)
  const code = await service.getOrCreateCode(address)
  return c.json({ code })
})

// Apply referral code
referralRoutes.post('/apply', requireAuth, async (c) => {
  const db = c.get('db' as never) as Db
  const address = c.get('address' as never) as string
  const body = await c.req.json<{ code: string }>()

  if (!body.code) return c.json({ error: 'code is required' }, 400)

  const service = new ReferralService(db)
  const applied = await service.applyReferral(address, body.code)

  if (!applied) {
    return c.json({ error: 'Invalid code or already referred' }, 400)
  }

  return c.json({ success: true })
})

// Get my referral stats
referralRoutes.get('/stats', requireAuth, async (c) => {
  const db = c.get('db' as never) as Db
  const address = c.get('address' as never) as string

  const service = new ReferralService(db)
  const stats = await service.getStats(address)
  return c.json(stats)
})
