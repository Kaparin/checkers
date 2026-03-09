'use client'

import { useState, useEffect, useCallback } from 'react'
import { getAdminUsers } from '@/lib/admin-api'
import { Skeleton, SkeletonTable } from '@/components/ui/skeleton'

const PAGE_SIZE = 20

export default function AdminUsersPage() {
  const [data, setData] = useState<{ users: any[]; total: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    getAdminUsers({ limit: PAGE_SIZE, offset, search: search || undefined })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [offset, search])

  useEffect(() => { load() }, [load])

  // Debounce search: reset offset when search changes
  useEffect(() => { setOffset(0) }, [search])

  if (error) {
    return <div className="text-danger text-sm">{error}</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-xl font-bold">Users</h1>
        {data && (
          <span className="text-xs text-text-muted">{data.total} total</span>
        )}
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search by address or username..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-sm px-3 py-2 bg-bg-card border border-border rounded-lg text-sm focus:ring-2 focus:ring-accent focus:outline-none"
      />

      {/* Table */}
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        {loading || !data ? (
          <SkeletonTable rows={8} cols={5} />
        ) : data.users.length === 0 ? (
          <div className="p-8 text-center text-sm text-text-muted">No users found</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-text-muted">
                    <th className="p-3 font-medium">Address</th>
                    <th className="p-3 font-medium">Username</th>
                    <th className="p-3 font-medium text-right">ELO</th>
                    <th className="p-3 font-medium text-right">Games</th>
                    <th className="p-3 font-medium text-right">Wagered (AXM)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.users.map((user: any) => (
                    <tr key={user.address} className="hover:bg-bg-subtle/50 transition-colors">
                      <td className="p-3 font-mono text-xs">
                        {user.address.slice(0, 10)}...{user.address.slice(-6)}
                      </td>
                      <td className="p-3">
                        {user.username || <span className="text-text-muted">--</span>}
                      </td>
                      <td className="p-3 text-right tabular-nums">{user.elo ?? '--'}</td>
                      <td className="p-3 text-right tabular-nums">{user.gamesPlayed ?? 0}</td>
                      <td className="p-3 text-right tabular-nums">
                        {user.totalWagered != null
                          ? (Number(user.totalWagered) / 1_000_000).toFixed(2)
                          : '--'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data.total > PAGE_SIZE && (
              <div className="flex items-center justify-between p-3 border-t border-border text-xs text-text-muted">
                <span>
                  Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, data.total)} of {data.total}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                    disabled={offset === 0}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-bg-subtle border border-border disabled:opacity-40 hover:bg-bg-subtle/80 transition-colors"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => setOffset(offset + PAGE_SIZE)}
                    disabled={offset + PAGE_SIZE >= data.total}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-bg-subtle border border-border disabled:opacity-40 hover:bg-bg-subtle/80 transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
