import { eq, and, gt } from 'drizzle-orm'
import { vipConfig, vipSubscriptions, vipCustomization } from '@checkers/db'
import type { Db } from '@checkers/db'

export class VipService {
  constructor(private db: Db) {}

  /** Get active subscription for user */
  async getSubscription(address: string) {
    const now = new Date()
    const [sub] = await this.db
      .select()
      .from(vipSubscriptions)
      .where(and(
        eq(vipSubscriptions.address, address),
        eq(vipSubscriptions.active, true),
        gt(vipSubscriptions.expiresAt, now),
      ))
      .limit(1)
    return sub || null
  }

  /** Get VIP tier for user (null if not VIP) */
  async getTier(address: string): Promise<string | null> {
    const sub = await this.getSubscription(address)
    return sub?.tier ?? null
  }

  /** Get customization for user */
  async getCustomization(address: string) {
    const [custom] = await this.db
      .select()
      .from(vipCustomization)
      .where(eq(vipCustomization.address, address))
      .limit(1)
    return custom || null
  }

  /** Update customization */
  async setCustomization(address: string, data: {
    nameGradient?: string | null
    frameStyle?: string | null
    badgeIcon?: string | null
    boardTheme?: string | null
    pieceStyle?: string | null
  }) {
    const existing = await this.getCustomization(address)
    if (existing) {
      await this.db.update(vipCustomization).set({
        ...data,
        updatedAt: new Date(),
      }).where(eq(vipCustomization.address, address))
    } else {
      await this.db.insert(vipCustomization).values({
        address,
        ...data,
      })
    }
  }

  /** Get all tier configs */
  async getTiers() {
    return this.db.select().from(vipConfig).where(eq(vipConfig.enabled, true))
  }

  /** Get VIP info for user (subscription + customization + tiers) */
  async getVipInfo(address: string) {
    const [sub, custom, tiers] = await Promise.all([
      this.getSubscription(address),
      this.getCustomization(address),
      this.getTiers(),
    ])
    return {
      subscription: sub,
      customization: custom,
      tiers,
    }
  }

  /** Seed default VIP tiers */
  async seedDefaults() {
    const existing = await this.db.select().from(vipConfig).limit(1)
    if (existing.length > 0) return

    await this.db.insert(vipConfig).values([
      { tier: 'silver', name: 'Silver', priceMonthly: '5000000', priceYearly: '50000000', checkerMonthly: '100' },
      { tier: 'gold', name: 'Gold', priceMonthly: '15000000', priceYearly: '150000000', checkerMonthly: '500' },
      { tier: 'diamond', name: 'Diamond', priceMonthly: '50000000', priceYearly: '500000000', checkerMonthly: '2000' },
    ])
  }
}
