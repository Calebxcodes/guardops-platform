import { Router, Request, Response } from 'express'
import { query } from '../db/pool'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { requireAdmin } from './adminAuth'
import { sendTimeOffRequestToAdmin, sendTimeOffDecisionToGuard } from '../services/email'

const router = Router()

const adminId = (req: Request): number => (req as any).adminId as number

// ── Guard-facing routes ───────────────────────────────────────────────────────

// GET /api/guard/time-off/types — available leave types for this tenant
router.get('/types', requireAuth, async (req: AuthRequest, res: Response) => {
  if (!req.guard?.tenantId) return res.status(403).json({ error: 'No tenant context. Please re-login.' })
  try {
    const { rows } = await query(
      `SELECT id, name, paid, max_days_per_year, requires_approval
       FROM time_off_types WHERE active = 1 ORDER BY name`,
      []
    )
    res.json(rows)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/guard/time-off/requests — submit a time-off request
router.post('/requests', requireAuth, async (req: AuthRequest, res: Response) => {
  if (!req.guard?.tenantId) return res.status(403).json({ error: 'No tenant context. Please re-login.' })

  const { type_id, start_date, end_date, reason } = req.body
  if (!type_id || !start_date || !end_date)
    return res.status(400).json({ error: 'type_id, start_date, and end_date are required' })

  const start = new Date(start_date)
  const end = new Date(end_date)
  if (isNaN(start.getTime()) || isNaN(end.getTime()))
    return res.status(400).json({ error: 'Invalid date format' })
  if (end < start)
    return res.status(400).json({ error: 'end_date must be on or after start_date' })

  const diffMs = end.getTime() - start.getTime()
  const days = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1

  try {
    const { rows } = await query(
      `INSERT INTO time_off_requests (guard_id, type_id, start_date, end_date, days, reason)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.guardId, type_id, start_date, end_date, days, reason || null]
    )
    const request = rows[0]

    // Notify admin via email (best-effort)
    try {
      const { rows: guardRows } = await query(
        'SELECT first_name, last_name, email FROM guards WHERE id = $1',
        [req.guardId]
      )
      const { rows: typeRows } = await query(
        'SELECT name FROM time_off_types WHERE id = $1',
        [type_id]
      )
      const { rows: adminRows } = await query(
        "SELECT email, name FROM admin_users WHERE role = 'owner' LIMIT 1",
        []
      )
      if (guardRows[0] && adminRows[0]) {
        await sendTimeOffRequestToAdmin(
          adminRows[0].email,
          guardRows[0].first_name + ' ' + guardRows[0].last_name,
          typeRows[0]?.name ?? 'Leave',
          start_date,
          end_date,
          days
        )
      }
    } catch { /* email is non-critical */ }

    res.status(201).json(request)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/guard/time-off/requests — guard's own requests
router.get('/requests', requireAuth, async (req: AuthRequest, res: Response) => {
  if (!req.guard?.tenantId) return res.status(403).json({ error: 'No tenant context. Please re-login.' })
  try {
    const { rows } = await query(
      `SELECT r.*, t.name as type_name, t.paid
       FROM time_off_requests r
       LEFT JOIN time_off_types t ON t.id = r.type_id
       WHERE r.guard_id = $1
       ORDER BY r.created_at DESC`,
      [req.guardId]
    )
    res.json(rows)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ── Admin-facing routes ───────────────────────────────────────────────────────

// GET /api/time-off/requests — all requests (admin)
router.get('/admin/requests', requireAdmin, async (req: Request, res: Response) => {
  const { status, guard_id } = req.query
  try {
    const conditions: string[] = []
    const params: any[] = []
    if (status) { conditions.push(`r.status = $${params.length + 1}`); params.push(status) }
    if (guard_id) { conditions.push(`r.guard_id = $${params.length + 1}`); params.push(Number(guard_id)) }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''

    const { rows } = await query(
      `SELECT r.*,
         g.first_name, g.last_name, g.email as guard_email,
         t.name as type_name, t.paid,
         a.name as reviewer_name
       FROM time_off_requests r
       LEFT JOIN guards g ON g.id = r.guard_id
       LEFT JOIN time_off_types t ON t.id = r.type_id
       LEFT JOIN admin_users a ON a.id = r.reviewed_by
       ${where}
       ORDER BY
         CASE r.status WHEN 'pending' THEN 0 ELSE 1 END,
         r.created_at DESC`,
      params
    )
    res.json(rows)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/time-off/requests/:id/approve
router.put('/admin/requests/:id/approve', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { rows } = await query(
      `UPDATE time_off_requests
       SET status = 'approved', reviewed_by = $1, review_note = $2, reviewed_at = NOW()
       WHERE id = $3 AND status = 'pending'
       RETURNING *`,
      [adminId(req), req.body.note || null, req.params.id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Request not found or already reviewed' })

    try { await notifyGuardOfDecision(rows[0], 'approved') } catch { /* non-critical */ }
    res.json(rows[0])
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/time-off/requests/:id/reject
router.put('/admin/requests/:id/reject', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { rows } = await query(
      `UPDATE time_off_requests
       SET status = 'rejected', reviewed_by = $1, review_note = $2, reviewed_at = NOW()
       WHERE id = $3 AND status = 'pending'
       RETURNING *`,
      [adminId(req), req.body.note || null, req.params.id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Request not found or already reviewed' })

    try { await notifyGuardOfDecision(rows[0], 'rejected') } catch { /* non-critical */ }
    res.json(rows[0])
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/time-off/types (admin — manage types)
router.get('/admin/types', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { rows } = await query(
      'SELECT * FROM time_off_types ORDER BY name',
      []
    )
    res.json(rows)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// Pending count for badge
router.get('/admin/pending-count', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT COUNT(*)::int as count FROM time_off_requests WHERE status = 'pending'`,
      []
    )
    res.json({ count: rows[0]?.count ?? 0 })
  } catch {
    res.json({ count: 0 })
  }
})

async function notifyGuardOfDecision(request: any, decision: 'approved' | 'rejected') {
  const { rows: guardRows } = await query(
    'SELECT first_name, last_name, email FROM guards WHERE id = $1',
    [request.guard_id]
  )
  const { rows: typeRows } = await query(
    'SELECT name FROM time_off_types WHERE id = $1',
    [request.type_id]
  )
  if (guardRows[0]?.email) {
    await sendTimeOffDecisionToGuard(
      guardRows[0].email,
      guardRows[0].first_name,
      typeRows[0]?.name ?? 'Leave',
      request.start_date,
      request.end_date,
      decision,
      request.review_note
    )
  }
}

export default router
