import { Router, Request, Response } from 'express'
import { getDb } from '../db/schema'

const router = Router()

router.get('/', (req: Request, res: Response) => {
  const db = getDb()
  const guards = db.prepare(`
    SELECT g.*,
      (SELECT COUNT(*) FROM shifts WHERE guard_id = g.id AND status = 'active') as active_shifts
    FROM guards g
    WHERE g.active = 1
    ORDER BY g.last_name, g.first_name
  `).all()
  res.json(guards.map((g: any) => ({
    ...g,
    certifications: JSON.parse(g.certifications || '[]'),
    skills: JSON.parse(g.skills || '[]'),
  })))
})

router.get('/:id', (req: Request, res: Response) => {
  const db = getDb()
  const guard = db.prepare('SELECT * FROM guards WHERE id = ?').get(req.params.id) as any
  if (!guard) return res.status(404).json({ error: 'Guard not found' })
  res.json({
    ...guard,
    certifications: JSON.parse(guard.certifications || '[]'),
    skills: JSON.parse(guard.skills || '[]'),
  })
})

router.post('/', (req: Request, res: Response) => {
  const db = getDb()
  const { first_name, last_name, email, phone, address, date_of_birth, employment_type, hourly_rate, certifications, skills, bank_account, bank_routing, notes } = req.body
  const result = db.prepare(`
    INSERT INTO guards (first_name, last_name, email, phone, address, date_of_birth, employment_type, hourly_rate, certifications, skills, bank_account, bank_routing, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(first_name, last_name, email, phone, address, date_of_birth, employment_type || 'full-time', hourly_rate || 15,
    JSON.stringify(certifications || []), JSON.stringify(skills || []), bank_account, bank_routing, notes)
  const guard = db.prepare('SELECT * FROM guards WHERE id = ?').get(result.lastInsertRowid) as any
  res.status(201).json({ ...guard, certifications: JSON.parse(guard.certifications), skills: JSON.parse(guard.skills) })
})

router.put('/:id', (req: Request, res: Response) => {
  const db = getDb()
  const { first_name, last_name, email, phone, address, date_of_birth, employment_type, status, hourly_rate, certifications, skills, bank_account, bank_routing, notes } = req.body
  db.prepare(`
    UPDATE guards SET first_name=?, last_name=?, email=?, phone=?, address=?, date_of_birth=?,
    employment_type=?, status=?, hourly_rate=?, certifications=?, skills=?, bank_account=?, bank_routing=?, notes=?
    WHERE id=?
  `).run(first_name, last_name, email, phone, address, date_of_birth, employment_type, status,
    hourly_rate, JSON.stringify(certifications || []), JSON.stringify(skills || []),
    bank_account, bank_routing, notes, req.params.id)
  const guard = db.prepare('SELECT * FROM guards WHERE id = ?').get(req.params.id) as any
  res.json({ ...guard, certifications: JSON.parse(guard.certifications), skills: JSON.parse(guard.skills) })
})

router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb()
  db.prepare('UPDATE guards SET active = 0 WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

export default router
