import webpush from 'web-push'
import { query } from '../db/schema'
import { sendGuardNotificationEmail } from './email'

const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY  || ''
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || ''
const VAPID_MAILTO  = `mailto:${process.env.FROM_EMAIL || 'admin@strondis.com'}`

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_MAILTO, VAPID_PUBLIC, VAPID_PRIVATE)
}

export interface PushPayload {
  title: string
  body: string
  url?: string
  tag?: string
  requireInteraction?: boolean
  /** 'critical' gets requireInteraction=true and a red badge in the SW */
  urgency?: 'normal' | 'high' | 'critical'
}

/** Send a push notification + optional email to one guard */
export async function notifyGuard(
  guardId: number,
  payload: PushPayload,
  opts: { email?: boolean } = { email: false }
) {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    console.log(`[Push] VAPID not configured — skipping push for guard ${guardId}`)
    return
  }

  // Fetch all push subscriptions for this guard
  const { rows: subs } = await query(
    'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE guard_id = $1',
    [guardId]
  )

  const data = JSON.stringify({
    ...payload,
    requireInteraction: payload.requireInteraction ?? (payload.urgency === 'critical' || payload.urgency === 'high'),
  })

  const ttl = payload.urgency === 'critical' ? 3600 : 86400 // critical = 1h, others = 24h

  const removeIds: number[] = []

  await Promise.allSettled(
    subs.map(async sub => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          data,
          { TTL: ttl }
        )
      } catch (err: any) {
        // 404 / 410 = subscription expired/revoked — remove it
        if (err.statusCode === 404 || err.statusCode === 410) {
          removeIds.push(sub.id)
        } else {
          console.error(`[Push] Failed to send to sub ${sub.id}:`, err.message)
        }
      }
    })
  )

  if (removeIds.length > 0) {
    await query('DELETE FROM push_subscriptions WHERE id = ANY($1)', [removeIds])
    console.log(`[Push] Removed ${removeIds.length} expired subscription(s) for guard ${guardId}`)
  }

  // Email fallback if requested and SMTP is configured
  if (opts.email) {
    const { rows } = await query('SELECT email, first_name FROM guards WHERE id = $1', [guardId])
    if (rows[0]?.email) {
      await sendGuardNotificationEmail(rows[0].email, rows[0].first_name, payload)
        .catch(e => console.error('[Push] Email fallback failed:', e.message))
    }
  }
}

/** Broadcast a push notification to all active guards */
export async function notifyAllGuards(payload: PushPayload) {
  const { rows } = await query('SELECT DISTINCT guard_id FROM push_subscriptions')
  await Promise.allSettled(rows.map(r => notifyGuard(r.guard_id, payload)))
}

/** Notify guards assigned to a specific shift list */
export async function notifyGuardIds(guardIds: number[], payload: PushPayload) {
  await Promise.allSettled(guardIds.map(id => notifyGuard(id, payload)))
}
