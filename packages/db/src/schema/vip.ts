import { pgTable, text, timestamp, uuid, integer, pgEnum, boolean } from 'drizzle-orm/pg-core'

export const vipTierEnum = pgEnum('vip_tier', ['silver', 'gold', 'diamond'])

export const vipConfig = pgTable('vip_config', {
  tier: vipTierEnum('tier').primaryKey(),
  name: text('name').notNull(),
  priceMonthly: text('price_monthly').notNull().default('0'), // uaxm
  priceYearly: text('price_yearly').notNull().default('0'),
  checkerMonthly: text('checker_monthly').notNull().default('0'), // CHECKER bonus per month
  enabled: boolean('enabled').notNull().default(true),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const vipSubscriptions = pgTable('vip_subscriptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  address: text('address').notNull(),
  tier: vipTierEnum('tier').notNull(),
  startsAt: timestamp('starts_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  amountPaid: text('amount_paid').notNull().default('0'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const vipCustomization = pgTable('vip_customization', {
  address: text('address').primaryKey(),
  nameGradient: text('name_gradient'), // CSS gradient class
  frameStyle: text('frame_style'),     // avatar frame
  badgeIcon: text('badge_icon'),       // badge emoji/icon
  boardTheme: text('board_theme'),     // premium theme name
  pieceStyle: text('piece_style'),     // custom piece skin
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
