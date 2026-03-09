'use client'

import { useState, useEffect } from 'react'
import { getAdminSecret } from '@/lib/admin-api'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export default function AdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ title: '', body: '', type: 'info' })
  const [creating, setCreating] = useState(false)

  const loadAnnouncements = () => {
    fetch(`${API_URL}/events/announcements/active`)
      .then(r => r.json())
      .then(data => setAnnouncements(data.announcements || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadAnnouncements() }, [])

  const handleCreate = async () => {
    setCreating(true)
    const secret = getAdminSecret()
    try {
      await fetch(`${API_URL}/admin/announcements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
        body: JSON.stringify(form),
      })
      setShowCreate(false)
      setForm({ title: '', body: '', type: 'info' })
      loadAnnouncements()
    } catch {}
    setCreating(false)
  }

  const handleDelete = async (id: string) => {
    const secret = getAdminSecret()
    await fetch(`${API_URL}/admin/announcements/${id}`, {
      method: 'DELETE',
      headers: { 'x-admin-secret': secret },
    }).catch(() => {})
    loadAnnouncements()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Announcements</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-3 py-1.5 bg-accent text-white text-sm rounded-lg"
        >
          {showCreate ? 'Cancel' : 'New Announcement'}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-bg-card border border-border rounded-xl p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-text-secondary mb-1 block">Title</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full px-3 py-2 bg-bg-subtle border border-border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-text-secondary mb-1 block">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full px-3 py-2 bg-bg-subtle border border-border rounded-lg text-sm"
              >
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="promo">Promo</option>
                <option value="update">Update</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-text-secondary mb-1 block">Body</label>
            <textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              className="w-full px-3 py-2 bg-bg-subtle border border-border rounded-lg text-sm"
              rows={3}
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={creating || !form.title || !form.body}
            className="px-4 py-2 bg-accent text-white text-sm rounded-lg disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Publish'}
          </button>
        </div>
      )}

      {/* List */}
      <div className="space-y-3">
        {loading ? (
          <div className="p-8 text-center text-text-muted text-sm">Loading...</div>
        ) : announcements.length === 0 ? (
          <div className="p-8 text-center text-text-muted text-sm border border-dashed border-border rounded-xl">
            No active announcements
          </div>
        ) : (
          announcements.map((a: any) => (
            <div key={a.id} className="flex items-start justify-between p-4 bg-bg-card border border-border rounded-xl">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium uppercase ${
                    a.type === 'warning' ? 'bg-warning/10 text-warning'
                      : a.type === 'promo' ? 'bg-success/10 text-success'
                      : a.type === 'update' ? 'bg-purple-500/10 text-purple-500'
                      : 'bg-accent/10 text-accent'
                  }`}>
                    {a.type}
                  </span>
                  <span className="text-sm font-semibold">{a.title}</span>
                </div>
                <p className="text-xs text-text-secondary">{a.body}</p>
                <p className="text-[10px] text-text-muted mt-1">{new Date(a.createdAt).toLocaleString()}</p>
              </div>
              <button
                onClick={() => handleDelete(a.id)}
                className="text-xs text-danger hover:underline shrink-0 ml-4"
              >
                Delete
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
