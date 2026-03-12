'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

export function useNavigationBlock(shouldBlock: boolean) {
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const pendingNavigation = useRef<(() => void) | null>(null)

  // Block browser close / refresh
  useEffect(() => {
    if (!shouldBlock) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [shouldBlock])

  // Block browser back button
  useEffect(() => {
    if (!shouldBlock) return
    // Push a dummy state so popstate fires on back
    window.history.pushState({ blocked: true }, '')
    const handler = () => {
      // Re-push to keep the user on the page
      window.history.pushState({ blocked: true }, '')
      setShowLeaveModal(true)
    }
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [shouldBlock])

  const tryNavigate = useCallback((navigate: () => void) => {
    if (shouldBlock) {
      pendingNavigation.current = navigate
      setShowLeaveModal(true)
    } else {
      navigate()
    }
  }, [shouldBlock])

  const confirmLeave = useCallback(() => {
    setShowLeaveModal(false)
    pendingNavigation.current?.()
    pendingNavigation.current = null
  }, [])

  const cancelLeave = useCallback(() => {
    setShowLeaveModal(false)
    pendingNavigation.current = null
  }, [])

  return { showLeaveModal, confirmLeave, cancelLeave, tryNavigate }
}
