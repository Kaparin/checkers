'use client'

import { useState, useEffect } from 'react'
import { getConfig, updateConfig } from '@/lib/admin-api'
import { Skeleton } from '@/components/ui/skeleton'

type ConfigEntry = { value: string; category: string; description: string | null }

export default function AdminConfigPage() {
  const [config, setConfig] = useState<Record<string, ConfigEntry> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [saved, setSaved] = useState<Record<string, boolean>>({})

  useEffect(() => {
    getConfig()
      .then((res) => {
        setConfig(res.config)
        // Initialize edits with current values
        const initial: Record<string, string> = {}
        for (const [key, entry] of Object.entries(res.config)) {
          initial[key] = entry.value
        }
        setEdits(initial)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async (key: string) => {
    setSaving((prev) => ({ ...prev, [key]: true }))
    setSaved((prev) => ({ ...prev, [key]: false }))
    try {
      await updateConfig(key, edits[key])
      // Update local config
      setConfig((prev) => prev ? {
        ...prev,
        [key]: { ...prev[key], value: edits[key] },
      } : prev)
      setSaved((prev) => ({ ...prev, [key]: true }))
      setTimeout(() => setSaved((prev) => ({ ...prev, [key]: false })), 2000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving((prev) => ({ ...prev, [key]: false }))
    }
  }

  if (error) {
    return <div className="text-danger text-sm">{error}</div>
  }

  if (loading || !config) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold">Configuration</h1>
        <div className="space-y-4">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="p-4 bg-bg-card border border-border rounded-xl space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-3 w-48" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Group config entries by category
  const grouped: Record<string, { key: string; entry: ConfigEntry }[]> = {}
  for (const [key, entry] of Object.entries(config)) {
    const cat = entry.category || 'General'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push({ key, entry })
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Configuration</h1>

      {Object.entries(grouped).map(([category, items]) => (
        <div key={category} className="space-y-3">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">{category}</h2>
          <div className="bg-bg-card border border-border rounded-xl divide-y divide-border">
            {items.map(({ key, entry }) => {
              const isDirty = edits[key] !== entry.value
              return (
                <div key={key} className="p-4 space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium font-mono">{key}</p>
                      {entry.description && (
                        <p className="text-xs text-text-muted mt-0.5">{entry.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {saved[key] && (
                        <span className="text-xs text-success font-medium">Saved</span>
                      )}
                      <button
                        onClick={() => handleSave(key)}
                        disabled={!isDirty || saving[key]}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          isDirty
                            ? 'bg-accent text-white hover:bg-accent/90'
                            : 'bg-bg-subtle text-text-muted cursor-not-allowed'
                        } disabled:opacity-50`}
                      >
                        {saving[key] ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={edits[key] ?? ''}
                    onChange={(e) => setEdits((prev) => ({ ...prev, [key]: e.target.value }))}
                    className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm font-mono focus:ring-2 focus:ring-accent focus:outline-none"
                  />
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
