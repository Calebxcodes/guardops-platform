import { Router, Response } from 'express'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { query } from '../db/schema'
import { pushToAdmins } from '../services/sse'
import { issueGuardStreamToken } from '../services/streamTokens'

const router = Router()
router.use(requireAuth)

/** Issue a short-lived stream token so the guard can open an SSE connection */
router.post('/stream-token', (req: AuthRequest, res: Response) => {
  const token = issueGuardStreamToken(req.guardId!)
  res.json({ token })
})

router.get('/', async (req: AuthRequest, res: Response) => {
  const { rows } = await query(`
    SELECT m.*,
      g.first_name as from_first, g.last_name as from_last
    FROM messages m
    LEFT JOIN guards g ON g.id = m.from_guard_id
    WHERE m.from_guard_id = $1 OR m.to_guard_id = $1
    ORDER BY m.created_at ASC
  `, [req.guardId])
  res.json(rows)
})

router.post('/', async (req: AuthRequest, res: Response) => {
  const { body, is_emergency } = req.body
  const { rows } = await query(`
    INSERT INTO messages (from_guard_id, to_guard_id, body, is_emergency)
    VALUES ($1, 0, $2, $3) RETURNING *
  `, [req.guardId, body, is_emergency ? 1 : 0])
  pushToAdmins('message', rows[0])
  res.status(201).json(rows[0])
})

router.post('/emergency', async (req: AuthRequest, res: Response) => {
  const { message, lat, lng } = req.body
  const { rows: guardRows } = await query('SELECT first_name, last_name FROM guards WHERE id = $1', [req.guardId])
  const guard = guardRows[0]
  const msgBody = `🚨 EMERGENCY ALERT from ${guard?.first_name} ${guard?.last_name}${lat ? ` at (${lat.toFixed(4)}, ${lng.toFixed(4)})` : ''}${message ? ': ' + message : ''}`
  const { rows } = await query(`
    INSERT INTO messages (from_guard_id, to_guard_id, body, is_emergency)
    VALUES ($1, 0, $2, 1) RETURNING *
  `, [req.guardId, msgBody])
  pushToAdmins('message', rows[0])
  res.status(201).json(rows[0])
})

router.put('/:id/read', async (req: AuthRequest, res: Response) => {
  await query("UPDATE messages SET read_at = NOW() WHERE id = $1 AND to_guard_id = $2", [req.params.id, req.guardId])
  res.json({ success: true })
})

router.get('/unread', async (req: AuthRequest, res: Response) => {
  const { rows } = await query(`
    SELECT * FROM messages WHERE to_guard_id = $1 AND read_at IS NULL ORDER BY created_at DESC
  `, [req.guardId])
  res.json(rows)
})

export default router
