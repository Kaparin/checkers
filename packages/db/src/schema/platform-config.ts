import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const platformConfig = pgTable('platform_config', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  category: text('category', {
    enum: ['general', 'wager', 'commission', 'timeout', 'maintenance'],
  }).notNull().default('general'),
  description: text('description'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
