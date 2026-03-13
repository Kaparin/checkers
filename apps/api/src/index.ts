import { serve } from '@hono/node-server'
import type { Server } from 'node:http'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { createDb } from '@checkers/db'
import { authMiddleware } from './middleware/auth'
import { authRoutes } from './routes/auth'
import { gameRoutes } from './routes/games'
import { userRoutes } from './routes/users'
import { chainRoutes } from './routes/chain'
import { adminRoutes } from './routes/admin'
import { referralRoutes } from './routes/referrals'
import { jackpotRoutes } from './routes/jackpot'
import { chatRoutes } from './routes/chat'
import { vipRoutes } from './routes/vip'
import { shopRoutes } from './routes/shop'
import { eventRoutes } from './routes/events'
import { setupWebSocket } from './ws/handler'
import { startTimeoutChecker } from './services/timeout-checker'
import { relayer } from './services/relayer'
import { indexer } from './services/indexer'
import { ConfigService } from './services/config.service'
import { startStuckRecovery } from './services/stuck-recovery'
import { JackpotService } from './services/jackpot.service'
import { VipService } from './services/vip.service'

const app = new Hono()

// Middleware
app.use('*', logger())
app.use('*', cors({
  origin: (origin) => {
    const allowed = (process.env.CORS_ORIGIN || 'http://localhost:3000')
      .split(',')
      .map(s => s.trim())
    // With credentials: true, wildcard '*' is not allowed per CORS spec
    if (!origin) return allowed[0] || 'http://localhost:3000'
    if (allowed.includes(origin)) return origin
    return null
  },
  credentials: true,
}))

// Database
const db = createDb(process.env.DATABASE_URL!)

// Inject db into context
app.use('*', async (c, next) => {
  c.set('db' as never, db)
  await next()
})

// Auth middleware (resolves session, does not block)
app.use('*', authMiddleware)

// Routes
app.route('/auth', authRoutes)
app.route('/games', gameRoutes)
app.route('/users', userRoutes)
app.route('/chain', chainRoutes)
app.route('/admin', adminRoutes)
app.route('/referrals', referralRoutes)
app.route('/jackpot', jackpotRoutes)
app.route('/chat', chatRoutes)
app.route('/vip', vipRoutes)
app.route('/shop', shopRoutes)
app.route('/events', eventRoutes)

// Health check
app.get('/health', (c) => c.json({ status: 'ok', timestamp: Date.now() }))

// Chain config (public — frontend uses this for authz setup)
app.get('/config', (c) => c.json({
  relayerAddress: relayer.getAddress() || null,
  contractAddress: process.env.CHECKERS_CONTRACT || null,
  chainId: 'axiome-1',
  denom: 'uaxm',
  relayerReady: relayer.isReady,
}))

// Start server
const port = Number(process.env.PORT) || 3001
const server = serve({ fetch: app.fetch, port })

// WebSocket
setupWebSocket(server as unknown as Server, db)

// Timeout checker (every 5s)
startTimeoutChecker(db)

// Stuck game recovery (every 60s)
startStuckRecovery(db)

// Initialize config + blockchain services (non-blocking)
;(async () => {
  try {
    const configService = new ConfigService(db)
    await configService.seedDefaults()
    const jackpotService = new JackpotService(db)
    await jackpotService.seedDefaults()
    const vipService = new VipService(db)
    await vipService.seedDefaults()
    console.log('[checkers-api] Config loaded')
  } catch (err) {
    console.error('[checkers-api] Config init failed:', err)
  }


  try {
    await relayer.init()
    if (relayer.isReady) {
      console.log('[checkers-api] Relayer ready')
    }
  } catch (err) {
    console.error('[checkers-api] Relayer init failed:', err)
  }

  try {
    await indexer.init(db)
    indexer.start(3000)
  } catch (err) {
    console.error('[checkers-api] Indexer init failed:', err)
  }
})()

console.log(`[checkers-api] Running on :${port}`)

export default app
