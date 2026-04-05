import { Router, Response } from 'express'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { query } from '../db/schema'

const router = Router()
router.use(requireAuth)

router.get('/', async (req: AuthRequest, res: Response) => {
  const { rows } = await query(`
    SELECT t.*, s.name as site_name
    FROM timesheets t
    LEFT JOIN shifts sh ON sh.id = t.shift_id
    LEFT JOIN sites s ON s.id = sh.site_id
    WHERE t.guard_id = $1
    ORDER BY t.period_start DESC
  `, [req.guardId])
  res.json(rows)
})

router.get('/:id', async (req: AuthRequest, res: Response) => {
  const { rows } = await query('SELECT * FROM timesheets WHERE id = $1 AND guard_id = $2', [req.params.id, req.guardId])
  if (!rows[0]) return res.status(404).json({ error: 'Not found' })
  res.json(rows[0])
})

router.put('/:id/submit', async (req: AuthRequest, res: Response) => {
  const { guard_notes, regular_hours, overtime_hours } = req.body
  const { rows: existing } = await query('SELECT * FROM timesheets WHERE id = $1 AND guard_id = $2', [req.params.id, req.guardId])
  const ts = existing[0]
  if (!ts) return res.status(404).json({ error: 'Not found' })
  if (ts.status === 'approved') return res.status(400).json({ error: 'Already approved' })

  const regHrs = regular_hours ?? ts.regular_hours
  const otHrs  = overtime_hours ?? ts.overtime_hours
  await query(`
    UPDATE timesheets SET status='submitted', regular_hours=$1, overtime_hours=$2, total_hours=$3,
      guard_notes=$4, submitted_at=NOW() WHERE id=$5
  `, [regHrs, otHrs, regHrs + otHrs, guard_notes ?? ts.guard_notes, req.params.id])
  const { rows } = await query('SELECT * FROM timesheets WHERE id = $1', [req.params.id])
  res.json(rows[0])
})

router.post('/manual', async (req: AuthRequest, res: Response) => {
  const { shift_id, period_start, period_end, regular_hours, overtime_hours, guard_notes } = req.body
  const total = (regular_hours || 0) + (overtime_hours || 0)
  const { rows } = await query(`
    INSERT INTO timesheets (guard_id, shift_id, period_start, period_end, regular_hours, overtime_hours, total_hours, status, source, guard_notes)
    VALUES ($1,$2,$3,$4,$5,$6,$7,'draft','manual',$8) RETURNING *
  `, [req.guardId, shift_id || null, period_start, period_end, regular_hours || 0, overtime_hours || 0, total, guard_notes])
  res.status(201).json(rows[0])
})

export default router
