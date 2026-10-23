import { Pool, PoolClient, QueryResult } from 'pg'
import { AsyncLocalStorage } from 'async_hooks'

const useSSL = process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('.railway.internal')

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  // Every physical connection starts on public. Tenant scoping below is
  // transaction-local, so it can never outlive the checkout that set it.
  options: '-c search_path=public',
})

// Stores the active tenantId for the current async context (request lifecycle).
// Set by requireAdmin middleware when JWT contains a tenantId.
// Automatically inherited by all async operations within the same request.
export const tenantStorage = new AsyncLocalStorage<number>()

// Runs one statement inside a transaction whose search_path points at the
// tenant. set_config(..., true) is SET LOCAL: COMMIT or ROLLBACK reverts it,
// so the connection goes back to the pool on public however the query ended.
// If the transaction cannot be closed, the connection is destroyed instead.
async function queryWithTenant(sql: string, values: any[] | undefined, tenantId: number): Promise<QueryResult> {
  const client: PoolClient = await pool.connect()
  let broken: Error | undefined
  try {
    await client.query('BEGIN')
    await client.query(`SELECT set_config('search_path', $1, true)`, [`tenant_${Number(tenantId)}, public`])
    const result = await client.query(sql, values)
    await client.query('COMMIT')
    return result
  } catch (err) {
    try {
      await client.query('ROLLBACK')
    } catch (rollbackErr: any) {
      broken = rollbackErr
    }
    throw err
  } finally {
    client.release(broken)
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
