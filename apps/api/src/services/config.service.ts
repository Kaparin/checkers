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
  private loaded = false

  constructor(private db: Db) {}

  async loadAll(): Promise<void> {
    const rows = await this.db.select().from(platformConfig)
    for (const row of rows) {
      this.cache.set(row.key, row.value)
    }
    this.loaded = true
  }

  async get(key: string): Promise<string> {
    if (!this.loaded) await this.loadAll()
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
    if (!this.loaded) await this.loadAll()

    const result: Record<string, { value: string; category: string; description: string | null }> = {}

    // Start with defaults
    for (const [key, def] of Object.entries(DEFAULTS)) {
      result[key] = {
        value: this.cache.get(key) ?? def.value,
        category: def.category,
        description: def.description,
      }
    }

    // Add any custom keys from DB
    const rows = await this.db.select().from(platformConfig)
    for (const row of rows) {
      result[row.key] = {
        value: row.value,
        category: row.category,
        description: row.description,
      }
    }

    return result
  }

  async seedDefaults(): Promise<void> {
    for (const [key, def] of Object.entries(DEFAULTS)) {
      const exists = await this.db.select().from(platformConfig).where(eq(platformConfig.key, key))
      if (exists.length === 0) {
        await this.db.insert(platformConfig).values({
          key,
          value: def.value,
          category: def.category as 'general' | 'wager' | 'commission' | 'timeout' | 'maintenance',
          description: def.description,
        })
      }
    }
    await this.loadAll()
  }
}
