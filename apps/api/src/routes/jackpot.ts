import { Hono } from 'hono'
import type { Db } from '@checkers/db'
import { JackpotService } from '../services/jackpot.service'

export const jackpotRoutes = new Hono()

// Get active pools (public)
jackpotRoutes.get('/pools', async (c) => {
  const db = c.get('db' as never) as Db
  const service = new JackpotService(db)
  const pools = await service.getActivePools()
  return c.json({ pools })
})

// Get recent winners (public)
jackpotRoutes.get('/winners', async (c) => {
  const db = c.get('db' as never) as Db
  const service = new JackpotService(db)
  const winners = await service.getRecentWinners()
  return c.json({ winners })
})
