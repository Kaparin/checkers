/**
 * Sequence Manager — tracks account sequence (nonce) in-memory
 * to prevent nonce races when the relayer submits multiple txs.
 */

import { StargateClient } from '@cosmjs/stargate'
import { AXIOME_RPC } from '@checkers/shared/chain'

export class SequenceManager {
  private accountNumber = 0
  private sequence = 0
  private initialized = false
  private address: string
  private lockPromise: Promise<void> = Promise.resolve()

  constructor(address: string) {
    this.address = address
  }

  /** Acquire exclusive lock for sequence operations */
  private acquireLock(): Promise<() => void> {
    let release: () => void
    const next = new Promise<void>((resolve) => { release = resolve })
    const prev = this.lockPromise
    this.lockPromise = next
    return prev.then(() => release!)
  }

  /** Initialize from chain */
  async init(): Promise<void> {
    await this.refresh()
    this.initialized = true
  }

  /** Refresh sequence from chain */
  async refresh(): Promise<void> {
    const client = await StargateClient.connect(AXIOME_RPC)
    try {
      const account = await client.getAccount(this.address)
      if (account) {
        this.accountNumber = account.accountNumber
        this.sequence = account.sequence
      }
    } finally {
      client.disconnect()
    }
  }

  /** Get current sequence and increment atomically */
  async getAndIncrement(): Promise<{ accountNumber: number; sequence: number }> {
    const release = await this.acquireLock()
    try {
      if (!this.initialized) await this.init()
      const result = { accountNumber: this.accountNumber, sequence: this.sequence }
      this.sequence++
      return result
    } finally {
      release()
    }
  }

  /** Force set sequence (after mismatch error) */
  async forceSet(sequence: number): Promise<void> {
    const release = await this.acquireLock()
    try {
      this.sequence = sequence
    } finally {
      release()
    }
  }

  /** Handle sequence mismatch — refresh from chain */
  async handleSequenceMismatch(): Promise<void> {
    const release = await this.acquireLock()
    try {
      await this.refresh()
    } finally {
      release()
    }
  }

  getState() {
    return { accountNumber: this.accountNumber, sequence: this.sequence, initialized: this.initialized }
  }
}
