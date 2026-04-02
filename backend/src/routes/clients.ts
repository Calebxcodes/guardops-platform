import { Router, Request, Response } from 'express'
import { getDb } from '../db/schema'

const router = Router()

router.get('/', (req: Request, res: Response) => {
  const db = getDb()
  const clients = db.prepare(`
    SELECT c.*, COUNT(s.id) as site_count
    FROM clients c
    LEFT JOIN sites s ON s.client_id = c.id AND s.active = 1
    WHERE c.active = 1
    GROUP BY c.id
    ORDER BY c.name
  `).all()
  res.json(clients)
})

router.get('/:id', (req: Request, res: Response) => {
  const db = getDb()
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id)
  if (!client) return res.status(404).json({ error: 'Client not found' })
  const sites = db.prepare('SELECT * FROM sites WHERE client_id = ? AND active = 1').all(req.params.id)
  res.json({ ...(client as any), sites })
})

router.post('/', (req: Request, res: Response) => {
  const db = getDb()
  const { name, contact_name, contact_email, contact_phone, address, notes } = req.body
  const result = db.prepare(`
    INSERT INTO clients (name, contact_name, contact_email, contact_phone, address, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(name, contact_name, contact_email, contact_phone, address, notes)
  res.status(201).json(db.prepare('SELECT * FROM clients WHERE id = ?').get(result.lastInsertRowid))
})

router.put('/:id', (req: Request, res: Response) => {
  const db = getDb()
  const { name, contact_name, contact_email, contact_phone, address, notes } = req.body
  db.prepare(`
    UPDATE clients SET name=?, contact_name=?, contact_email=?, contact_phone=?, address=?, notes=?
    WHERE id=?
  `).run(name, contact_name, contact_email, contact_phone, address, notes, req.params.id)
  res.json(db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id))
})

router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb()
  db.prepare('UPDATE clients SET active = 0 WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

export default router
