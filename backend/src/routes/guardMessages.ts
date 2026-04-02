import { Router, Response } from 'express'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { getDb } from '../db/schema'

const router = Router()
router.use(requireAuth)

router.get('/', (req: AuthRequest, res: Response) => {
  const db = getDb()
  const messages = db.prepare(`
    SELECT m.*,
      g.first_name as from_first, g.last_name as from_last
    FROM messages m
    LEFT JOIN guards g ON g.id = m.from_guard_id
    WHERE m.from_guard_id = ? OR m.to_guard_id = ?
    ORDER BY m.created_at ASC
  `).all(req.guardId, req.guardId)
  res.json(messages)
})

router.post('/', (req: AuthRequest, res: Response) => {
  const db = getDb()
  const { body, is_emergency } = req.body
  // Messages from guards go to manager (to_guard_id = 0 means manager)
  const result = db.prepare(`
    INSERT INTO messages (from_guard_id, to_guard_id, body, is_emergency)
    VALUES (?, 0, ?, ?)
  `).run(req.guardId, body, is_emergency ? 1 : 0)
  res.status(201).json(db.prepare('SELECT * FROM messages WHERE id = ?').get(result.lastInsertRowid))
})

router.post('/emergency', (req: AuthRequest, res: Response) => {
  const db = getDb()
  const { message, lat, lng } = req.body
  const guard = db.prepare('SELECT first_name, last_name FROM guards WHERE id = ?').get(req.guardId) as any
  const body = `🚨 EMERGENCY ALERT from ${guard?.first_name} ${guard?.last_name}${lat ? ` at (${lat.toFixed(4)}, ${lng.toFixed(4)})` : ''}${message ? ': ' + message : ''}`
  const result = db.prepare(`
    INSERT INTO messages (from_guard_id, to_guard_id, body, is_emergency)
    VALUES (?, 0, ?, 1)
  `).run(req.guardId, body)
  res.status(201).json(db.prepare('SELECT * FROM messages WHERE id = ?').get(result.lastInsertRowid))
})

router.put('/:id/read', (req: AuthRequest, res: Response) => {
  const db = getDb()
  db.prepare("UPDATE messages SET read_at = datetime('now') WHERE id = ? AND to_guard_id = ?").run(req.params.id, req.guardId)
  res.json({ success: true })
})

// Manager replies (sent to guard) - for polling
router.get('/unread', (req: AuthRequest, res: Response) => {
  const db = getDb()
  const msgs = db.prepare(`
    SELECT * FROM messages WHERE to_guard_id = ? AND read_at IS NULL ORDER BY created_at DESC
  `).all(req.guardId)
  res.json(msgs)
})

export default router
