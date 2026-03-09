import { Hono } from 'hono'
import type { Db } from '@checkers/db'
import { requireAuth } from '../middleware/auth'
import { ShopService } from '../services/shop.service'

export const shopRoutes = new Hono()

// Get shop items (public)
shopRoutes.get('/items', async (c) => {
  const db = c.get('db' as never) as Db
  const service = new ShopService(db)
  return c.json({ items: service.getItems() })
})

// Purchase item
shopRoutes.post('/purchase', requireAuth, async (c) => {
  const db = c.get('db' as never) as Db
  const address = c.get('address' as never) as string
  const body = await c.req.json<{ itemType: string }>()

  if (!body.itemType) return c.json({ error: 'itemType required' }, 400)

  const service = new ShopService(db)
  const result = await service.purchase(address, body.itemType)

  if ('error' in result) return c.json(result, 400)
  return c.json(result)
})

// Get my purchase history
shopRoutes.get('/history', requireAuth, async (c) => {
  const db = c.get('db' as never) as Db
  const address = c.get('address' as never) as string
  const service = new ShopService(db)
  const history = await service.getHistory(address)
  return c.json({ history })
})
