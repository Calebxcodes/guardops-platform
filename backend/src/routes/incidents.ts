import { Router, Request, Response } from 'express'
import { query } from '../db/schema'

const router = Router()

router.get('/', async (req: Request, res: Response) => {
  const page  = Math.max(1, parseInt(req.query.page  as string) || 1)
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50))
  const offset = (page - 1) * limit

  const { rows: [{ total }] } = await query(`SELECT COUNT(*)::int as total FROM incidents`)
  const { rows } = await query(`
    SELECT i.*, s.name as site_name, g.first_name, g.last_name
    FROM incidents i
    LEFT JOIN sites s ON s.id = i.site_id
    LEFT JOIN guards g ON g.id = i.guard_id
    ORDER BY i.created_at DESC
    LIMIT $1 OFFSET $2
  `, [limit, offset])
  res.json({ data: rows, total, page, limit, pages: Math.ceil(total / limit) })
})

router.get('/:id', async (req: Request, res: Response) => {
  const { rows } = await query(`
    SELECT i.*, s.name as site_name, s.address as site_address,
           g.first_name, g.last_name, c.name as client_name
    FROM incidents i
    LEFT JOIN sites s ON s.id = i.site_id
    LEFT JOIN guards g ON g.id = i.guard_id
    LEFT JOIN clients c ON c.id = s.client_id
    WHERE i.id = $1
  `, [req.params.id])
  if (!rows[0]) return res.status(404).json({ error: 'Not found' })
  res.json(rows[0])
})

const VALID_SEVERITIES = ['minor', 'moderate', 'major', 'critical'] as const

router.post('/', async (req: Request, res: Response) => {
  const { site_id, guard_id, shift_id, type, severity, description, bodycam } = req.body
  if (!site_id) return res.status(400).json({ error: 'site_id is required' })
  if (!type || !type.trim()) return res.status(400).json({ error: 'Incident type is required' })
  if (type.length > 200) return res.status(400).json({ error: 'Incident type too long' })
  if (severity && !VALID_SEVERITIES.includes(severity))
    return res.status(400).json({ error: `severity must be one of: ${VALID_SEVERITIES.join(', ')}` })
  if (description && description.length > 5000)
    return res.status(400).json({ error: 'Description must be under 5000 characters' })
  const { rows } = await query(`
    INSERT INTO incidents (site_id, guard_id, shift_id, type, severity, description, bodycam)
    VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id
  `, [site_id, guard_id || null, shift_id || null, type, severity || 'minor', description, bodycam ? 1 : 0])
  const { rows: incident } = await query(`
    SELECT i.*, s.name as site_name, g.first_name, g.last_name
    FROM incidents i LEFT JOIN sites s ON s.id = i.site_id LEFT JOIN guards g ON g.id = i.guard_id
    WHERE i.id = $1
  `, [rows[0].id])
  res.status(201).json(incident[0])
})

router.put('/:id/resolve', async (req: Request, res: Response) => {
  await query(`UPDATE incidents SET resolved = 1, resolved_at = NOW() WHERE id = $1`, [req.params.id])
  const { rows } = await query('SELECT * FROM incidents WHERE id = $1', [req.params.id])
  res.json(rows[0])
})

export default router
