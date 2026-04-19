/**
 * In-process SSE client registry.
 *
 * Single-instance safe (Railway runs one dyno). If horizontal scaling is
 * ever needed, replace the in-memory Maps with a Redis pub/sub fan-out.
 */
import { Response } from 'express'

interface SSEClient {
  res: Response
  heartbeat: NodeJS.Timeout
}

// One slot per guard — newer tab replaces older one
const guardClients = new Map<number, SSEClient>()

// All connected admin tabs
const adminClients = new Set<SSEClient>()

function makeClient(res: Response): SSEClient {
  // Heartbeat keeps Railway's proxy from closing idle SSE connections
  const heartbeat = setInterval(() => {
    try { res.write(': heartbeat\n\n') } catch {}
  }, 25000)
  return { res, heartbeat }
}

function destroyClient(client: SSEClient) {
  clearInterval(client.heartbeat)
}

function send(client: SSEClient, event: string, data: unknown) {
  try {
    client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  } catch {}
}

// ── Guard ─────────────────────────────────────────────────────────────────────

export function registerGuardSSE(guardId: number, res: Response): () => void {
  // Close any existing connection for this guard (e.g. page reload)
  const existing = guardClients.get(guardId)
  if (existing) {
    destroyClient(existing)
    guardClients.delete(guardId)
  }

  const client = makeClient(res)
  guardClients.set(guardId, client)

  return () => {
    destroyClient(client)
    // Only remove if this is still the registered client (no race with new tab)
    if (guardClients.get(guardId) === client) guardClients.delete(guardId)
  }
}

export function pushToGuard(guardId: number, event: string, data: unknown) {
  const client = guardClients.get(guardId)
  if (client) send(client, event, data)
}

// ── Admin ─────────────────────────────────────────────────────────────────────

export function registerAdminSSE(res: Response): () => void {
  const client = makeClient(res)
  adminClients.add(client)
  return () => {
    destroyClient(client)
    adminClients.delete(client)
  }
}

export function pushToAdmins(event: string, data: unknown) {
  for (const client of adminClients) send(client, event, data)
}
