import { pgTable, text, integer, timestamp, pgEnum, uuid, boolean } from 'drizzle-orm/pg-core'
import { users } from './users'

export const jackpotTierEnum = pgEnum('jackpot_tier', ['mini', 'medium', 'large', 'mega', 'super_mega'])

export const jackpotTiers = pgTable('jackpot_tiers', {
  tier: jackpotTierEnum('tier').primaryKey(),
  name: text('name').notNull(),
  targetAmount: text('target_amount').notNull().default('0'), // uaxm threshold to trigger draw
  contributionBps: integer('contribution_bps').notNull().default(100), // basis points from commission
  enabled: boolean('enabled').notNull().default(true),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const jackpotPools = pgTable('jackpot_pools', {
  id: uuid('id').defaultRandom().primaryKey(),
  tier: jackpotTierEnum('tier').notNull(),
  cycle: integer('cycle').notNull().default(1),
  currentAmount: text('current_amount').notNull().default('0'),
  status: text('status', { enum: ['active', 'drawing', 'completed'] }).notNull().default('active'),
  winnerAddress: text('winner_address'),
  winAmount: text('win_amount'),
  drawnAt: timestamp('drawn_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const jackpotContributions = pgTable('jackpot_contributions', {
  id: uuid('id').defaultRandom().primaryKey(),
  poolId: uuid('pool_id').notNull(),
  gameId: uuid('game_id').notNull(),
  playerAddress: text('player_address').notNull(),
  amount: text('amount').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
