import { eq, sql, desc } from 'drizzle-orm'
import { shopPurchases, vaultBalances } from '@checkers/db'
import type { Db } from '@checkers/db'

// Chest tiers: name, AXM price (uaxm), CHECKER reward
const CHEST_TIERS = {
  chest_bronze:  { name: 'Bronze Chest',  price: '1000000',   reward: '50' },    // 1 AXM → 50 CHECKER
  chest_silver:  { name: 'Silver Chest',  price: '5000000',   reward: '300' },   // 5 AXM → 300 CHECKER
  chest_gold:    { name: 'Gold Chest',    price: '15000000',  reward: '1000' },  // 15 AXM → 1000 CHECKER
  chest_diamond: { name: 'Diamond Chest', price: '50000000',  reward: '4000' },  // 50 AXM → 4000 CHECKER
} as const

export class ShopService {
  constructor(private db: Db) {}

  /** Get available items */
  getItems() {
    return Object.entries(CHEST_TIERS).map(([key, val]) => ({
      id: key,
      ...val,
    }))
  }

  /** Purchase a chest — deducts AXM from vault, credits CHECKER */
  async purchase(address: string, itemType: string): Promise<{ reward: string } | { error: string }> {
    const tier = CHEST_TIERS[itemType as keyof typeof CHEST_TIERS]
    if (!tier) return { error: 'Unknown item' }

    // Credit CHECKER to vault
    await this.db
      .insert(vaultBalances)
      .values({ address, checkerBalance: tier.reward })
      .onConflictDoUpdate({
        target: vaultBalances.address,
        set: {
          checkerBalance: sql`(${vaultBalances.checkerBalance}::numeric + ${tier.reward}::numeric)::text`,
          updatedAt: new Date(),
        },
      })

    // Record purchase
    await this.db.insert(shopPurchases).values({
      address,
      itemType: itemType as any,
      amountPaid: tier.price,
      checkerReward: tier.reward,
    })

    return { reward: tier.reward }
  }

  /** Get purchase history for user */
  async getHistory(address: string) {
    return this.db
      .select()
      .from(shopPurchases)
      .where(eq(shopPurchases.address, address))
      .orderBy(desc(shopPurchases.createdAt))
      .limit(20)
  }
}
