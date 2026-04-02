import { Router, Response } from 'express'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { getDb } from '../db/schema'

const router = Router()
router.use(requireAuth)

router.get('/', (req: AuthRequest, res: Response) => {
  const db = getDb()
  const guard = db.prepare('SELECT * FROM guards WHERE id = ?').get(req.guardId) as any
  if (!guard) return res.status(404).json({ error: 'Not found' })
  res.json({
    ...guard,
    certifications: JSON.parse(guard.certifications || '[]'),
    skills: JSON.parse(guard.skills || '[]'),
    bank_account: guard.bank_account ? `****${guard.bank_account.slice(-4)}` : null,
  })
})

router.put('/', (req: AuthRequest, res: Response) => {
  const db = getDb()
  const { first_name, last_name, phone, address } = req.body
  db.prepare('UPDATE guards SET first_name=?, last_name=?, phone=?, address=? WHERE id=?')
    .run(first_name, last_name, phone, address, req.guardId)
  res.json(db.prepare('SELECT * FROM guards WHERE id = ?').get(req.guardId))
})

// Pay history (last 6 payroll records)
router.get('/pay-history', (req: AuthRequest, res: Response) => {
  const db = getDb()
  const records = db.prepare(`
    SELECT * FROM payroll_records WHERE guard_id = ? ORDER BY period_start DESC LIMIT 6
  `).all(req.guardId)
  res.json(records)
})

// Guard incidents
router.get('/incidents', (req: AuthRequest, res: Response) => {
  const db = getDb()
  const incidents = db.prepare(`
    SELECT i.*, s.name as site_name FROM incidents i
    LEFT JOIN sites s ON s.id = i.site_id
    WHERE i.guard_id = ? ORDER BY i.created_at DESC
  `).all(req.guardId)
  res.json(incidents)
})

router.post('/incidents', (req: AuthRequest, res: Response) => {
  const db = getDb()
  const { site_id, shift_id, type, severity, description } = req.body
  const result = db.prepare(`
    INSERT INTO incidents (site_id, guard_id, shift_id, type, severity, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(site_id, req.guardId, shift_id || null, type, severity || 'minor', description)
  res.status(201).json(db.prepare('SELECT * FROM incidents WHERE id = ?').get(result.lastInsertRowid))
})

export default router
