import { Router, Response } from 'express'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { query } from '../db/schema'

const router = Router()
router.use(requireAuth)

/** Return the VAPID public key so the client can subscribe */
router.get('/vapid-public-key', (_req, res) => {
  const key = process.env.VAPID_PUBLIC_KEY || ''
  if (!key) return res.status(503).json({ error: 'Push notifications not configured' })
  res.json({ key })
})

/** Register / update a push subscription for the authenticated guard */
router.post('/subscribe', async (req: AuthRequest, res: Response) => {
  const { endpoint, keys } = req.body
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: 'endpoint and keys (p256dh, auth) are required' })
  }

  const userAgent = req.headers['user-agent']?.slice(0, 255) || null

  // Upsert — if the endpoint already exists for this guard, update keys
  await query(`
    INSERT INTO push_subscriptions (guard_id, endpoint, p256dh, auth, user_agent)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (guard_id, endpoint) DO UPDATE
      SET p256dh = EXCLUDED.p256dh,
          auth   = EXCLUDED.auth,
          user_agent = EXCLUDED.user_agent
  `, [req.guardId, endpoint, keys.p256dh, keys.auth, userAgent])

  res.json({ success: true })
})

/** Remove a push subscription (e.g. when user disables notifications) */
router.post('/unsubscribe', async (req: AuthRequest, res: Response) => {
  const { endpoint } = req.body
  if (!endpoint) return res.status(400).json({ error: 'endpoint is required' })
  await query(
    'DELETE FROM push_subscriptions WHERE guard_id = $1 AND endpoint = $2',
    [req.guardId, endpoint]
  )
  res.json({ success: true })
})

export default router
