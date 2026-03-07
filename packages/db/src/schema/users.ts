import { pgTable, text, timestamp, integer, boolean } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  address: text('address').primaryKey(),
  username: text('username'),
  avatarUrl: text('avatar_url'),
  gamesPlayed: integer('games_played').notNull().default(0),
  gamesWon: integer('games_won').notNull().default(0),
  gamesLost: integer('games_lost').notNull().default(0),
  gamesDraw: integer('games_draw').notNull().default(0),
  totalWagered: text('total_wagered').notNull().default('0'),
  totalWon: text('total_won').notNull().default('0'),
  elo: integer('elo').notNull().default(1200),
  isOnline: boolean('is_online').notNull().default(false),
  lastSeen: timestamp('last_seen', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
