import { Router, Request, Response } from 'express'
import { query } from '../db/schema'

const router = Router()

router.get('/', async (req: Request, res: Response) => {
  const { status, guard_id } = req.query
  let sql = `
    SELECT t.*, g.first_name, g.last_name
    FROM timesheets t
    LEFT JOIN guards g ON g.id = t.guard_id
    WHERE 1=1
  `
  const params: any[] = []
  let idx = 1
  if (status) { sql += ` AND t.status = $${idx++}`; params.push(status) }
  if (guard_id) { sql += ` AND t.guard_id = $${idx++}`; params.push(guard_id) }
  sql += ' ORDER BY t.period_start DESC'
  const { rows } = await query(sql, params)
  res.json(rows)
})

router.get('/:id', async (req: Request, res: Response) => {
  const { rows } = await query(`
    SELECT t.*, g.first_name, g.last_name, g.hourly_rate
    FROM timesheets t LEFT JOIN guards g ON g.id = t.guard_id
    WHERE t.id = $1
  `, [req.params.id])
  if (!rows[0]) return res.status(404).json({ error: 'Timesheet not found' })
  res.json(rows[0])
})

router.post('/', async (req: Request, res: Response) => {
  const { guard_id, shift_id, period_start, period_end, regular_hours, overtime_hours, source, guard_notes } = req.body
  const total = (regular_hours || 0) + (overtime_hours || 0)
  const { rows } = await query(`
    INSERT INTO timesheets (guard_id, shift_id, period_start, period_end, regular_hours, overtime_hours, total_hours, source, guard_notes)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
  `, [guard_id, shift_id || null, period_start, period_end, regular_hours || 0, overtime_hours || 0, total, source || 'manual', guard_notes])
  res.status(201).json(rows[0])
})

router.put('/:id', async (req: Request, res: Response) => {
  const { status, regular_hours, overtime_hours, manager_notes, guard_notes } = req.body
  const { rows: existing } = await query('SELECT * FROM timesheets WHERE id = $1', [req.params.id])
  const ts = existing[0]
  if (!ts) return res.status(404).json({ error: 'Not found' })

  const regHrs = regular_hours ?? ts.regular_hours
  const otHrs = overtime_hours ?? ts.overtime_hours
  const total = regHrs + otHrs
  const submittedAt = status === 'submitted' ? new Date().toISOString() : ts.submitted_at
  const approvedAt  = status === 'approved'  ? new Date().toISOString() : ts.approved_at

  await query(`
    UPDATE timesheets SET status=$1, regular_hours=$2, overtime_hours=$3, total_hours=$4,
      manager_notes=$5, guard_notes=$6, submitted_at=$7, approved_at=$8
    WHERE id=$9
  `, [status || ts.status, regHrs, otHrs, total,
      manager_notes ?? ts.manager_notes, guard_notes ?? ts.guard_notes,
      submittedAt, approvedAt, req.params.id])
  const { rows } = await query('SELECT * FROM timesheets WHERE id = $1', [req.params.id])
  res.json(rows[0])
})

router.post('/bulk-approve', async (req: Request, res: Response) => {
  const { ids } = req.body
  await query(
    `UPDATE timesheets SET status='approved', approved_at=NOW() WHERE id = ANY($1)`,
    [ids]
  )
  res.json({ success: true, count: ids.length })
})

export default router
