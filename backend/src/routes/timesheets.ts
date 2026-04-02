import { Router, Request, Response } from 'express'
import { getDb } from '../db/schema'

const router = Router()

router.get('/', (req: Request, res: Response) => {
  const db = getDb()
  const { status, guard_id } = req.query
  let query = `
    SELECT t.*, g.first_name, g.last_name
    FROM timesheets t
    LEFT JOIN guards g ON g.id = t.guard_id
    WHERE 1=1
  `
  const params: any[] = []
  if (status) { query += ' AND t.status = ?'; params.push(status) }
  if (guard_id) { query += ' AND t.guard_id = ?'; params.push(guard_id) }
  query += ' ORDER BY t.period_start DESC'
  res.json(db.prepare(query).all(...params))
})

router.get('/:id', (req: Request, res: Response) => {
  const db = getDb()
  const ts = db.prepare(`
    SELECT t.*, g.first_name, g.last_name, g.hourly_rate
    FROM timesheets t LEFT JOIN guards g ON g.id = t.guard_id
    WHERE t.id = ?
  `).get(req.params.id)
  if (!ts) return res.status(404).json({ error: 'Timesheet not found' })
  res.json(ts)
})

router.post('/', (req: Request, res: Response) => {
  const db = getDb()
  const { guard_id, shift_id, period_start, period_end, regular_hours, overtime_hours, source, guard_notes } = req.body
  const total = (regular_hours || 0) + (overtime_hours || 0)
  const result = db.prepare(`
    INSERT INTO timesheets (guard_id, shift_id, period_start, period_end, regular_hours, overtime_hours, total_hours, source, guard_notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(guard_id, shift_id || null, period_start, period_end, regular_hours || 0, overtime_hours || 0, total, source || 'manual', guard_notes)
  res.status(201).json(db.prepare('SELECT * FROM timesheets WHERE id = ?').get(result.lastInsertRowid))
})

router.put('/:id', (req: Request, res: Response) => {
  const db = getDb()
  const { status, regular_hours, overtime_hours, manager_notes, guard_notes } = req.body
  const ts = db.prepare('SELECT * FROM timesheets WHERE id = ?').get(req.params.id) as any
  if (!ts) return res.status(404).json({ error: 'Not found' })

  const regHrs = regular_hours ?? ts.regular_hours
  const otHrs = overtime_hours ?? ts.overtime_hours
  const total = regHrs + otHrs
  const submittedAt = status === 'submitted' ? new Date().toISOString() : ts.submitted_at
  const approvedAt = status === 'approved' ? new Date().toISOString() : ts.approved_at

  db.prepare(`
    UPDATE timesheets SET status=?, regular_hours=?, overtime_hours=?, total_hours=?,
      manager_notes=?, guard_notes=?, submitted_at=?, approved_at=?
    WHERE id=?
  `).run(status || ts.status, regHrs, otHrs, total,
    manager_notes ?? ts.manager_notes, guard_notes ?? ts.guard_notes,
    submittedAt, approvedAt, req.params.id)
  res.json(db.prepare('SELECT * FROM timesheets WHERE id = ?').get(req.params.id))
})

// Bulk approve
router.post('/bulk-approve', (req: Request, res: Response) => {
  const db = getDb()
  const { ids } = req.body
  const now = new Date().toISOString()
  const stmt = db.prepare(`UPDATE timesheets SET status='approved', approved_at=? WHERE id=?`)
  ids.forEach((id: number) => stmt.run(now, id))
  res.json({ success: true, count: ids.length })
})

export default router
