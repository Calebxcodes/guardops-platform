/**
 * IndexedDB read-side cache.
 * Stores last-fetched API responses so pages can show stale data when offline.
 */

import { openDB } from './db'

const STORE = 'cache'

export async function cacheSet<T>(key: string, data: T): Promise<void> {
  try {
    const db = await openDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put({ key, data, cachedAt: Date.now() })
      tx.oncomplete = () => resolve()
      tx.onerror    = () => reject(tx.error)
    })
    db.close()
  } catch { /* non-critical — swallow cache write errors */ }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const db = await openDB()
    const entry = await new Promise<{ key: string; data: T } | undefined>((resolve, reject) => {
      const tx  = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(key)
      req.onsuccess = () => resolve(req.result)
      req.onerror   = () => reject(req.error)
    })
    db.close()
    return entry?.data ?? null
  } catch {
    return null
  }
}
