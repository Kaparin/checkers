import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { createDb } from '@checkers/db'
import { authRoutes } from './routes/auth'
import { gameRoutes } from './routes/games'
import { userRoutes } from './routes/users'
import { setupWebSocket } from './ws/handler'

const app = new Hono()

// Middleware
app.use('*', logger())
app.use('*', cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}))

// Database
const db = createDb(process.env.DATABASE_URL!)

// Inject db into context
app.use('*', async (c, next) => {
  c.set('db' as never, db)
  await next()
})

// Routes
app.route('/auth', authRoutes)
app.route('/games', gameRoutes)
app.route('/users', userRoutes)

// Health check
app.get('/health', (c) => c.json({ status: 'ok', timestamp: Date.now() }))

// Start server
const port = Number(process.env.PORT) || 3001
const server = serve({ fetch: app.fetch, port })

// WebSocket
setupWebSocket(server, db)

console.log(`[checkers-api] Running on :${port}`)

export default app
