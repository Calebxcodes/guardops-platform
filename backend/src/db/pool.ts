import { Pool, PoolClient, QueryResult } from 'pg'

const useSSL = process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('.railway.internal')

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
})

/**
 * Tenant-aware query wrapper.
 * - With tenantId: acquires a client, sets search_path to tenant_N schema, runs query, resets path.
 * - Without tenantId: runs directly against public schema via pool (fast path, no extra roundtrip).
 * Never call pool.query() directly in new routes — always use this.
 */
export async function query(
  sql: string,
  values?: any[],
  tenantId?: number
): Promise<QueryResult> {
  if (!tenantId) {
    return pool.query(sql, values)
  }

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

export default pool
