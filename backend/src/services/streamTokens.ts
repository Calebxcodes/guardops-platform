/**
 * Short-lived one-time stream tokens for SSE authentication.
 * EventSource doesn't support custom headers, so we issue a token via an
 * authenticated POST then pass it as a query param to the SSE GET endpoint.
 */
import crypto from 'crypto'

const TTL_MS = 30_000 // 30 seconds to open the connection

const guardTokens = new Map<string, { guardId: number; expiresAt: number }>()
const adminTokens = new Map<string, { adminId: number; expiresAt: number }>()

// Purge expired tokens every minute to prevent unbounded growth
setInterval(() => {
  const now = Date.now()
  for (const [k, v] of guardTokens) if (now > v.expiresAt) guardTokens.delete(k)
  for (const [k, v] of adminTokens) if (now > v.expiresAt) adminTokens.delete(k)
}, 60_000)

export function issueGuardStreamToken(guardId: number): string {
  const token = crypto.randomBytes(32).toString('hex')
  guardTokens.set(token, { guardId, expiresAt: Date.now() + TTL_MS })
  return token
}

/** Returns guardId on success, null on invalid/expired token. One-time use. */
export function consumeGuardStreamToken(token: string): number | null {
  const entry = guardTokens.get(token)
  if (!entry) return null
  guardTokens.delete(token)
  if (Date.now() > entry.expiresAt) return null
  return entry.guardId
}

export function issueAdminStreamToken(adminId: number): string {
  const token = crypto.randomBytes(32).toString('hex')
  adminTokens.set(token, { adminId, expiresAt: Date.now() + TTL_MS })
  return token
}

/** Returns adminId on success, null on invalid/expired token. One-time use. */
export function consumeAdminStreamToken(token: string): number | null {
  const entry = adminTokens.get(token)
  if (!entry) return null
  adminTokens.delete(token)
  if (Date.now() > entry.expiresAt) return null
  return entry.adminId
}
