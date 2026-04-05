import { Router, Request, Response } from 'express'
import { query } from '../db/schema'

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
  res.status(201).json(shift[0])
})

router.put('/:id', async (req: Request, res: Response) => {
  const { site_id, guard_id, start_time, end_time, status, hourly_rate, break_minutes, notes } = req.body

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
  res.json(rows[0])
})

router.delete('/:id', async (req: Request, res: Response) => {
  await query("UPDATE shifts SET status = 'cancelled' WHERE id = $1", [req.params.id])
  res.json({ success: true })
})

export default router
