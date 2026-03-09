import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './users'

export const vaultBalances = pgTable('vault_balances', {
  address: text('address').primaryKey().references(() => users.address),
  available: text('available').notNull().default('0'),    // uaxm available to wager
  locked: text('locked').notNull().default('0'),          // uaxm locked in active games
  bonus: text('bonus').notNull().default('0'),            // uaxm bonus (from referrals, events, etc.)
  checkerBalance: text('checker_balance').notNull().default('0'), // virtual CHECKER tokens
  offchainSpent: text('offchain_spent').notNull().default('0'),   // accumulated for treasury sweep
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const vaultTransactions = pgTable('vault_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  address: text('address').notNull().references(() => users.address),
  type: text('type', {
    enum: ['deposit', 'withdraw', 'wager_lock', 'wager_unlock', 'win_credit', 'commission', 'bonus', 'admin_credit', 'admin_debit'],
  }).notNull(),
  amount: text('amount').notNull(),                // uaxm amount
  balanceBefore: text('balance_before').notNull(),  // snapshot
  balanceAfter: text('balance_after').notNull(),    // snapshot
  reason: text('reason'),                          // human-readable explanation
  gameId: uuid('game_id'),                         // related game if any
  txHash: text('tx_hash'),                         // on-chain tx if any
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
