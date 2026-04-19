import { useState, useEffect, useCallback, useRef } from 'react'
import axios from 'axios'
import { getAll, remove, count } from '../lib/offlineQueue'

export function useOfflineSync() {
  const [isOnline, setIsOnline]         = useState(navigator.onLine)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing]           = useState(false)
  const flushingRef = useRef(false)

  const refreshCount = useCallback(async () => {
    try { setPendingCount(await count()) } catch {}
  }, [])

  const flush = useCallback(async () => {
    if (flushingRef.current) return
    const token = localStorage.getItem('guard_token')
    if (!token) return

    const entries = await getAll()
    if (entries.length === 0) return

    flushingRef.current = true
    setSyncing(true)
    let anySynced = false

    try {
      const base = (import.meta.env.VITE_API_URL ?? '') as string
      for (const entry of entries) {
        try {
          await axios.request({
            method: entry.method,
            url: `${base}${entry.url}`,
            data: entry.data,
            headers: { Authorization: `Bearer ${token}` },
          })
          await remove(entry.id!)
          anySynced = true
        } catch (err: any) {
          if (err.response) {
            // Server rejected it (4xx/5xx) — discard, don't retry
            await remove(entry.id!)
          }
          // No response = still offline, keep in queue
        }
      }
    } finally {
      flushingRef.current = false
      setSyncing(false)
      await refreshCount()
      if (anySynced) {
        window.dispatchEvent(new CustomEvent('offline-synced'))
      }
    }
  }, [refreshCount])

  useEffect(() => {
    refreshCount()

    const goOnline = () => {
      setIsOnline(true)
      flush()
    }
    const goOffline = () => setIsOnline(false)

    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [flush, refreshCount])

  // Also try a flush on mount in case the app was opened while online
  // and there are stale entries from a previous offline session
  useEffect(() => {
    if (navigator.onLine) flush()
  }, [flush])

  return { isOnline, pendingCount, syncing }
}
