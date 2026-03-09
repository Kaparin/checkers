import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const stakingLedger = pgTable('staking_ledger', {
  id: uuid('id').defaultRandom().primaryKey(),
  gameId: uuid('game_id'),
  amount: text('amount').notNull(), // uaxm — 2% of commission
  status: text('status', { enum: ['pending', 'flushed'] }).notNull().default('pending'),
  txHash: text('tx_hash'),
  flushedAt: timestamp('flushed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
