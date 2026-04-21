import { Request, Response, NextFunction } from 'express'
import { pool } from '../db/pool'

export interface TenantContext {
  tenantId: number
  tenantSlug: string
  schemaName: string
  maxGuards: number
  tier: string
  subscriptionStatus: string | null
  trialEndsAt: number | null
}

declare global {
  namespace Express {
    interface Request {
      tenant?: TenantContext
      isMasterAdmin?: boolean
    }
  }
}

// Hostnames that bypass tenant detection entirely
const MASTER_HOSTS = new Set([
  'admin-master.strondis.com',
  'master-admin.strondis.com',
])

// Development / CI bypass — never active in production (Railway sets NODE_ENV=production)
const isDev = process.env.NODE_ENV !== 'production'

export async function detectTenant(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const hostname = req.hostname // e.g. "allied-security.strondis.com"

  // Master admin panel — skip tenant detection
  if (MASTER_HOSTS.has(hostname)) {
    req.isMasterAdmin = true
    return next()
  }

  // Local development — skip tenant detection so existing routes keep working
  if (isDev || hostname === 'localhost' || hostname === '127.0.0.1') {
    return next()
  }

  // The signup endpoint is public — no tenant context needed
  if (req.path.startsWith('/api/signup') || req.path.startsWith('/api/webhooks')) {
    return next()
  }

  // Extract subdomain: "allied-security.strondis.com" → "allied-security"
  const parts = hostname.split('.')
  if (parts.length < 3) {
    // Likely a bare domain (strondis.com) — landing page traffic, skip
    return next()
  }

  const tenantSlug = parts[0]

  try {
    const { rows } = await pool.query(
      `SELECT
        t.id, t.slug, t.tier, t.max_guards, t.status,
        s.status        AS subscription_status,
        s.trial_ends_at AS trial_ends_at
       FROM public.tenants t
       LEFT JOIN public.subscriptions s ON s.tenant_id = t.id
       WHERE t.slug = $1
       LIMIT 1`,
      [tenantSlug]
    )

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' })
    }

    const t = rows[0]

    if (t.status === 'paused') {
      return res.status(403).json({ error: 'Your account has been paused. Please contact support.' })
    }
    if (t.status === 'cancelled') {
      return res.status(403).json({ error: 'Your account has been cancelled. Contact us to reactivate.' })
    }

    const now = Math.floor(Date.now() / 1000)
    const isOnTrial = t.trial_ends_at && t.trial_ends_at > now
    const isPaid    = t.subscription_status === 'active'

    if (!isOnTrial && !isPaid) {
      return res.status(403).json({ error: 'Subscription expired. Please renew to continue.' })
    }

    req.tenant = {
      tenantId:           t.id,
      tenantSlug:         t.slug,
      schemaName:         `tenant_${t.id}`,
      maxGuards:          t.max_guards,
      tier:               t.tier,
      subscriptionStatus: t.subscription_status,
      trialEndsAt:        t.trial_ends_at,
    }

    next()
  } catch (err) {
    console.error('[TenantDetection]', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}
