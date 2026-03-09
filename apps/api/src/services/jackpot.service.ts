import { eq, and, sql } from 'drizzle-orm'
import { jackpotTiers, jackpotPools, jackpotContributions } from '@checkers/db'
import type { Db } from '@checkers/db'

export class JackpotService {
  constructor(private db: Db) {}

  /** Get or create active pool for a tier */
  async getActivePool(tier: string) {
    const [pool] = await this.db
      .select()
      .from(jackpotPools)
      .where(and(eq(jackpotPools.tier, tier as any), eq(jackpotPools.status, 'active')))
      .limit(1)

    if (pool) return pool

    // Create new pool (cycle 1)
    const [created] = await this.db
      .insert(jackpotPools)
      .values({ tier: tier as any, cycle: 1, currentAmount: '0', status: 'active' })
      .returning()
    return created
  }

  /**
   * Contribute to jackpot from a game commission (idempotent).
   * Called after each game resolves.
   */
  async contribute(gameId: string, playerAddress: string, commission: string): Promise<void> {
    const commissionNum = Number(commission)
    if (commissionNum <= 0) return

    // Get all enabled tiers
    const tiers = await this.db.select().from(jackpotTiers).where(eq(jackpotTiers.enabled, true))
    if (tiers.length === 0) return

    for (const tier of tiers) {
      const amount = String(Math.floor(commissionNum * tier.contributionBps / 10000))
      if (Number(amount) <= 0) continue

      const pool = await this.getActivePool(tier.tier)

      // Idempotent: check if contribution already exists for this game+pool
      const [existing] = await this.db
        .select()
        .from(jackpotContributions)
        .where(and(
          eq(jackpotContributions.poolId, pool.id),
          eq(jackpotContributions.gameId, gameId),
        ))
        .limit(1)
      if (existing) continue

      await this.db.insert(jackpotContributions).values({
        poolId: pool.id,
        gameId,
        playerAddress,
        amount,
      })

      // Update pool amount
      await this.db
        .update(jackpotPools)
        .set({
          currentAmount: sql`(${jackpotPools.currentAmount}::numeric + ${amount}::numeric)::text`,
        })
        .where(eq(jackpotPools.id, pool.id))

      // Check if target reached → trigger draw
      const targetNum = Number(tier.targetAmount)
      const newAmount = Number(pool.currentAmount) + Number(amount)
      if (targetNum > 0 && newAmount >= targetNum) {
        await this.triggerDraw(pool.id)
      }
    }
  }

  /** Trigger a jackpot draw — pick random winner from contributors */
  async triggerDraw(poolId: string): Promise<{ winner: string; amount: string } | null> {
    // Mark as drawing
    await this.db
      .update(jackpotPools)
      .set({ status: 'drawing' })
      .where(eq(jackpotPools.id, poolId))

    // Get all unique contributors for this pool
    const contributions = await this.db
      .select({ playerAddress: jackpotContributions.playerAddress })
      .from(jackpotContributions)
      .where(eq(jackpotContributions.poolId, poolId))

    if (contributions.length === 0) {
      await this.db.update(jackpotPools).set({ status: 'active' }).where(eq(jackpotPools.id, poolId))
      return null
    }

    // Weighted random: each contribution is one ticket
    const winnerIdx = Math.floor(Math.random() * contributions.length)
    const winner = contributions[winnerIdx].playerAddress

    // Get pool amount
    const [pool] = await this.db.select().from(jackpotPools).where(eq(jackpotPools.id, poolId))
    if (!pool) return null

    // Complete the draw
    await this.db
      .update(jackpotPools)
      .set({
        status: 'completed',
        winnerAddress: winner,
        winAmount: pool.currentAmount,
        drawnAt: new Date(),
      })
      .where(eq(jackpotPools.id, poolId))

    // Create next cycle pool
    await this.db.insert(jackpotPools).values({
      tier: pool.tier,
      cycle: pool.cycle + 1,
      currentAmount: '0',
      status: 'active',
    })

    return { winner, amount: pool.currentAmount }
  }

  /** Get all active pools with tier info */
  async getActivePools() {
    const tiers = await this.db.select().from(jackpotTiers).where(eq(jackpotTiers.enabled, true))
    const pools = []

    for (const tier of tiers) {
      const pool = await this.getActivePool(tier.tier)
      pools.push({
        tier: tier.tier,
        name: tier.name,
        targetAmount: tier.targetAmount,
        currentAmount: pool.currentAmount,
        cycle: pool.cycle,
        contributionBps: tier.contributionBps,
      })
    }

    return pools
  }

  /** Get recent winners */
  async getRecentWinners(limit = 10) {
    return this.db
      .select()
      .from(jackpotPools)
      .where(eq(jackpotPools.status, 'completed'))
      .orderBy(sql`${jackpotPools.drawnAt} DESC`)
      .limit(limit)
  }

  /** Seed default tiers if empty */
  async seedDefaults() {
    const existing = await this.db.select().from(jackpotTiers).limit(1)
    if (existing.length > 0) return

    await this.db.insert(jackpotTiers).values([
      { tier: 'mini', name: 'Mini Jackpot', targetAmount: '10000000', contributionBps: 50 },      // 10 AXM target, 0.5% contribution
      { tier: 'medium', name: 'Medium Jackpot', targetAmount: '50000000', contributionBps: 30 },   // 50 AXM target, 0.3%
      { tier: 'large', name: 'Large Jackpot', targetAmount: '200000000', contributionBps: 15 },    // 200 AXM target, 0.15%
      { tier: 'mega', name: 'Mega Jackpot', targetAmount: '1000000000', contributionBps: 4 },      // 1000 AXM target, 0.04%
      { tier: 'super_mega', name: 'Super Mega Jackpot', targetAmount: '5000000000', contributionBps: 1 }, // 5000 AXM target, 0.01%
    ])
  }
}
