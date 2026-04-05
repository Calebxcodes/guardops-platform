import { Router, Request, Response } from 'express'
import { query } from '../db/schema'

const router = Router()

router.get('/', async (req: Request, res: Response) => {
  const { rows } = await query(`
    SELECT g.*,
      (SELECT COUNT(*) FROM shifts WHERE guard_id = g.id AND status = 'active')::int as active_shifts
    FROM guards g
    WHERE g.active = 1
    ORDER BY g.last_name, g.first_name
  `)
  res.json(rows.map((g: any) => ({
    ...g,
    certifications: JSON.parse(g.certifications || '[]'),
    skills: JSON.parse(g.skills || '[]'),
  })))
})

router.get('/:id', async (req: Request, res: Response) => {
  const { rows } = await query('SELECT * FROM guards WHERE id = $1', [req.params.id])
  const guard = rows[0]
  if (!guard) return res.status(404).json({ error: 'Guard not found' })
  res.json({
    ...guard,
    certifications: JSON.parse(guard.certifications || '[]'),
    skills: JSON.parse(guard.skills || '[]'),
  })
})

router.post('/', async (req: Request, res: Response) => {
  const { first_name, last_name, email, phone, address, date_of_birth, employment_type, hourly_rate, certifications, skills, bank_account, bank_routing, notes } = req.body
  const { rows } = await query(`
    INSERT INTO guards (first_name, last_name, email, phone, address, date_of_birth, employment_type, hourly_rate, certifications, skills, bank_account, bank_routing, notes)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *
  `, [first_name, last_name, email, phone, address, date_of_birth, employment_type || 'full-time', hourly_rate || 15,
      JSON.stringify(certifications || []), JSON.stringify(skills || []), bank_account, bank_routing, notes])
  const guard = rows[0]
  res.status(201).json({ ...guard, certifications: JSON.parse(guard.certifications), skills: JSON.parse(guard.skills) })
})

router.put('/:id', async (req: Request, res: Response) => {
  const { first_name, last_name, email, phone, address, date_of_birth, employment_type, status, hourly_rate, certifications, skills, bank_account, bank_routing, notes } = req.body
  await query(`
    UPDATE guards SET first_name=$1, last_name=$2, email=$3, phone=$4, address=$5, date_of_birth=$6,
    employment_type=$7, status=$8, hourly_rate=$9, certifications=$10, skills=$11, bank_account=$12, bank_routing=$13, notes=$14
    WHERE id=$15
  `, [first_name, last_name, email, phone, address, date_of_birth, employment_type, status,
      hourly_rate, JSON.stringify(certifications || []), JSON.stringify(skills || []),
      bank_account, bank_routing, notes, req.params.id])
  const { rows } = await query('SELECT * FROM guards WHERE id = $1', [req.params.id])
  const guard = rows[0]
  res.json({ ...guard, certifications: JSON.parse(guard.certifications), skills: JSON.parse(guard.skills) })
})

router.delete('/:id', async (req: Request, res: Response) => {
  await query('UPDATE guards SET active = 0 WHERE id = $1', [req.params.id])
  res.json({ success: true })
})

export default router
