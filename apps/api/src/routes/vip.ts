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

// Allowed values for VIP customization (whitelist)
const ALLOWED_GRADIENTS = ['none', 'gold', 'silver', 'rainbow', 'fire', 'ice', 'emerald']
const ALLOWED_FRAMES = ['none', 'circle', 'diamond', 'hexagon', 'crown']
const ALLOWED_BADGES = ['none', 'star', 'crown', 'shield', 'flame', 'gem']
const ALLOWED_THEMES = ['classic', 'wood', 'marble', 'neon', 'ocean', 'midnight']
const ALLOWED_PIECES = ['classic', 'modern', 'pixel', 'glass', 'metal']

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

  // Validate against whitelists
  if (body.nameGradient && !ALLOWED_GRADIENTS.includes(body.nameGradient)) {
    return c.json({ error: 'Invalid nameGradient value' }, 400)
  }
  if (body.frameStyle && !ALLOWED_FRAMES.includes(body.frameStyle)) {
    return c.json({ error: 'Invalid frameStyle value' }, 400)
  }
  if (body.badgeIcon && !ALLOWED_BADGES.includes(body.badgeIcon)) {
    return c.json({ error: 'Invalid badgeIcon value' }, 400)
  }
  if (body.boardTheme && !ALLOWED_THEMES.includes(body.boardTheme)) {
    return c.json({ error: 'Invalid boardTheme value' }, 400)
  }
  if (body.pieceStyle && !ALLOWED_PIECES.includes(body.pieceStyle)) {
    return c.json({ error: 'Invalid pieceStyle value' }, 400)
  }

  const service = new VipService(db)

  // Check if user has active VIP
  const tier = await service.getTier(address)
  if (!tier) return c.json({ error: 'VIP subscription required' }, 403)

  await service.setCustomization(address, body)
  return c.json({ success: true })
})
