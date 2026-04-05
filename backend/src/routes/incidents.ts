import { Router, Request, Response } from 'express'
import { getDb } from '../db/schema'

const router = Router()

router.get('/', (req: Request, res: Response) => {
  const db = getDb()
  const incidents = db.prepare(`
    SELECT i.*, s.name as site_name, g.first_name, g.last_name
    FROM incidents i
    LEFT JOIN sites s ON s.id = i.site_id
    LEFT JOIN guards g ON g.id = i.guard_id
    ORDER BY i.created_at DESC
  `).all()
  res.json(incidents)
})

router.get('/:id', (req: Request, res: Response) => {
  const db = getDb()
  const incident = db.prepare(`
    SELECT i.*, s.name as site_name, s.address as site_address,
           g.first_name, g.last_name, c.name as client_name
    FROM incidents i
    LEFT JOIN sites s ON s.id = i.site_id
    LEFT JOIN guards g ON g.id = i.guard_id
    LEFT JOIN clients c ON c.id = s.client_id
    WHERE i.id = ?
  `).get(req.params.id)
  if (!incident) return res.status(404).json({ error: 'Not found' })
  res.json(incident)
})

router.post('/', (req: Request, res: Response) => {
  const db = getDb()
  const { site_id, guard_id, shift_id, type, severity, description, bodycam } = req.body
  const result = db.prepare(`
    INSERT INTO incidents (site_id, guard_id, shift_id, type, severity, description, bodycam)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(site_id, guard_id || null, shift_id || null, type, severity || 'minor', description, bodycam ? 1 : 0)
  res.status(201).json(db.prepare(`
    SELECT i.*, s.name as site_name, g.first_name, g.last_name
    FROM incidents i LEFT JOIN sites s ON s.id = i.site_id LEFT JOIN guards g ON g.id = i.guard_id
    WHERE i.id = ?
  `).get(result.lastInsertRowid))
})

router.put('/:id/resolve', (req: Request, res: Response) => {
  const db = getDb()
  db.prepare(`UPDATE incidents SET resolved = 1, resolved_at = datetime('now') WHERE id = ?`).run(req.params.id)
  res.json(db.prepare('SELECT * FROM incidents WHERE id = ?').get(req.params.id))
})

export default router
