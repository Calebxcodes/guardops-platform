import { Router, Request, Response } from 'express'
import { query } from '../db/schema'
import { notifyGuard } from '../services/push'
import { format } from 'date-fns'

const router = Router()

router.get('/', async (req: Request, res: Response) => {
  const { start, end, site_id, guard_id } = req.query
  let sql = `
    SELECT sh.*, s.name as site_name, c.name as client_name,
      g.first_name, g.last_name
    FROM shifts sh
    LEFT JOIN sites s ON s.id = sh.site_id
    LEFT JOIN clients c ON c.id = s.client_id
    LEFT JOIN guards g ON g.id = sh.guard_id
    WHERE 1=1
  `
  const params: any[] = []
  let idx = 1
  if (start) { sql += ` AND sh.start_time >= $${idx++}`; params.push(start) }
  if (end)   { sql += ` AND sh.start_time <= $${idx++}`; params.push(end) }
  if (site_id) { sql += ` AND sh.site_id = $${idx++}`; params.push(site_id) }
  if (guard_id) { sql += ` AND sh.guard_id = $${idx++}`; params.push(guard_id) }
  sql += ' ORDER BY sh.start_time ASC'
  const { rows } = await query(sql, params)
  res.json(rows)
})

router.post('/', async (req: Request, res: Response) => {
  const { site_id, guard_id, start_time, end_time, hourly_rate, break_minutes, notes } = req.body

  // Validate required fields and time logic
  if (!site_id) return res.status(400).json({ error: 'site_id is required' })
  if (!start_time || !end_time) return res.status(400).json({ error: 'start_time and end_time are required' })
  const start = new Date(start_time), end = new Date(end_time)
  if (isNaN(start.getTime()) || isNaN(end.getTime()))
    return res.status(400).json({ error: 'Invalid datetime values' })
  if (start >= end)
    return res.status(400).json({ error: 'start_time must be before end_time' })
  // Prevent shifts more than 7 days in the past (allow historical data entry up to 1 week)
  if (start < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
    return res.status(400).json({ error: 'Cannot create shifts more than 7 days in the past' })
  // Sanity-check: max 24h shift duration
  if ((end.getTime() - start.getTime()) > 24 * 60 * 60 * 1000)
    return res.status(400).json({ error: 'Shift duration cannot exceed 24 hours' })

  // Conflict detection
  if (guard_id) {
    const { rows } = await query(`
      SELECT id FROM shifts
      WHERE guard_id = $1 AND status NOT IN ('cancelled','completed')
      AND NOT (end_time <= $2 OR start_time >= $3)
    `, [guard_id, start_time, end_time])
    if (rows[0]) return res.status(409).json({ error: 'Guard is already scheduled for an overlapping shift' })
  }

  // Get site hourly rate if not provided
  let rate = hourly_rate
  if (!rate) {
    const { rows: siteRows } = await query('SELECT hourly_rate FROM sites WHERE id = $1', [site_id])
    rate = siteRows[0]?.hourly_rate || 0
  }

  const status = guard_id ? 'assigned' : 'unassigned'
  const { rows } = await query(`
    INSERT INTO shifts (site_id, guard_id, start_time, end_time, status, hourly_rate, break_minutes, notes)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id
  `, [site_id, guard_id || null, start_time, end_time, status, rate, break_minutes || 30, notes])

  const { rows: shift } = await query(`
    SELECT sh.*, s.name as site_name, g.first_name, g.last_name
    FROM shifts sh LEFT JOIN sites s ON s.id = sh.site_id LEFT JOIN guards g ON g.id = sh.guard_id
    WHERE sh.id = $1
  `, [rows[0].id])
  const s = shift[0]
  if (s.guard_id) {
    const when = format(new Date(s.start_time), 'EEE d MMM, HH:mm')
    notifyGuard(s.guard_id, {
      title: 'Shift Assigned',
      body: `You have been assigned to ${s.site_name} on ${when}`,
      url: '/schedule',
      tag: `shift-assigned-${s.id}`,
      urgency: 'high',
    }, { email: true }).catch(() => {})
  }
  res.status(201).json(s)
})

router.put('/:id', async (req: Request, res: Response) => {
  const { site_id, guard_id, start_time, end_time, status, hourly_rate, break_minutes, notes } = req.body

  if (start_time && end_time) {
    const start = new Date(start_time), end = new Date(end_time)
    if (isNaN(start.getTime()) || isNaN(end.getTime()))
      return res.status(400).json({ error: 'Invalid datetime values' })
    if (start >= end)
      return res.status(400).json({ error: 'start_time must be before end_time' })
    if ((end.getTime() - start.getTime()) > 24 * 60 * 60 * 1000)
      return res.status(400).json({ error: 'Shift duration cannot exceed 24 hours' })
  }

  // Conflict detection on reassignment
  if (guard_id) {
    const { rows } = await query(`
      SELECT id FROM shifts
      WHERE guard_id = $1 AND id != $2 AND status NOT IN ('cancelled','completed')
      AND NOT (end_time <= $3 OR start_time >= $4)
    `, [guard_id, req.params.id, start_time, end_time])
    if (rows[0]) return res.status(409).json({ error: 'Guard is already scheduled for an overlapping shift' })
  }

  const newStatus = status || (guard_id ? 'assigned' : 'unassigned')
  await query(`
    UPDATE shifts SET site_id=$1, guard_id=$2, start_time=$3, end_time=$4, status=$5, hourly_rate=$6, break_minutes=$7, notes=$8
    WHERE id=$9
  `, [site_id, guard_id || null, start_time, end_time, newStatus, hourly_rate, break_minutes || 30, notes, req.params.id])

  const { rows } = await query(`
    SELECT sh.*, s.name as site_name, g.first_name, g.last_name
    FROM shifts sh LEFT JOIN sites s ON s.id = sh.site_id LEFT JOIN guards g ON g.id = sh.guard_id
    WHERE sh.id = $1
  `, [req.params.id])
  const updated = rows[0]
  if (updated?.guard_id) {
    const when = format(new Date(updated.start_time), 'EEE d MMM, HH:mm')
    const isCancelled = updated.status === 'cancelled'
    notifyGuard(updated.guard_id, {
      title: isCancelled ? 'Shift Cancelled' : 'Shift Updated',
      body: isCancelled
        ? `Your shift at ${updated.site_name} on ${when} has been cancelled`
        : `Your shift at ${updated.site_name} on ${when} has been updated`,
      url: '/schedule',
      tag: `shift-update-${updated.id}`,
      urgency: isCancelled ? 'high' : 'normal',
    }, { email: isCancelled }).catch(() => {})
  }
  res.json(updated)
})

router.delete('/:id', async (req: Request, res: Response) => {
  // Fetch before cancelling so we can notify the guard
  const { rows: before } = await query(`
    SELECT sh.guard_id, sh.start_time, s.name as site_name
    FROM shifts sh LEFT JOIN sites s ON s.id = sh.site_id WHERE sh.id = $1
  `, [req.params.id])
  await query("UPDATE shifts SET status = 'cancelled' WHERE id = $1", [req.params.id])
  if (before[0]?.guard_id) {
    const when = format(new Date(before[0].start_time), 'EEE d MMM, HH:mm')
    notifyGuard(before[0].guard_id, {
      title: 'Shift Cancelled',
      body: `Your shift at ${before[0].site_name} on ${when} has been cancelled`,
      url: '/schedule',
      tag: `shift-cancel-${req.params.id}`,
      urgency: 'high',
    }, { email: true }).catch(() => {})
  }
  res.json({ success: true })
})

export default router
