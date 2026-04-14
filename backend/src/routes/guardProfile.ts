import { Router, Response } from 'express'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { query, auditLog } from '../db/schema'

const router = Router()
router.use(requireAuth)

router.get('/', async (req: AuthRequest, res: Response) => {
  const { rows } = await query('SELECT * FROM guards WHERE id = $1', [req.guardId])
  const guard = rows[0]
  if (!guard) return res.status(404).json({ error: 'Not found' })
  res.json({
    ...guard,
    certifications: JSON.parse(guard.certifications || '[]'),
    skills: JSON.parse(guard.skills || '[]'),
    bank_account: guard.bank_account ? `****${guard.bank_account.slice(-4)}` : null,
  })
})

router.put('/', async (req: AuthRequest, res: Response) => {
  const { first_name, last_name, phone, address } = req.body
  await query('UPDATE guards SET first_name=$1, last_name=$2, phone=$3, address=$4 WHERE id=$5',
    [first_name, last_name, phone, address, req.guardId])
  const { rows } = await query('SELECT * FROM guards WHERE id = $1', [req.guardId])
  res.json(rows[0])
})

router.put('/certifications', async (req: AuthRequest, res: Response) => {
  const { certifications } = req.body
  if (!Array.isArray(certifications)) return res.status(400).json({ error: 'certifications must be an array' })
  await query('UPDATE guards SET certifications = $1 WHERE id = $2', [JSON.stringify(certifications), req.guardId])
  res.json({ success: true })
})

router.get('/pay-history', async (req: AuthRequest, res: Response) => {
  const { rows } = await query(`
    SELECT * FROM payroll_records WHERE guard_id = $1 ORDER BY period_start DESC LIMIT 6
  `, [req.guardId])
  res.json(rows)
})

router.get('/incidents', async (req: AuthRequest, res: Response) => {
  const { rows } = await query(`
    SELECT i.*, s.name as site_name FROM incidents i
    LEFT JOIN sites s ON s.id = i.site_id
    WHERE i.guard_id = $1 ORDER BY i.created_at DESC
  `, [req.guardId])
  res.json(rows)
})

router.post('/incidents', async (req: AuthRequest, res: Response) => {
  const { site_id, shift_id, type, severity, description } = req.body
  const { rows } = await query(`
    INSERT INTO incidents (site_id, guard_id, shift_id, type, severity, description)
    VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
  `, [site_id, req.guardId, shift_id || null, type, severity || 'minor', description])
  res.status(201).json(rows[0])
})

// ── Face descriptor (biometric enrolment) ─────────────────────────────────
router.get('/face-descriptor', async (req: AuthRequest, res: Response) => {
  const { rows } = await query('SELECT face_descriptor FROM guards WHERE id = $1', [req.guardId])
  const raw = rows[0]?.face_descriptor
  res.json({ descriptor: raw ? JSON.parse(raw) : null })
})

router.put('/face-descriptor', async (req: AuthRequest, res: Response) => {
  const { descriptor } = req.body
  if (!Array.isArray(descriptor) || descriptor.length !== 128)
    return res.status(400).json({ error: 'Invalid face descriptor: must be array of 128 numbers' })
  // Validate every element is a finite number (face-api.js produces values roughly in [-1, 1])
  if (!descriptor.every((d: unknown) => typeof d === 'number' && isFinite(d)))
    return res.status(400).json({ error: 'Invalid face descriptor: all values must be finite numbers' })
  await query('UPDATE guards SET face_descriptor = $1 WHERE id = $2', [JSON.stringify(descriptor), req.guardId])
  auditLog({ user_type: 'guard', user_id: req.guardId, action: 'face_enrol', ip_address: (req as any).ip })
  res.json({ success: true })
})

router.delete('/face-descriptor', async (req: AuthRequest, res: Response) => {
  await query('UPDATE guards SET face_descriptor = NULL WHERE id = $1', [req.guardId])
  auditLog({ user_type: 'guard', user_id: req.guardId, action: 'face_removed', ip_address: (req as any).ip })
  res.json({ success: true })
})

export default router
