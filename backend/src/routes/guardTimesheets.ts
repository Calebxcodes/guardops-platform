import { Router, Response } from 'express'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { getDb } from '../db/schema'

const router = Router()
router.use(requireAuth)

router.get('/', (req: AuthRequest, res: Response) => {
  const db = getDb()
  const timesheets = db.prepare(`
    SELECT t.*, s.name as site_name
    FROM timesheets t
    LEFT JOIN shifts sh ON sh.id = t.shift_id
    LEFT JOIN sites s ON s.id = sh.site_id
    WHERE t.guard_id = ?
    ORDER BY t.period_start DESC
  `).all(req.guardId)
  res.json(timesheets)
})

router.get('/:id', (req: AuthRequest, res: Response) => {
  const db = getDb()
  const ts = db.prepare('SELECT * FROM timesheets WHERE id = ? AND guard_id = ?').get(req.params.id, req.guardId)
  if (!ts) return res.status(404).json({ error: 'Not found' })
  res.json(ts)
})

router.put('/:id/submit', (req: AuthRequest, res: Response) => {
  const db = getDb()
  const { guard_notes, regular_hours, overtime_hours } = req.body
  const ts = db.prepare('SELECT * FROM timesheets WHERE id = ? AND guard_id = ?').get(req.params.id, req.guardId) as any
  if (!ts) return res.status(404).json({ error: 'Not found' })
  if (ts.status === 'approved') return res.status(400).json({ error: 'Already approved' })

  const regHrs = regular_hours ?? ts.regular_hours
  const otHrs = overtime_hours ?? ts.overtime_hours
  db.prepare(`
    UPDATE timesheets SET status='submitted', regular_hours=?, overtime_hours=?, total_hours=?,
      guard_notes=?, submitted_at=datetime('now') WHERE id=?
  `).run(regHrs, otHrs, regHrs + otHrs, guard_notes ?? ts.guard_notes, req.params.id)
  res.json(db.prepare('SELECT * FROM timesheets WHERE id = ?').get(req.params.id))
})

router.post('/manual', (req: AuthRequest, res: Response) => {
  const db = getDb()
  const { shift_id, period_start, period_end, regular_hours, overtime_hours, guard_notes } = req.body
  const total = (regular_hours || 0) + (overtime_hours || 0)
  const result = db.prepare(`
    INSERT INTO timesheets (guard_id, shift_id, period_start, period_end, regular_hours, overtime_hours, total_hours, status, source, guard_notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', 'manual', ?)
  `).run(req.guardId, shift_id || null, period_start, period_end, regular_hours || 0, overtime_hours || 0, total, guard_notes)
  res.status(201).json(db.prepare('SELECT * FROM timesheets WHERE id = ?').get(result.lastInsertRowid))
})

export default router
