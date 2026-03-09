import { pgTable, text, timestamp, uuid, integer, boolean } from 'drizzle-orm/pg-core'

export const events = pgTable('events', {
  id: uuid('id').defaultRandom().primaryKey(),
  type: text('type', { enum: ['contest', 'raffle'] }).notNull(),
  title: text('title').notNull(),
  description: text('description'),
  metric: text('metric'), // for contests: 'most_wins', 'highest_streak', 'most_wagered'
  prizePool: text('prize_pool').notNull().default('0'), // uaxm or CHECKER
  prizeType: text('prize_type', { enum: ['axm', 'checker'] }).notNull().default('checker'),
  maxParticipants: integer('max_participants'),
  startsAt: timestamp('starts_at').notNull(),
  endsAt: timestamp('ends_at').notNull(),
  status: text('status', { enum: ['upcoming', 'active', 'calculating', 'completed', 'canceled'] }).notNull().default('upcoming'),
  createdBy: text('created_by'), // admin address
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const eventParticipants = pgTable('event_participants', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id').notNull(),
  address: text('address').notNull(),
  score: integer('score').notNull().default(0), // for contests
  rank: integer('rank'), // filled after calculation
  prizeWon: text('prize_won'), // amount won
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
})

export const announcements = pgTable('announcements', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  type: text('type', { enum: ['info', 'warning', 'promo', 'update'] }).notNull().default('info'),
  active: boolean('active').notNull().default(true),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
