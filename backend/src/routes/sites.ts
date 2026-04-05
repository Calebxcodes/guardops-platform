import { Router, Request, Response } from 'express'
import { query } from '../db/schema'

const router = Router()

router.get('/', async (req: Request, res: Response) => {
  const { rows } = await query(`
    SELECT s.*, c.name as client_name,
      COUNT(DISTINCT sh.id)::int as active_shifts,
      COUNT(DISTINCT sh2.guard_id)::int as assigned_guards
    FROM sites s
    LEFT JOIN clients c ON c.id = s.client_id
    LEFT JOIN shifts sh ON sh.site_id = s.id AND sh.status IN ('assigned','active') AND sh.start_time::date = CURRENT_DATE
    LEFT JOIN shifts sh2 ON sh2.site_id = s.id AND sh2.status IN ('assigned','active') AND sh2.start_time::date = CURRENT_DATE
    WHERE s.active = 1
    GROUP BY s.id, c.name
    ORDER BY s.name
  `)
  res.json(rows)
})

router.get('/:id', async (req: Request, res: Response) => {
  const { rows } = await query(`
    SELECT s.*, c.name as client_name, c.contact_name, c.contact_phone
    FROM sites s LEFT JOIN clients c ON c.id = s.client_id
    WHERE s.id = $1
  `, [req.params.id])
  const site = rows[0]
  if (!site) return res.status(404).json({ error: 'Site not found' })
  const { rows: shifts } = await query(`
    SELECT sh.*, g.first_name, g.last_name
    FROM shifts sh LEFT JOIN guards g ON g.id = sh.guard_id
    WHERE sh.site_id = $1 AND sh.start_time >= NOW() - INTERVAL '7 days'
    ORDER BY sh.start_time DESC LIMIT 20
  `, [req.params.id])
  res.json({ ...site, shifts })
})

router.post('/', async (req: Request, res: Response) => {
  const { client_id, name, address, lat, lng, requirements, post_orders, guards_required, hourly_rate } = req.body
  const { rows } = await query(`
    INSERT INTO sites (client_id, name, address, lat, lng, requirements, post_orders, guards_required, hourly_rate)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
  `, [client_id, name, address, lat, lng, requirements, post_orders, guards_required || 1, hourly_rate || 0])
  res.status(201).json(rows[0])
})

router.put('/:id', async (req: Request, res: Response) => {
  const { client_id, name, address, lat, lng, requirements, post_orders, guards_required, hourly_rate } = req.body
  await query(`
    UPDATE sites SET client_id=$1, name=$2, address=$3, lat=$4, lng=$5, requirements=$6, post_orders=$7, guards_required=$8, hourly_rate=$9
    WHERE id=$10
  `, [client_id, name, address, lat, lng, requirements, post_orders, guards_required, hourly_rate, req.params.id])
  const { rows } = await query('SELECT * FROM sites WHERE id = $1', [req.params.id])
  res.json(rows[0])
})

router.delete('/:id', async (req: Request, res: Response) => {
  await query('UPDATE sites SET active = 0 WHERE id = $1', [req.params.id])
  res.json({ success: true })
})

export default router
