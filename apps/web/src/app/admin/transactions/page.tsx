'use client'

import { useState, useEffect, useCallback } from 'react'
import { getTransactions } from '@/lib/admin-api'
import { SkeletonTable } from '@/components/ui/skeleton'

const PAGE_SIZE = 25

export default function AdminTransactionsPage() {
  const [data, setData] = useState<{ transactions: any[]; total: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [offset, setOffset] = useState(0)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    getTransactions({ limit: PAGE_SIZE, offset })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [offset])

  useEffect(() => { load() }, [load])

  if (error) {
    return <div className="text-danger text-sm">{error}</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold">Transactions</h1>
        {data && (
          <span className="text-xs text-text-muted">{data.total} total</span>
        )}
      </div>

      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        {loading || !data ? (
          <SkeletonTable rows={10} cols={5} />
        ) : data.transactions.length === 0 ? (
          <div className="p-8 text-center text-sm text-text-muted">No transactions found</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-text-muted">
                    <th className="p-3 font-medium">Hash</th>
                    <th className="p-3 font-medium">Msg Type</th>
                    <th className="p-3 font-medium">Status</th>
                    <th className="p-3 font-medium text-right">Gas</th>
                    <th className="p-3 font-medium text-right">Attempts</th>
                    <th className="p-3 font-medium text-right">Duration</th>
                    <th className="p-3 font-medium text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.transactions.map((tx: any, i: number) => (
                    <tr key={tx.hash || tx.id || i} className="hover:bg-bg-subtle/50 transition-colors">
                      <td className="p-3 font-mono text-xs">
                        {tx.hash ? `${tx.hash.slice(0, 10)}...` : '--'}
                      </td>
                      <td className="p-3 text-xs">{tx.msgType || tx.type || '--'}</td>
                      <td className="p-3">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                          tx.status === 'success' ? 'bg-success/10 text-success' :
                          tx.status === 'failed' ? 'bg-danger/10 text-danger' :
                          tx.status === 'pending' ? 'bg-warning/10 text-warning' :
                          'bg-bg-subtle text-text-muted'
                        }`}>
                          {tx.status || '--'}
                        </span>
                      </td>
                      <td className="p-3 text-right tabular-nums text-xs">{tx.gasUsed ?? '--'}</td>
                      <td className="p-3 text-right tabular-nums text-xs">{tx.attempts ?? '--'}</td>
                      <td className="p-3 text-right text-xs text-text-muted whitespace-nowrap">
                        {tx.duration != null ? `${tx.duration}ms` : '--'}
                      </td>
                      <td className="p-3 text-right text-xs text-text-muted whitespace-nowrap">
                        {tx.createdAt
                          ? new Date(tx.createdAt).toLocaleDateString()
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
