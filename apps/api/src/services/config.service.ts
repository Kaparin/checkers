import { eq } from 'drizzle-orm'
import { platformConfig } from '@checkers/db'
import type { Db } from '@checkers/db'

// Default config values — used when no DB entry exists
const DEFAULTS: Record<string, { value: string; category: string; description: string }> = {
  'wager.min': { value: '1000000', category: 'wager', description: 'Minimum wager in uaxm (1 AXM)' },
  'wager.max': { value: '100000000', category: 'wager', description: 'Maximum wager in uaxm (100 AXM)' },
  'commission.percent': { value: '10', category: 'commission', description: 'Commission percentage on wins' },
  'commission.staking_percent': { value: '2', category: 'commission', description: 'Percentage of commission sent to LAUNCH staking' },
  'timeout.per_move_min': { value: '30', category: 'timeout', description: 'Minimum time per move in seconds' },
  'timeout.per_move_max': { value: '300', category: 'timeout', description: 'Maximum time per move in seconds' },
  'timeout.per_move_default': { value: '60', category: 'timeout', description: 'Default time per move in seconds' },
  'maintenance.enabled': { value: 'false', category: 'maintenance', description: 'Maintenance mode on/off' },
  'maintenance.message': { value: 'System maintenance in progress', category: 'maintenance', description: 'Maintenance mode message' },
  'gas.faucet_amount': { value: '100000', category: 'general', description: 'Gas faucet amount in uaxm' },
  'gas.min_balance': { value: '50000', category: 'general', description: 'Min balance before gas faucet triggers' },
}

export class ConfigService {
  private cache = new Map<string, string>()
  private loadedAt = 0
  private static CACHE_TTL_MS = 60_000 // 1 minute TTL

  constructor(private db: Db) {}

  async loadAll(): Promise<void> {
    const rows = await this.db.select().from(platformConfig)
    this.cache.clear()
    for (const row of rows) {
      this.cache.set(row.key, row.value)
    }
    this.loadedAt = Date.now()
  }

  private get isStale(): boolean {
    return this.loadedAt === 0 || Date.now() - this.loadedAt > ConfigService.CACHE_TTL_MS
  }

  async get(key: string): Promise<string> {
    if (this.isStale) await this.loadAll()
    return this.cache.get(key) ?? DEFAULTS[key]?.value ?? ''
  }

  async getNumber(key: string): Promise<number> {
    const val = await this.get(key)
    return Number(val) || 0
  }

  async getBool(key: string): Promise<boolean> {
    const val = await this.get(key)
    return val === 'true' || val === '1'
  }

  async set(key: string, value: string): Promise<void> {
    const def = DEFAULTS[key]
    await this.db
      .insert(platformConfig)
      .values({
        key,
        value,
        category: (def?.category ?? 'general') as 'general' | 'wager' | 'commission' | 'timeout' | 'maintenance',
        description: def?.description,
      })
      .onConflictDoUpdate({
        target: platformConfig.key,
        set: { value, updatedAt: new Date() },
      })
    this.cache.set(key, value)
  }

  async getAll(): Promise<Record<string, { value: string; category: string; description: string | null }>> {
    // Always reload for admin view to get fresh data
    await this.loadAll()

    const result: Record<string, { value: string; category: string; description: string | null }> = {}

    // Start with defaults
    for (const [key, def] of Object.entries(DEFAULTS)) {
      result[key] = {
        value: this.cache.get(key) ?? def.value,
        category: def.category,
        description: def.description,
      }
    }

    // Add any custom keys from cache (already loaded from DB)
    for (const [key, value] of this.cache) {
      if (!result[key]) {
        result[key] = { value, category: 'general', description: null }
      }
    }

    return result
  }

  async seedDefaults(): Promise<void> {
    const values = Object.entries(DEFAULTS).map(([key, def]) => ({
      key,
      value: def.value,
      category: def.category as 'general' | 'wager' | 'commission' | 'timeout' | 'maintenance',
      description: def.description,
    }))

    // Batch upsert: insert all defaults, skip on conflict
    for (const val of values) {
      await this.db
        .insert(platformConfig)
        .values(val)
        .onConflictDoNothing({ target: platformConfig.key })
    }
    await this.loadAll()
  }
}
