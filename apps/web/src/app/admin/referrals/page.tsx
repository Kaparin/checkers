'use client'

import { useState, useEffect } from 'react'
import { getAdminSecret } from '@/lib/admin-api'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export default function AdminReferralsPage() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const secret = getAdminSecret()
    fetch(`${API_URL}/admin/dashboard`, { headers: { 'x-admin-secret': secret } })
      .then(r => r.json())
      .then(data => setStats(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Referrals</h1>
      <p className="text-sm text-text-muted">
        Referral system overview. L1: 3%, L2: 1.5%, L3: 0.5% of commissions. Total cap: 5%.
      </p>

      <div className="bg-bg-card border border-border rounded-xl p-6">
        <h2 className="font-semibold mb-4">Reward Tiers</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-text-secondary">
              <th className="text-left p-2">Level</th>
              <th className="text-right p-2">BPS</th>
              <th className="text-right p-2">Percentage</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border"><td className="p-2">Level 1 (direct)</td><td className="p-2 text-right font-mono">300</td><td className="p-2 text-right">3.0%</td></tr>
            <tr className="border-b border-border"><td className="p-2">Level 2</td><td className="p-2 text-right font-mono">150</td><td className="p-2 text-right">1.5%</td></tr>
            <tr><td className="p-2">Level 3</td><td className="p-2 text-right font-mono">50</td><td className="p-2 text-right">0.5%</td></tr>
          </tbody>
        </table>
      </div>

      <div className="bg-bg-card border border-border rounded-xl p-6">
        <p className="text-sm text-text-muted">
          Referral management is automatic. Codes are generated when users visit /referrals.
          Rewards are distributed non-blocking on every game resolve.
        </p>
      </div>
    </div>
  )
}
