import { describe, it, expect, beforeEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'

// Records every statement a pooled client runs and how it is released.
const calls: string[] = []
let releasedWith: unknown = 'not released'
let failOn: RegExp | null = null

vi.mock('pg', () => {
  class Pool {
    async connect() {
      return {
        query: async (sql: string) => {
          calls.push(sql)
          if (failOn && failOn.test(sql)) throw new Error(`forced failure: ${sql}`)
          return { rows: [], rowCount: 0 }
        },
        release: (err?: unknown) => { releasedWith = err },
      }
    }
    async query() { return { rows: [], rowCount: 0 } }
  }
  return { Pool }
})

import { query, tenantStorage } from '../db/pool'

describe('tenant-scoped queries cannot leak search_path onto pooled connections', () => {
  beforeEach(() => {
    calls.length = 0
    releasedWith = 'not released'
    failOn = null
  })

  it('scopes the tenant inside a transaction with a transaction-local search_path', async () => {
    await tenantStorage.run(7, () => query('SELECT 1'))
    expect(calls).toEqual(['BEGIN', `SELECT set_config('search_path', $1, true)`, 'SELECT 1', 'COMMIT'])
    expect(releasedWith).toBeUndefined()
  })

  it('rolls back (reverting search_path) when the tenant query fails', async () => {
    failOn = /^SELECT boom$/
    await expect(tenantStorage.run(7, () => query('SELECT boom'))).rejects.toThrow('forced failure')
    expect(calls).toEqual(['BEGIN', `SELECT set_config('search_path', $1, true)`, 'SELECT boom', 'ROLLBACK'])
    expect(releasedWith).toBeUndefined()
  })

  it('destroys the connection when the transaction cannot be closed', async () => {
    failOn = /^(SELECT boom|ROLLBACK)$/
    await expect(query('SELECT boom', [], 7)).rejects.toThrow('forced failure: SELECT boom')
    expect(releasedWith).toBeInstanceOf(Error)
  })

  it('no session-level SET search_path outside the audited places', () => {
    // A session-level SET survives release and poisons the next borrower.
    // Allowed: schema.ts boot migration (single multi-statement query, so an
    // error rolls the SET back) and tenantSchema.ts (connection is destroyed).
    const allowed = new Set(['db/schema.ts', 'db/tenantSchema.ts'])
    const root = path.resolve(__dirname, '..')
    const offenders: string[] = []
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) { if (entry.name !== 'tests') walk(full); continue }
        if (!entry.name.endsWith('.ts')) continue
        const rel = path.relative(root, full).replace(/\\/g, '/')
        if (!allowed.has(rel) && /SET\s+search_path/i.test(fs.readFileSync(full, 'utf8'))) offenders.push(rel)
      }
    }
    walk(root)
    expect(offenders).toEqual([])
  })
})
