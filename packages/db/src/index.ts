import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as usersSchema from './schema/users'
import * as gamesSchema from './schema/games'
import * as sessionsSchema from './schema/sessions'
import * as platformConfigSchema from './schema/platform-config'
import * as vaultSchema from './schema/vault'
import * as treasurySchema from './schema/treasury'
import * as auditSchema from './schema/audit'
import * as referralsSchema from './schema/referrals'
import * as jackpotSchema from './schema/jackpot'
import * as chatSchema from './schema/chat'
import * as vipSchema from './schema/vip'
import * as shopSchema from './schema/shop'
import * as eventsSchema from './schema/events'
import * as stakingSchema from './schema/staking'

export const schema = {
  ...usersSchema,
  ...gamesSchema,
  ...sessionsSchema,
  ...platformConfigSchema,
  ...vaultSchema,
  ...treasurySchema,
  ...auditSchema,
  ...referralsSchema,
  ...jackpotSchema,
  ...chatSchema,
  ...vipSchema,
  ...shopSchema,
  ...eventsSchema,
  ...stakingSchema,
}

export function createDb(databaseUrl: string) {
  const sql = neon(databaseUrl)
  return drizzle(sql, { schema })
}

export type Db = ReturnType<typeof createDb>

export { users } from './schema/users'
export { games, gameMoves } from './schema/games'
export { sessions } from './schema/sessions'
export { platformConfig } from './schema/platform-config'
export { vaultBalances, vaultTransactions } from './schema/vault'
export { treasuryLedger } from './schema/treasury'
export { txEvents, relayerTransactions } from './schema/audit'
export { referralCodes, referrals, referralRewards, referralBalances } from './schema/referrals'
export { jackpotTiers, jackpotPools, jackpotContributions } from './schema/jackpot'
export { gameMessages, globalChatMessages } from './schema/chat'
export { vipConfig, vipSubscriptions, vipCustomization } from './schema/vip'
export { shopPurchases } from './schema/shop'
export { events, eventParticipants, announcements } from './schema/events'
export { stakingLedger } from './schema/staking'
