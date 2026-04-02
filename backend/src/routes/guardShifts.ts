import { Router, Response } from 'express'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { getDb } from '../db/schema'

const router = Router()
router.use(requireAuth)

// Today's shift
router.get('/today', (req: AuthRequest, res: Response) => {
  const db = getDb()
  const shift = db.prepare(`
    SELECT sh.*, s.name as site_name, s.address as site_address, s.lat, s.lng,
      s.requirements, s.post_orders, c.name as client_name, c.contact_phone as site_phone
    FROM shifts sh
    JOIN sites s ON s.id = sh.site_id
    JOIN clients c ON c.id = s.client_id
    WHERE sh.guard_id = ? AND date(sh.start_time) = date('now') AND sh.status != 'cancelled'
    ORDER BY sh.start_time ASC LIMIT 1
  `).get(req.guardId)
  res.json(shift || null)
})

// Upcoming shifts (next 30 days)
router.get('/upcoming', (req: AuthRequest, res: Response) => {
  const db = getDb()
  const shifts = db.prepare(`
    SELECT sh.*, s.name as site_name, s.address as site_address,
      c.name as client_name
    FROM shifts sh
    JOIN sites s ON s.id = sh.site_id
    JOIN clients c ON c.id = s.client_id
    WHERE sh.guard_id = ? AND sh.start_time >= date('now')
      AND sh.start_time <= date('now', '+30 days') AND sh.status != 'cancelled'
    ORDER BY sh.start_time ASC
  `).all(req.guardId)
  res.json(shifts)
})

// Shift history
router.get('/history', (req: AuthRequest, res: Response) => {
  const db = getDb()
  const shifts = db.prepare(`
    SELECT sh.*, s.name as site_name, c.name as client_name
    FROM shifts sh
    JOIN sites s ON s.id = sh.site_id
    JOIN clients c ON c.id = s.client_id
    WHERE sh.guard_id = ? AND sh.start_time < date('now')
    ORDER BY sh.start_time DESC LIMIT 30
  `).all(req.guardId)
  res.json(shifts)
})

// Clock in
router.post('/clock-in', (req: AuthRequest, res: Response) => {
  const db = getDb()
  const { shift_id, lat, lng, accuracy, photo_url, notes } = req.body

  // Find shift
  const shift = db.prepare('SELECT * FROM shifts WHERE id = ? AND guard_id = ?').get(shift_id, req.guardId) as any
  if (!shift) return res.status(404).json({ error: 'Shift not found' })
  if (shift.status === 'active') return res.status(409).json({ error: 'Already clocked in' })

  // Record clock-in event
  db.prepare(`
    INSERT INTO clock_events (guard_id, shift_id, type, lat, lng, accuracy, photo_url, notes)
    VALUES (?, ?, 'clock_in', ?, ?, ?, ?, ?)
  `).run(req.guardId, shift_id, lat, lng, accuracy, photo_url, notes)

  // Update shift and guard status
  db.prepare("UPDATE shifts SET status = 'active' WHERE id = ?").run(shift_id)
  db.prepare("UPDATE guards SET status = 'on-duty' WHERE id = ?").run(req.guardId)

  res.json({ success: true, clocked_in_at: new Date().toISOString() })
})

// Clock out
router.post('/clock-out', (req: AuthRequest, res: Response) => {
  const db = getDb()
  const { shift_id, lat, lng, accuracy, photo_url, notes } = req.body

  const shift = db.prepare('SELECT * FROM shifts WHERE id = ? AND guard_id = ?').get(shift_id, req.guardId) as any
  if (!shift) return res.status(404).json({ error: 'Shift not found' })

  // Get clock-in time
  const clockIn = db.prepare(`
    SELECT created_at FROM clock_events
    WHERE guard_id = ? AND shift_id = ? AND type = 'clock_in'
    ORDER BY created_at DESC LIMIT 1
  `).get(req.guardId, shift_id) as any

  db.prepare(`
    INSERT INTO clock_events (guard_id, shift_id, type, lat, lng, accuracy, photo_url, notes)
    VALUES (?, ?, 'clock_out', ?, ?, ?, ?, ?)
  `).run(req.guardId, shift_id, lat, lng, accuracy, photo_url, notes)

  db.prepare("UPDATE shifts SET status = 'completed' WHERE id = ?").run(shift_id)
  db.prepare("UPDATE guards SET status = 'off-duty' WHERE id = ?").run(req.guardId)

  // Calculate hours worked
  let hoursWorked = 0
  if (clockIn) {
    const ms = new Date().getTime() - new Date(clockIn.created_at).getTime()
    hoursWorked = Math.round((ms / 3600000) * 100) / 100
  }

  // Auto-create draft timesheet
  const existing = db.prepare('SELECT id FROM timesheets WHERE guard_id = ? AND shift_id = ?').get(req.guardId, shift_id)
  if (!existing) {
    const regularHours = Math.min(hoursWorked, 8)
    const overtimeHours = Math.max(0, hoursWorked - 8)
    const today = new Date().toISOString().split('T')[0]
    db.prepare(`
      INSERT INTO timesheets (guard_id, shift_id, period_start, period_end, regular_hours, overtime_hours, total_hours, status, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', 'mobile')
    `).run(req.guardId, shift_id, today, today, regularHours, overtimeHours, hoursWorked)
  }

  res.json({ success: true, hours_worked: hoursWorked, clocked_out_at: new Date().toISOString() })
})

// Get clock events for a shift
router.get('/:shiftId/clock-events', (req: AuthRequest, res: Response) => {
  const db = getDb()
  const events = db.prepare(`
    SELECT * FROM clock_events WHERE shift_id = ? AND guard_id = ? ORDER BY created_at ASC
  `).all(req.params.shiftId, req.guardId)
  res.json(events)
})

export default router
