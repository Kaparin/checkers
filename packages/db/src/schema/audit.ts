import { pgTable, text, timestamp, uuid, integer } from 'drizzle-orm/pg-core'
import { users } from './users'

export const txEvents = pgTable('tx_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  address: text('address').references(() => users.address),
  action: text('action', {
    enum: [
      'create_game', 'join_game', 'make_move', 'resign', 'offer_draw', 'accept_draw',
      'cancel_game', 'claim_timeout', 'deposit', 'withdraw',
      'grant_authz', 'admin_action',
    ],
  }).notNull(),
  details: text('details'),              // JSON or description
  gameId: uuid('game_id'),
  ip: text('ip'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const relayerTransactions = pgTable('relayer_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  txHash: text('tx_hash'),
  msgType: text('msg_type').notNull(),         // MsgExec, MsgSend, etc.
  status: text('status', {
    enum: ['pending', 'success', 'failed'],
  }).notNull().default('pending'),
  gasUsed: text('gas_used'),
  errorLog: text('error_log'),
  attempts: integer('attempts').notNull().default(1),
  durationMs: integer('duration_ms'),          // time to confirm
  gameId: uuid('game_id'),
  userAddress: text('user_address'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
})
