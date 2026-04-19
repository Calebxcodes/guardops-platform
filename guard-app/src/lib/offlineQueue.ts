/**
 * IndexedDB-backed offline action queue.
 * Stores API requests that could not be sent while the device was offline,
 * so they can be replayed in order once connectivity is restored.
 */

import { openDB } from './db'

export interface QueueEntry {
  id?: number
  type: string          // 'clock-in' | 'clock-out' | 'check' | 'checkpoint-scan' | 'incident' | 'message'
  label: string         // Human-readable label shown in the pending-sync banner
  url: string           // Full path e.g. '/api/guard/shifts/clock-in'
  method: 'POST' | 'PUT' | 'PATCH'
  data: unknown
  enqueuedAt: string    // ISO timestamp of the original action
  retries: number
}

const STORE = 'queue'

export async function enqueue(entry: Omit<QueueEntry, 'id' | 'retries'>): Promise<void> {
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).add({ ...entry, retries: 0 })
    tx.oncomplete = () => resolve()
    tx.onerror    = () => reject(tx.error)
  })
  db.close()
}

export async function getAll(): Promise<QueueEntry[]> {
  const db = await openDB()
  const entries = await new Promise<QueueEntry[]>((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
  db.close()
  return entries
}

export async function remove(id: number): Promise<void> {
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror    = () => reject(tx.error)
  })
  db.close()
}

export async function count(): Promise<number> {
  const db = await openDB()
  const n = await new Promise<number>((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).count()
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
  db.close()
  return n
}
