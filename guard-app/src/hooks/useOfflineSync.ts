import { useState, useEffect, useCallback, useRef } from 'react'
import axios from 'axios'
import { getAll, remove, QueueEntry } from '../lib/offlineQueue'

export function useOfflineSync() {
  const [isOnline, setIsOnline]         = useState(navigator.onLine)
  const [pendingItems, setPendingItems] = useState<QueueEntry[]>([])
  const [syncing, setSyncing]           = useState(false)
  const flushingRef = useRef(false)

  const pendingCount = pendingItems.length

  const refreshQueue = useCallback(async () => {
    try { setPendingItems(await getAll()) } catch {}
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
            // Server rejected (4xx/5xx) — discard, don't retry
            await remove(entry.id!)
          }
          // No response = still offline, keep in queue
        }
      }
    } finally {
      flushingRef.current = false
      setSyncing(false)
      await refreshQueue()
      if (anySynced) {
        window.dispatchEvent(new CustomEvent('offline-synced'))
      }
    }
  }, [refreshQueue])

  useEffect(() => {
    refreshQueue()

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
  }, [flush, refreshQueue])

  // Flush stale queue on mount (app opened while online after a prior offline session)
  useEffect(() => {
    if (navigator.onLine) flush()
  }, [flush])

  return { isOnline, pendingCount, pendingItems, syncing }
}
