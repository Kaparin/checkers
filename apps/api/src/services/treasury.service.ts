import { eq, sql, desc } from 'drizzle-orm'
import { treasuryLedger, vaultBalances } from '@checkers/db'
import type { Db } from '@checkers/db'

export class TreasuryService {
  constructor(private db: Db) {}

  /** Record a commission entry from a resolved game */
  async recordCommission(
    amount: string,
    gameId: string,
    txHash?: string,
  ): Promise<void> {
    await this.db.insert(treasuryLedger).values({
      source: 'game_commission',
      amount,
      gameId,
      txHash,
    })
  }

  /** Get total treasury balance (sum of all commission entries) */
  async getTotalCommission(): Promise<string> {
    const result = await this.db
      .select({ total: sql<string>`COALESCE(SUM(${treasuryLedger.amount}::numeric), 0)::text` })
      .from(treasuryLedger)
    return result[0]?.total ?? '0'
  }

  /** Get recent ledger entries */
  async getLedger(limit = 50, offset = 0) {
    return this.db
      .select()
      .from(treasuryLedger)
      .orderBy(desc(treasuryLedger.createdAt))
      .limit(limit)
      .offset(offset)
  }

  /** Get total offchain_spent across all users (pending sweep) */
  async getPendingSweep(): Promise<string> {
    const result = await this.db
      .select({ total: sql<string>`COALESCE(SUM(${vaultBalances.offchainSpent}::numeric), 0)::text` })
      .from(vaultBalances)
    return result[0]?.total ?? '0'
  }

  /** Reset offchain_spent for all users after sweep */
  async completeSweep(): Promise<number> {
    const nonZero = await this.db
      .select()
      .from(vaultBalances)
      .where(sql`${vaultBalances.offchainSpent}::numeric > 0`)

    if (nonZero.length === 0) return 0

    await this.db
      .update(vaultBalances)
      .set({ offchainSpent: '0', updatedAt: new Date() })
      .where(sql`${vaultBalances.offchainSpent}::numeric > 0`)

    return nonZero.length
  }
}
