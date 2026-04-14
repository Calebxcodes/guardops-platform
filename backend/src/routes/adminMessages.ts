/**
 * Admin → Guard messaging
 * All routes require a valid admin JWT (applied in index.ts via requireAdmin)
 */
import { Router, Request, Response } from 'express'
import { query } from '../db/schema'
import { notifyGuard, notifyAllGuards } from '../services/push'

const router = Router()

/** List all guard messages (thread view for admin) */
router.get('/', async (_req: Request, res: Response) => {
  const { rows } = await query(`
    SELECT m.*,
      g.first_name, g.last_name, g.email
    FROM messages m
    LEFT JOIN guards g ON g.id = COALESCE(NULLIF(m.from_guard_id, 0), NULLIF(m.to_guard_id, 0))
    ORDER BY m.created_at DESC
    LIMIT 200
  `)
  res.json(rows)
})

/** Send a message from admin to a specific guard (or broadcast to all) */
router.post('/send', async (req: Request, res: Response) => {
  const { to_guard_id, body, is_broadcast } = req.body
  if (!body?.trim()) return res.status(400).json({ error: 'body is required' })

  if (is_broadcast) {
    // Insert one message per active guard
    const { rows: guards } = await query('SELECT id FROM guards WHERE active = 1')
    for (const g of guards) {
      await query(
        'INSERT INTO messages (from_guard_id, to_guard_id, body) VALUES (0, $1, $2)',
        [g.id, body]
      )
    }
    await notifyAllGuards({
      title: 'Message from Operations',
      body: body.length > 100 ? body.slice(0, 97) + '…' : body,
      url: '/messages',
      tag: 'admin-broadcast',
      urgency: 'normal',
    })
    return res.status(201).json({ success: true, recipients: guards.length })
  }

  if (!to_guard_id) return res.status(400).json({ error: 'to_guard_id or is_broadcast is required' })

  const { rows } = await query(
    'INSERT INTO messages (from_guard_id, to_guard_id, body) VALUES (0, $1, $2) RETURNING *',
    [to_guard_id, body]
  )

  await notifyGuard(to_guard_id, {
    title: 'New message from Operations',
    body: body.length > 100 ? body.slice(0, 97) + '…' : body,
    url: '/messages',
    tag: `msg-${rows[0].id}`,
    urgency: 'normal',
  }, { email: true })

  res.status(201).json(rows[0])
})

export default router
