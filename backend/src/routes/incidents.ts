import { Router, Request, Response } from 'express'
import { query } from '../db/schema'

const router = Router()

router.get('/', async (req: Request, res: Response) => {
  const { rows } = await query(`
    SELECT i.*, s.name as site_name, g.first_name, g.last_name
    FROM incidents i
    LEFT JOIN sites s ON s.id = i.site_id
    LEFT JOIN guards g ON g.id = i.guard_id
    ORDER BY i.created_at DESC
  `)
  res.json(rows)
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

router.post('/', async (req: Request, res: Response) => {
  const { site_id, guard_id, shift_id, type, severity, description, bodycam } = req.body
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
