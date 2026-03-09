import { eq, sql } from 'drizzle-orm'
import { referralCodes, referrals, referralRewards, referralBalances } from '@checkers/db'
import type { Db } from '@checkers/db'

// Reward BPS per level (basis points, max 500 total = 5%)
const REWARD_BPS = { 1: 300, 2: 150, 3: 50 } // 3% + 1.5% + 0.5% = 5%

/** Generate a unique 8-char referral code */
function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no ambiguous chars
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export class ReferralService {
  constructor(private db: Db) {}

  /** Get or create referral code for a user */
  async getOrCreateCode(address: string): Promise<string> {
    const [existing] = await this.db.select().from(referralCodes).where(eq(referralCodes.address, address))
    if (existing) return existing.code

    // Generate unique code (retry on collision)
    for (let i = 0; i < 5; i++) {
      const code = generateCode()
      try {
        await this.db.insert(referralCodes).values({ code, address })
        return code
      } catch {
        continue // collision, retry
      }
    }
    throw new Error('Failed to generate unique referral code')
  }

  /** Apply referral: link referred user to referrer */
  async applyReferral(referredAddress: string, code: string): Promise<boolean> {
    const [codeEntry] = await this.db.select().from(referralCodes).where(eq(referralCodes.code, code.toUpperCase()))
    if (!codeEntry) return false
    if (codeEntry.address === referredAddress) return false // can't refer yourself

    // Check if already referred
    const [existing] = await this.db.select().from(referrals).where(eq(referrals.referredAddress, referredAddress))
    if (existing) return false

    await this.db.insert(referrals).values({
      referrerAddress: codeEntry.address,
      referredAddress,
      code: codeEntry.code,
    })

    // Update referral count
    await this.db
      .insert(referralBalances)
      .values({ address: codeEntry.address, referralCount: 1 })
      .onConflictDoUpdate({
        target: referralBalances.address,
        set: {
          referralCount: sql`${referralBalances.referralCount} + 1`,
          updatedAt: new Date(),
        },
      })

    return true
  }

  /**
   * Distribute referral rewards for a game.
   * Called when a game resolves with a winner.
   * Commission is already taken — referral rewards come FROM the commission.
   */
  async distributeRewards(playerAddress: string, commission: string, gameId: string): Promise<void> {
    const commissionNum = Number(commission)
    if (commissionNum <= 0) return

    // Walk up the referral chain (up to 3 levels)
    let currentAddress = playerAddress
    for (let level = 1; level <= 3; level++) {
      const [ref] = await this.db.select().from(referrals).where(eq(referrals.referredAddress, currentAddress))
      if (!ref) break

      const bps = REWARD_BPS[level as 1 | 2 | 3]
      const reward = String(Math.floor(commissionNum * bps / 10000))
      if (Number(reward) <= 0) break

      // Record reward
      await this.db.insert(referralRewards).values({
        referrerAddress: ref.referrerAddress,
        fromPlayerAddress: playerAddress,
        level,
        amount: reward,
        gameId,
      })

      // Update balance
      await this.db
        .insert(referralBalances)
        .values({ address: ref.referrerAddress, totalEarned: reward })
        .onConflictDoUpdate({
          target: referralBalances.address,
          set: {
            totalEarned: sql`(${referralBalances.totalEarned}::numeric + ${reward}::numeric)::text`,
            updatedAt: new Date(),
          },
        })

      // Move up the chain
      currentAddress = ref.referrerAddress
    }
  }

  /** Get referral stats for a user */
  async getStats(address: string) {
    const [code] = await this.db.select().from(referralCodes).where(eq(referralCodes.address, address))
    const [balance] = await this.db.select().from(referralBalances).where(eq(referralBalances.address, address))
    const recentRewards = await this.db.select().from(referralRewards)
      .where(eq(referralRewards.referrerAddress, address))
      .orderBy(sql`${referralRewards.createdAt} DESC`)
      .limit(20)

    return {
      code: code?.code ?? null,
      totalEarned: balance?.totalEarned ?? '0',
      totalClaimed: balance?.totalClaimed ?? '0',
      referralCount: balance?.referralCount ?? 0,
      recentRewards,
    }
  }
}
