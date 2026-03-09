'use client'

import { useState, useEffect } from 'react'
import { getAdminSecret } from '@/lib/admin-api'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export default function AdminEventsPage() {
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API_URL}/events`)
      .then(r => r.json())
      .then(data => setEvents(data.events || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Create event form
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    type: 'contest',
    title: '',
    description: '',
    metric: 'most_wins',
    prizePool: '1000000',
    prizeType: 'checker',
    startsAt: '',
    endsAt: '',
  })
  const [creating, setCreating] = useState(false)

  const handleCreate = async () => {
    setCreating(true)
    const secret = getAdminSecret()
    try {
      await fetch(`${API_URL}/admin/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
        body: JSON.stringify(form),
      })
      setShowCreate(false)
      // Reload
      const res = await fetch(`${API_URL}/events`)
      const data = await res.json()
      setEvents(data.events || [])
    } catch {}
    setCreating(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Events</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-3 py-1.5 bg-accent text-white text-sm rounded-lg"
        >
          {showCreate ? 'Cancel' : 'Create Event'}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-bg-card border border-border rounded-xl p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-text-secondary mb-1 block">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full px-3 py-2 bg-bg-subtle border border-border rounded-lg text-sm"
              >
                <option value="contest">Contest</option>
                <option value="raffle">Raffle</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-text-secondary mb-1 block">Title</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full px-3 py-2 bg-bg-subtle border border-border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-text-secondary mb-1 block">Starts At</label>
              <input
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                className="w-full px-3 py-2 bg-bg-subtle border border-border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-text-secondary mb-1 block">Ends At</label>
              <input
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                className="w-full px-3 py-2 bg-bg-subtle border border-border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-text-secondary mb-1 block">Prize Pool</label>
              <input
                value={form.prizePool}
                onChange={(e) => setForm({ ...form, prizePool: e.target.value })}
                className="w-full px-3 py-2 bg-bg-subtle border border-border rounded-lg text-sm font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-text-secondary mb-1 block">Prize Type</label>
              <select
                value={form.prizeType}
                onChange={(e) => setForm({ ...form, prizeType: e.target.value })}
                className="w-full px-3 py-2 bg-bg-subtle border border-border rounded-lg text-sm"
              >
                <option value="checker">CHECKER</option>
                <option value="axm">AXM</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-text-secondary mb-1 block">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 bg-bg-subtle border border-border rounded-lg text-sm"
              rows={3}
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={creating || !form.title || !form.startsAt || !form.endsAt}
            className="px-4 py-2 bg-accent text-white text-sm rounded-lg disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Create'}
          </button>
        </div>
      )}

      {/* Events list */}
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-text-muted text-sm">Loading...</div>
        ) : events.length === 0 ? (
          <div className="p-8 text-center text-text-muted text-sm">No events yet</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-text-secondary">
                <th className="text-left p-3">Title</th>
                <th className="text-left p-3">Type</th>
                <th className="text-left p-3">Status</th>
                <th className="text-right p-3">Prize</th>
                <th className="text-right p-3">Dates</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e: any) => (
                <tr key={e.id} className="border-b border-border last:border-0">
                  <td className="p-3 font-medium">{e.title}</td>
                  <td className="p-3 capitalize">{e.type}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      e.status === 'active' ? 'bg-success/10 text-success'
                        : e.status === 'completed' ? 'bg-text-muted/10 text-text-muted'
                        : 'bg-accent/10 text-accent'
                    }`}>
                      {e.status}
                    </span>
                  </td>
                  <td className="p-3 text-right font-mono">{(Number(e.prizePool) / 1_000_000).toFixed(0)} {e.prizeType?.toUpperCase()}</td>
                  <td className="p-3 text-right text-xs text-text-muted">
                    {e.startsAt ? new Date(e.startsAt).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
