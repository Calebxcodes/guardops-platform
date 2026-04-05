import { Router, Request, Response } from 'express'
import { query } from '../db/schema'
import crypto from 'crypto'

const router = Router()

router.post('/generate', async (req: Request, res: Response) => {
  const { client_id, label } = req.body
  const { rows } = await query('SELECT * FROM clients WHERE id = $1', [client_id])
  if (!rows[0]) return res.status(404).json({ error: 'Client not found' })

  const token = crypto.randomBytes(32).toString('hex')
  await query('INSERT INTO client_portal_tokens (client_id, token, label) VALUES ($1,$2,$3)', [client_id, token, label || 'Portal Access'])
  res.json({ token, url: `/portal/${token}` })
})

router.get('/tokens/:clientId', async (req: Request, res: Response) => {
  const { rows } = await query(
    'SELECT * FROM client_portal_tokens WHERE client_id = $1 ORDER BY created_at DESC',
    [req.params.clientId]
  )
  res.json(rows)
})

router.delete('/tokens/:tokenId', async (req: Request, res: Response) => {
  await query('UPDATE client_portal_tokens SET active = 0 WHERE id = $1', [req.params.tokenId])
  res.json({ success: true })
})

router.get('/:token', async (req: Request, res: Response) => {
  const { rows: tokenRows } = await query(
    'SELECT * FROM client_portal_tokens WHERE token = $1 AND active = 1',
    [req.params.token]
  )
  const tokenRow = tokenRows[0]
  if (!tokenRow) return res.status(401).json({ error: 'Invalid or expired portal link' })

  const { rows: clientRows } = await query(
    'SELECT id, name, contact_name, contact_email, contact_phone FROM clients WHERE id = $1',
    [tokenRow.client_id]
  )
  const client = clientRows[0]
  if (!client) return res.status(404).json({ error: 'Client not found' })

  const [
    { rows: sites },
    { rows: activeShifts },
    { rows: incidents },
    { rows: patrols },
  ] = await Promise.all([
    query(`
      SELECT s.id, s.name, s.address, s.guards_required,
        (SELECT COUNT(*)::int FROM shifts sh WHERE sh.site_id = s.id AND sh.status IN ('active','assigned') AND sh.start_time::date = CURRENT_DATE) as active_guards
      FROM sites s WHERE s.client_id = $1 AND s.active = 1
    `, [client.id]),
    query(`
      SELECT sh.id, sh.start_time, sh.end_time, sh.status,
             s.name as site_name,
             g.first_name, g.last_name, g.status as guard_status
      FROM shifts sh
      JOIN sites s ON s.id = sh.site_id
      LEFT JOIN guards g ON g.id = sh.guard_id
      WHERE s.client_id = $1
      AND (sh.status IN ('active','assigned') OR sh.start_time::date = CURRENT_DATE)
      ORDER BY sh.start_time DESC
      LIMIT 20
    `, [client.id]),
    query(`
      SELECT i.id, i.type, i.severity, i.description, i.resolved, i.resolved_at, i.created_at,
             i.ai_report, i.bodycam,
             s.name as site_name,
             g.first_name, g.last_name
      FROM incidents i
      JOIN sites s ON s.id = i.site_id
      LEFT JOIN guards g ON g.id = i.guard_id
      WHERE s.client_id = $1
      AND i.created_at >= NOW() - INTERVAL '30 days'
      ORDER BY i.created_at DESC
      LIMIT 50
    `, [client.id]),
    query(`
      SELECT cc.created_at, rc.name as checkpoint_name, s.name as site_name,
             g.first_name, g.last_name, cc.lat, cc.lng
      FROM checkpoint_checkins cc
      JOIN route_checkpoints rc ON rc.id = cc.checkpoint_id
      JOIN sites s ON s.id = rc.site_id
      LEFT JOIN guards g ON g.id = cc.guard_id
      WHERE s.client_id = $1
      AND cc.created_at >= NOW() - INTERVAL '1 day'
      ORDER BY cc.created_at DESC
      LIMIT 100
    `, [client.id]),
  ])

  const totalSites   = (sites as any[]).length
  const coveredSites = (sites as any[]).filter((s: any) => s.active_guards >= s.guards_required).length
  const openIncidents = (incidents as any[]).filter((i: any) => !i.resolved).length

  res.json({
    client,
    summary: { total_sites: totalSites, covered_sites: coveredSites, open_incidents: openIncidents, generated_at: new Date().toISOString() },
    sites,
    active_shifts: activeShifts,
    incidents,
    patrols,
  })
})

export default router
