import { pgTable, text, timestamp, integer, uuid, jsonb } from 'drizzle-orm/pg-core'
import { users } from './users'

export const games = pgTable('games', {
  id: uuid('id').primaryKey().defaultRandom(),
  blackPlayer: text('black_player').references(() => users.address),
  whitePlayer: text('white_player').references(() => users.address),
  winner: text('winner').references(() => users.address),
  status: text('status', {
    enum: ['waiting', 'playing', 'black_wins', 'white_wins', 'draw', 'canceled', 'timeout'],
  }).notNull().default('waiting'),
  wager: text('wager').notNull(), // micro COIN amount
  timePerMove: integer('time_per_move').notNull().default(60),
  gameState: jsonb('game_state').notNull(), // serialized GameState
  moveCount: integer('move_count').notNull().default(0),
  currentTurnDeadline: timestamp('current_turn_deadline', { withTimezone: true }),
  txHashCreate: text('tx_hash_create'),     // wager lock tx
  txHashJoin: text('tx_hash_join'),         // opponent wager lock tx
  txHashResolve: text('tx_hash_resolve'),   // payout tx
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
})

export const gameMoves = pgTable('game_moves', {
  id: uuid('id').primaryKey().defaultRandom(),
  gameId: uuid('game_id').notNull().references(() => games.id),
  moveNumber: integer('move_number').notNull(),
  player: text('player').notNull().references(() => users.address),
  fromRow: integer('from_row').notNull(),
  fromCol: integer('from_col').notNull(),
  toRow: integer('to_row').notNull(),
  toCol: integer('to_col').notNull(),
  captures: jsonb('captures').$type<[number, number][]>().default([]),
  promotion: integer('promotion').notNull().default(0), // 0 or 1
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
