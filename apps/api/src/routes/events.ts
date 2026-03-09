import { Hono } from 'hono'
import type { Db } from '@checkers/db'
import { requireAuth } from '../middleware/auth'
import { EventsService } from '../services/events.service'

export const eventRoutes = new Hono()

// List events (public)
eventRoutes.get('/', async (c) => {
  const db = c.get('db' as never) as Db
  const service = new EventsService(db)
  const eventsList = await service.getEvents()
  return c.json({ events: eventsList })
})

// Get single event
eventRoutes.get('/:id', async (c) => {
  const db = c.get('db' as never) as Db
  const id = c.req.param('id') as string
  const service = new EventsService(db)
  const result = await service.getEvent(id)
  if (!result) return c.json({ error: 'Event not found' }, 404)
  return c.json(result)
})

// Join event
eventRoutes.post('/:id/join', requireAuth, async (c) => {
  const db = c.get('db' as never) as Db
  const address = c.get('address' as never) as string
  const id = c.req.param('id') as string
  const service = new EventsService(db)
  const joined = await service.join(id, address)
  if (!joined) return c.json({ error: 'Cannot join event' }, 400)
  return c.json({ success: true })
})

// Get announcements (public)
eventRoutes.get('/announcements/active', async (c) => {
  const db = c.get('db' as never) as Db
  const service = new EventsService(db)
  const list = await service.getAnnouncements()
  return c.json({ announcements: list })
})
