import { Hono } from 'hono'
import type { Db } from '@checkers/db'
import { requireAuth } from '../middleware/auth'
import { VipService } from '../services/vip.service'

export const vipRoutes = new Hono()

// Get VIP tiers (public)
vipRoutes.get('/tiers', async (c) => {
  const db = c.get('db' as never) as Db
  const service = new VipService(db)
  const tiers = await service.getTiers()
  return c.json({ tiers })
})

// Get my VIP info
vipRoutes.get('/me', requireAuth, async (c) => {
  const db = c.get('db' as never) as Db
  const address = c.get('address' as never) as string
  const service = new VipService(db)
  const info = await service.getVipInfo(address)
  return c.json(info)
})

// Update my customization
vipRoutes.put('/customization', requireAuth, async (c) => {
  const db = c.get('db' as never) as Db
  const address = c.get('address' as never) as string
  const body = await c.req.json<{
    nameGradient?: string
    frameStyle?: string
    badgeIcon?: string
    boardTheme?: string
    pieceStyle?: string
  }>()

  const service = new VipService(db)

  // Check if user has active VIP
  const tier = await service.getTier(address)
  if (!tier) return c.json({ error: 'VIP subscription required' }, 403)

  await service.setCustomization(address, body)
  return c.json({ success: true })
})
