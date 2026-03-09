import { pgTable, text, timestamp, uuid, integer } from 'drizzle-orm/pg-core'

// In-game chat messages
export const gameMessages = pgTable('game_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  gameId: uuid('game_id').notNull(),
  senderAddress: text('sender_address').notNull(),
  message: text('message').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Global lobby chat
export const globalChatMessages = pgTable('global_chat_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  senderAddress: text('sender_address').notNull(),
  message: text('message').notNull(),
  style: text('style'), // vip style: 'gold', 'diamond', etc.
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
