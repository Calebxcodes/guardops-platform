import { Router, Request, Response } from 'express'
import { getDb } from '../db/schema'

const router = Router()

router.get('/', (req: Request, res: Response) => {
  const db = getDb()
  const sites = db.prepare(`
    SELECT s.*, c.name as client_name,
      COUNT(DISTINCT sh.id) as active_shifts,
      COUNT(DISTINCT sh2.guard_id) as assigned_guards
    FROM sites s
    LEFT JOIN clients c ON c.id = s.client_id
    LEFT JOIN shifts sh ON sh.site_id = s.id AND sh.status IN ('assigned','active') AND date(sh.start_time) = date('now')
    LEFT JOIN shifts sh2 ON sh2.site_id = s.id AND sh2.status IN ('assigned','active') AND date(sh2.start_time) = date('now')
    WHERE s.active = 1
    GROUP BY s.id
    ORDER BY s.name
  `).all()
  res.json(sites)
})

router.get('/:id', (req: Request, res: Response) => {
  const db = getDb()
  const site = db.prepare(`
    SELECT s.*, c.name as client_name, c.contact_name, c.contact_phone
    FROM sites s LEFT JOIN clients c ON c.id = s.client_id
    WHERE s.id = ?
  `).get(req.params.id)
  if (!site) return res.status(404).json({ error: 'Site not found' })
  const shifts = db.prepare(`
    SELECT sh.*, g.first_name, g.last_name
    FROM shifts sh LEFT JOIN guards g ON g.id = sh.guard_id
    WHERE sh.site_id = ? AND date(sh.start_time) >= date('now', '-7 days')
    ORDER BY sh.start_time DESC LIMIT 20
  `).all(req.params.id)
  res.json({ ...site, shifts })
})

router.post('/', (req: Request, res: Response) => {
  const db = getDb()
  const { client_id, name, address, lat, lng, requirements, post_orders, guards_required, hourly_rate } = req.body
  const result = db.prepare(`
    INSERT INTO sites (client_id, name, address, lat, lng, requirements, post_orders, guards_required, hourly_rate)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(client_id, name, address, lat, lng, requirements, post_orders, guards_required || 1, hourly_rate || 0)
  res.status(201).json(db.prepare('SELECT * FROM sites WHERE id = ?').get(result.lastInsertRowid))
})

router.put('/:id', (req: Request, res: Response) => {
  const db = getDb()
  const { client_id, name, address, lat, lng, requirements, post_orders, guards_required, hourly_rate } = req.body
  db.prepare(`
    UPDATE sites SET client_id=?, name=?, address=?, lat=?, lng=?, requirements=?, post_orders=?, guards_required=?, hourly_rate=?
    WHERE id=?
  `).run(client_id, name, address, lat, lng, requirements, post_orders, guards_required, hourly_rate, req.params.id)
  res.json(db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id))
})

router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb()
  db.prepare('UPDATE sites SET active = 0 WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

export default router
