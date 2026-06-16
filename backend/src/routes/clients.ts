import { Router, Request, Response } from 'express'
import { query } from '../db/schema'

const router = Router()

router.get('/', async (req: Request, res: Response) => {
  const { rows } = await query(`
    SELECT c.*, COUNT(s.id)::int as site_count
    FROM clients c
    LEFT JOIN sites s ON s.client_id = c.id AND s.active = 1
    WHERE c.active = 1
    GROUP BY c.id
    ORDER BY c.name
  `)
  res.json(rows)
})

router.get('/:id', async (req: Request, res: Response) => {
  const { rows } = await query('SELECT * FROM clients WHERE id = $1', [req.params.id])
  const client = rows[0]
  if (!client) return res.status(404).json({ error: 'Client not found' })
  const { rows: sites } = await query('SELECT * FROM sites WHERE client_id = $1 AND active = 1', [req.params.id])
  res.json({ ...client, sites })
})

router.post('/', async (req: Request, res: Response) => {
  const { name, contact_name, contact_email, contact_phone, address, notes, hourly_rate, guard_hourly_rate } = req.body
  const { rows } = await query(`
    INSERT INTO clients (name, contact_name, contact_email, contact_phone, address, notes, hourly_rate, guard_hourly_rate)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
  `, [name, contact_name, contact_email, contact_phone, address, notes, hourly_rate || 0, guard_hourly_rate || 0])
  res.status(201).json(rows[0])
})

router.put('/:id', async (req: Request, res: Response) => {
  const { name, contact_name, contact_email, contact_phone, address, notes, hourly_rate, guard_hourly_rate } = req.body
  await query(`
    UPDATE clients SET name=$1, contact_name=$2, contact_email=$3, contact_phone=$4, address=$5, notes=$6,
      hourly_rate=$7, guard_hourly_rate=$8
    WHERE id=$9
  `, [name, contact_name, contact_email, contact_phone, address, notes, hourly_rate || 0, guard_hourly_rate || 0, req.params.id])
  const { rows } = await query('SELECT * FROM clients WHERE id = $1', [req.params.id])
  res.json(rows[0])
})

router.delete('/:id', async (req: Request, res: Response) => {
  await query('UPDATE clients SET active = 0 WHERE id = $1', [req.params.id])
  res.json({ success: true })
})

export default router
