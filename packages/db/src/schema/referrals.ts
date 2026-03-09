import { pgTable, text, timestamp, uuid, integer } from 'drizzle-orm/pg-core'
import { users } from './users'

export const referralCodes = pgTable('referral_codes', {
  code: text('code').primaryKey(),
  address: text('address').notNull().references(() => users.address).unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const referrals = pgTable('referrals', {
  id: uuid('id').primaryKey().defaultRandom(),
  referrerAddress: text('referrer_address').notNull().references(() => users.address),
  referredAddress: text('referred_address').notNull().references(() => users.address).unique(), // one referrer per user
  code: text('code').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const referralRewards = pgTable('referral_rewards', {
  id: uuid('id').primaryKey().defaultRandom(),
  referrerAddress: text('referrer_address').notNull().references(() => users.address),
  fromPlayerAddress: text('from_player_address').notNull().references(() => users.address),
  level: integer('level').notNull(), // 1, 2, or 3
  amount: text('amount').notNull(), // uaxm reward
  gameId: uuid('game_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const referralBalances = pgTable('referral_balances', {
  address: text('address').primaryKey().references(() => users.address),
  totalEarned: text('total_earned').notNull().default('0'),
  totalClaimed: text('total_claimed').notNull().default('0'),
  referralCount: integer('referral_count').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
