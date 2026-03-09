import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const treasuryLedger = pgTable('treasury_ledger', {
  id: uuid('id').primaryKey().defaultRandom(),
  source: text('source', {
    enum: ['game_commission', 'referral', 'jackpot', 'staking', 'manual'],
  }).notNull(),
  amount: text('amount').notNull(),     // uaxm
  gameId: uuid('game_id'),              // related game
  txHash: text('tx_hash'),             // on-chain tx
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
