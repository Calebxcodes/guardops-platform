import { Router, Request, Response } from 'express'
import { getDb } from '../db/schema'

const router = Router()

router.get('/', (req: Request, res: Response) => {
  const db = getDb()
  const { start, end, site_id, guard_id } = req.query
  let query = `
    SELECT sh.*, s.name as site_name, c.name as client_name,
      g.first_name, g.last_name
    FROM shifts sh
    LEFT JOIN sites s ON s.id = sh.site_id
    LEFT JOIN clients c ON c.id = s.client_id
    LEFT JOIN guards g ON g.id = sh.guard_id
    WHERE 1=1
  `
  const params: any[] = []
  if (start) { query += ' AND sh.start_time >= ?'; params.push(start) }
  if (end) { query += ' AND sh.start_time <= ?'; params.push(end) }
  if (site_id) { query += ' AND sh.site_id = ?'; params.push(site_id) }
  if (guard_id) { query += ' AND sh.guard_id = ?'; params.push(guard_id) }
  query += ' ORDER BY sh.start_time ASC'
  res.json(db.prepare(query).all(...params))
})

router.post('/', (req: Request, res: Response) => {
  const db = getDb()
  const { site_id, guard_id, start_time, end_time, hourly_rate, break_minutes, notes } = req.body

  // Conflict detection
  if (guard_id) {
    const conflict = db.prepare(`
      SELECT id FROM shifts
      WHERE guard_id = ? AND status NOT IN ('cancelled','completed')
      AND NOT (end_time <= ? OR start_time >= ?)
    `).get(guard_id, start_time, end_time)
    if (conflict) return res.status(409).json({ error: 'Guard is already scheduled for an overlapping shift' })
  }

  // Get site hourly rate if not provided
  let rate = hourly_rate
  if (!rate) {
    const site = db.prepare('SELECT hourly_rate FROM sites WHERE id = ?').get(site_id) as any
    rate = site?.hourly_rate || 0
  }

  const status = guard_id ? 'assigned' : 'unassigned'
  const result = db.prepare(`
    INSERT INTO shifts (site_id, guard_id, start_time, end_time, status, hourly_rate, break_minutes, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(site_id, guard_id || null, start_time, end_time, status, rate, break_minutes || 30, notes)

  const shift = db.prepare(`
    SELECT sh.*, s.name as site_name, g.first_name, g.last_name
    FROM shifts sh LEFT JOIN sites s ON s.id = sh.site_id LEFT JOIN guards g ON g.id = sh.guard_id
    WHERE sh.id = ?
  `).get(result.lastInsertRowid)
  res.status(201).json(shift)
})

router.put('/:id', (req: Request, res: Response) => {
  const db = getDb()
  const { site_id, guard_id, start_time, end_time, status, hourly_rate, break_minutes, notes } = req.body

  // Conflict detection on reassignment
  if (guard_id) {
    const conflict = db.prepare(`
      SELECT id FROM shifts
      WHERE guard_id = ? AND id != ? AND status NOT IN ('cancelled','completed')
      AND NOT (end_time <= ? OR start_time >= ?)
    `).get(guard_id, req.params.id, start_time, end_time)
    if (conflict) return res.status(409).json({ error: 'Guard is already scheduled for an overlapping shift' })
  }

  const newStatus = status || (guard_id ? 'assigned' : 'unassigned')
  db.prepare(`
    UPDATE shifts SET site_id=?, guard_id=?, start_time=?, end_time=?, status=?, hourly_rate=?, break_minutes=?, notes=?
    WHERE id=?
  `).run(site_id, guard_id || null, start_time, end_time, newStatus, hourly_rate, break_minutes || 30, notes, req.params.id)

  const shift = db.prepare(`
    SELECT sh.*, s.name as site_name, g.first_name, g.last_name
    FROM shifts sh LEFT JOIN sites s ON s.id = sh.site_id LEFT JOIN guards g ON g.id = sh.guard_id
    WHERE sh.id = ?
  `).get(req.params.id)
  res.json(shift)
})

router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb()
  db.prepare("UPDATE shifts SET status = 'cancelled' WHERE id = ?").run(req.params.id)
  res.json({ success: true })
})

export default router
