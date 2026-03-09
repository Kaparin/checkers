import { pgTable, text, timestamp, uuid, integer } from 'drizzle-orm/pg-core'

export const shopPurchases = pgTable('shop_purchases', {
  id: uuid('id').defaultRandom().primaryKey(),
  address: text('address').notNull(),
  itemType: text('item_type', { enum: ['chest_bronze', 'chest_silver', 'chest_gold', 'chest_diamond', 'theme', 'skin'] }).notNull(),
  amountPaid: text('amount_paid').notNull().default('0'), // uaxm
  checkerReward: text('checker_reward').notNull().default('0'), // CHECKER credited
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
