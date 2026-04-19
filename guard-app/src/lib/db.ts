/**
 * Shared IndexedDB open function.
 * All offline stores (action queue + read cache) live in one DB so a single
 * version bump can add stores without conflicts between modules.
 */

const DB_NAME    = 'guardops-offline'
const DB_VERSION = 2

export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('queue')) {
        db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true })
      }
      if (!db.objectStoreNames.contains('cache')) {
        db.createObjectStore('cache', { keyPath: 'key' })
      }
    }

    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}
