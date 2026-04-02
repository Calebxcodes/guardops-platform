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

router.post('/', (req: Request, res: Response) => {
  const db = getDb()
  const { site_id, guard_id, shift_id, type, severity, description } = req.body
  const result = db.prepare(`
    INSERT INTO incidents (site_id, guard_id, shift_id, type, severity, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(site_id, guard_id, shift_id, type, severity || 'minor', description)
  res.status(201).json(db.prepare('SELECT * FROM incidents WHERE id = ?').get(result.lastInsertRowid))
})

router.put('/:id/resolve', (req: Request, res: Response) => {
  const db = getDb()
  db.prepare(`UPDATE incidents SET resolved = 1, resolved_at = datetime('now') WHERE id = ?`).run(req.params.id)
  res.json(db.prepare('SELECT * FROM incidents WHERE id = ?').get(req.params.id))
})

export default router
