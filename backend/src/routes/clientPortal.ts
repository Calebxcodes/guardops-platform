import { Router, Request, Response } from 'express'
import { getDb } from '../db/schema'
import crypto from 'crypto'

const router = Router()

// Generate a portal access token for a client
router.post('/generate', (req: Request, res: Response) => {
  const db = getDb()
  const { client_id, label } = req.body
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(client_id)
  if (!client) return res.status(404).json({ error: 'Client not found' })

  const token = crypto.randomBytes(32).toString('hex')
  db.prepare('INSERT INTO client_portal_tokens (client_id, token, label) VALUES (?, ?, ?)')
    .run(client_id, token, label || 'Portal Access')

  res.json({ token, url: `/portal/${token}` })
})

// List tokens for a client
router.get('/tokens/:clientId', (req: Request, res: Response) => {
  const db = getDb()
  const tokens = db.prepare(
    'SELECT * FROM client_portal_tokens WHERE client_id = ? ORDER BY created_at DESC'
  ).all(req.params.clientId)
  res.json(tokens)
})

// Revoke a token
router.delete('/tokens/:tokenId', (req: Request, res: Response) => {
  const db = getDb()
  db.prepare('UPDATE client_portal_tokens SET active = 0 WHERE id = ?').run(req.params.tokenId)
  res.json({ success: true })
})

// THE PORTAL DATA ENDPOINT — accessed with token only, no admin auth
router.get('/:token', (req: Request, res: Response) => {
  const db = getDb()
  const tokenRow = db.prepare(
    'SELECT * FROM client_portal_tokens WHERE token = ? AND active = 1'
  ).get(req.params.token) as any

  if (!tokenRow) return res.status(401).json({ error: 'Invalid or expired portal link' })

  const client = db.prepare('SELECT id, name, contact_name, contact_email, contact_phone FROM clients WHERE id = ?')
    .get(tokenRow.client_id) as any
  if (!client) return res.status(404).json({ error: 'Client not found' })

  // Sites for this client
  const sites = db.prepare(`
    SELECT s.id, s.name, s.address, s.guards_required,
      (SELECT COUNT(*) FROM shifts sh WHERE sh.site_id = s.id AND sh.status IN ('active','assigned') AND date(sh.start_time) = date('now')) as active_guards
    FROM sites s WHERE s.client_id = ? AND s.active = 1
  `).all(client.id)

  // Active/today's shifts for client's sites
  const activeShifts = db.prepare(`
    SELECT sh.id, sh.start_time, sh.end_time, sh.status,
           s.name as site_name,
           g.first_name, g.last_name, g.status as guard_status
    FROM shifts sh
    JOIN sites s ON s.id = sh.site_id
    LEFT JOIN guards g ON g.id = sh.guard_id
    WHERE s.client_id = ?
    AND (sh.status IN ('active','assigned') OR date(sh.start_time) = date('now'))
    ORDER BY sh.start_time DESC
    LIMIT 20
  `).all(client.id)

  // Recent incidents for client's sites (last 30 days)
  const incidents = db.prepare(`
    SELECT i.id, i.type, i.severity, i.description, i.resolved, i.resolved_at, i.created_at,
           i.ai_report, i.bodycam,
           s.name as site_name,
           g.first_name, g.last_name
    FROM incidents i
    JOIN sites s ON s.id = i.site_id
    LEFT JOIN guards g ON g.id = i.guard_id
    WHERE s.client_id = ?
    AND i.created_at >= date('now', '-30 days')
    ORDER BY i.created_at DESC
    LIMIT 50
  `).all(client.id)

  // Patrol log (checkpoint checkins last 24h for client sites)
  const patrols = db.prepare(`
    SELECT cc.created_at, rc.name as checkpoint_name, s.name as site_name,
           g.first_name, g.last_name, cc.lat, cc.lng
    FROM checkpoint_checkins cc
    JOIN route_checkpoints rc ON rc.id = cc.checkpoint_id
    JOIN sites s ON s.id = rc.site_id
    LEFT JOIN guards g ON g.id = cc.guard_id
    WHERE s.client_id = ?
    AND cc.created_at >= date('now', '-1 day')
    ORDER BY cc.created_at DESC
    LIMIT 100
  `).all(client.id)

  // Summary stats
  const totalSites = (sites as any[]).length
  const coveredSites = (sites as any[]).filter((s: any) => s.active_guards >= s.guards_required).length
  const openIncidents = (incidents as any[]).filter((i: any) => !i.resolved).length

  res.json({
    client,
    summary: {
      total_sites: totalSites,
      covered_sites: coveredSites,
      open_incidents: openIncidents,
      generated_at: new Date().toISOString(),
    },
    sites,
    active_shifts: activeShifts,
    incidents,
    patrols,
  })
})

export default router
