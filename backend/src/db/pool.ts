import { Pool, PoolClient, QueryResult } from 'pg'
import { AsyncLocalStorage } from 'async_hooks'

const useSSL = process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('.railway.internal')

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
})

// Stores the active tenantId for the current async context (request lifecycle).
// Set by requireAdmin middleware when JWT contains a tenantId.
// Automatically inherited by all async operations within the same request.
export const tenantStorage = new AsyncLocalStorage<number>()

async function queryWithTenant(sql: string, values: any[] | undefined, tenantId: number): Promise<QueryResult> {
  const schemaName = `tenant_${tenantId}`
  const client: PoolClient = await pool.connect()
  try {
    await client.query(`SET search_path TO ${schemaName}, public`)
    const result = await client.query(sql, values)
    await client.query(`SET search_path TO public`)
    return result
  } finally {
    client.release()
  }
}

/**
 * Tenant-aware query wrapper.
 * - Explicit tenantId param: uses that tenant's schema (search_path).
 * - No param: checks AsyncLocalStorage — if tenantId is stored for this request, uses it.
 * - Neither: runs against the default (public) schema.
 */
export async function query(
  sql: string,
  values?: any[],
  tenantId?: number
): Promise<QueryResult> {
  const tid = tenantId ?? tenantStorage.getStore()
  if (tid) return queryWithTenant(sql, values, tid)
  return pool.query(sql, values)
}

export default pool
