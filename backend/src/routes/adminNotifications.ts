/**
 * Admin push-notification management
 * Requires admin JWT (applied in index.ts)
 */
import { Router, Request, Response } from 'express'
import { query, auditLog } from '../db/schema'
import { notifyGuard, notifyAllGuards, PushPayload } from '../services/push'

const router = Router()

/** List all guards with their push subscription count */
router.get('/subscriptions', async (_req: Request, res: Response) => {
  const { rows } = await query(`
    SELECT
      g.id,
      g.first_name || ' ' || g.last_name AS name,
      g.email,
      g.status,
      COUNT(ps.id)::int AS subscription_count,
      MAX(ps.created_at) AS last_subscribed
    FROM guards g
    LEFT JOIN push_subscriptions ps ON ps.guard_id = g.id
    WHERE g.active = 1
    GROUP BY g.id, g.first_name, g.last_name, g.email, g.status
    ORDER BY g.first_name, g.last_name
  `)
  res.json(rows)
})

/** Send a custom push notification to one guard or broadcast to all */
router.post('/send', async (req: any, res: Response) => {
  const { guard_id, title, body, url, urgency = 'normal' } = req.body
  if (!title?.trim() || !body?.trim()) {
    return res.status(400).json({ error: 'title and body are required' })
  }
  if (!['normal', 'high', 'critical'].includes(urgency)) {
    return res.status(400).json({ error: 'urgency must be normal, high, or critical' })
  }

  const payload: PushPayload = {
    title: title.trim(),
    body: body.trim(),
    url: url?.trim() || '/',
    tag: `admin-notif-${Date.now()}`,
    urgency,
  }

  if (guard_id) {
    // Single guard
    const { rows } = await query('SELECT id FROM guards WHERE id = $1 AND active = 1', [guard_id])
    if (!rows[0]) return res.status(404).json({ error: 'Guard not found' })
    await notifyGuard(guard_id, payload)
    auditLog({ user_type: 'admin', user_id: req.adminId, action: 'push_sent', resource_type: 'guard', resource_id: guard_id, ip_address: req.ip, extra: { title, urgency } })
    res.json({ success: true, recipients: 1 })
  } else {
    // Broadcast to all guards with subscriptions
    const { rows } = await query('SELECT COUNT(DISTINCT guard_id)::int AS n FROM push_subscriptions')
    await notifyAllGuards(payload)
    auditLog({ user_type: 'admin', user_id: req.adminId, action: 'push_broadcast', ip_address: req.ip, extra: { title, urgency } })
    res.json({ success: true, recipients: rows[0]?.n || 0 })
  }
})

/** Recent push notification history from the audit log */
router.get('/history', async (_req: Request, res: Response) => {
  const { rows } = await query(`
    SELECT
      al.id,
      al.action,
      al.resource_id AS guard_id,
      al.extra,
      al.created_at,
      au.name AS sent_by,
      g.first_name || ' ' || g.last_name AS guard_name
    FROM audit_log al
    LEFT JOIN admin_users au ON au.id = al.user_id
    LEFT JOIN guards g ON g.id = al.resource_id
    WHERE al.action IN ('push_sent', 'push_broadcast')
    ORDER BY al.created_at DESC
    LIMIT 50
  `)
  res.json(rows.map((r: any) => ({
    ...r,
    extra: r.extra ? JSON.parse(r.extra) : {},
  })))
})

export default router
