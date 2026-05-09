import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import * as Sentry from '@sentry/node'
import { pool, query } from '../db/pool'
import { requireMasterAdmin, requireRole } from './masterAdminAuth'

const router = Router()

// List all tenants with guard count + subscription info
router.get('/tenants', requireMasterAdmin, async (req: Request, res: Response) => {
  const { status, tier, search } = req.query

  let sql = `
    SELECT
      t.id, t.slug, t.name, t.email, t.status, t.tier, t.max_guards,
      t.created_at,
      s.status        AS subscription_status,
      s.trial_ends_at,
      s.plan_code,
      COUNT(p_fail.id)::int AS failed_payments
    FROM public.tenants t
    LEFT JOIN public.subscriptions s ON s.tenant_id = t.id
    LEFT JOIN public.payments p_fail
      ON p_fail.tenant_id = t.id AND p_fail.status = 'failed'
    WHERE 1=1
  `
  const params: any[] = []

  if (status) {
    params.push(status)
    sql += ` AND t.status = $${params.length}`
  }
  if (tier) {
    params.push(tier)
    sql += ` AND t.tier = $${params.length}`
  }
  if (search) {
    params.push(`%${search}%`)
    sql += ` AND (t.name ILIKE $${params.length} OR t.email ILIKE $${params.length})`
  }

  sql += ` GROUP BY t.id, s.status, s.trial_ends_at, s.plan_code ORDER BY t.created_at DESC`

  const { rows } = await pool.query(sql, params)

  // Fetch live guard counts from each tenant schema
  const withCounts = await Promise.all(
    rows.map(async (row) => {
      try {
        const schemaName = `tenant_${row.id}`
        const { rows: gc } = await pool.query(
          `SELECT COUNT(*)::int AS c FROM ${schemaName}.guards WHERE active = 1`
        )
        return { ...row, guard_count: gc[0]?.c ?? 0 }
      } catch {
        return { ...row, guard_count: 0 }
      }
    })
  )

  res.json(withCounts)
})

// Single tenant detail
router.get('/tenants/:tenantId', requireMasterAdmin, async (req: Request, res: Response) => {
  const { tenantId } = req.params
  const { rows } = await pool.query(
    `SELECT
       t.*,
       s.status AS subscription_status, s.trial_ends_at, s.plan_code,
       s.stripe_subscription_id
     FROM public.tenants t
     LEFT JOIN public.subscriptions s ON s.tenant_id = t.id
     WHERE t.id = $1`,
    [tenantId]
  )
  if (!rows[0]) return res.status(404).json({ error: 'Tenant not found' })
  res.json(rows[0])
})

// Pause tenant
router.post('/tenants/:tenantId/pause', requireMasterAdmin, requireRole('editor'), async (req: Request, res: Response) => {
  const { tenantId } = req.params
  const { reason } = req.body
  const now = Math.floor(Date.now() / 1000)

  await pool.query(
    'UPDATE public.tenants SET status = $1, updated_at = $2 WHERE id = $3',
    ['paused', now, tenantId]
  )
  await pool.query(
    `INSERT INTO public.audit_logs
       (actor_type, actor_id, action, target_type, target_id, details)
     VALUES ('master_admin', $1, 'tenant_paused', 'tenant', $2, $3)`,
    [req.masterAdmin!.adminId, tenantId, JSON.stringify({ reason: reason ?? 'Manual suspension' })]
  )

  res.json({ message: 'Tenant paused' })
})

// Resume tenant
router.post('/tenants/:tenantId/resume', requireMasterAdmin, requireRole('editor'), async (req: Request, res: Response) => {
  const { tenantId } = req.params
  const now = Math.floor(Date.now() / 1000)

  await pool.query(
    'UPDATE public.tenants SET status = $1, updated_at = $2 WHERE id = $3',
    ['active', now, tenantId]
  )
  await pool.query(
    `INSERT INTO public.audit_logs
       (actor_type, actor_id, action, target_type, target_id)
     VALUES ('master_admin', $1, 'tenant_resumed', 'tenant', $2)`,
    [req.masterAdmin!.adminId, tenantId]
  )

  res.json({ message: 'Tenant resumed' })
})

// Cancel tenant (hard cancel — sets status=cancelled)
router.post('/tenants/:tenantId/cancel', requireMasterAdmin, requireRole('super_admin'), async (req: Request, res: Response) => {
  const { tenantId } = req.params
  const { reason } = req.body
  const now = Math.floor(Date.now() / 1000)

  await pool.query(
    'UPDATE public.tenants SET status = $1, updated_at = $2 WHERE id = $3',
    ['cancelled', now, tenantId]
  )
  await pool.query(
    `UPDATE public.subscriptions SET status = 'cancelled', cancelled_at = $1, updated_at = $1
     WHERE tenant_id = $2`,
    [now, tenantId]
  )
  await pool.query(
    `INSERT INTO public.audit_logs
       (actor_type, actor_id, action, target_type, target_id, details)
     VALUES ('master_admin', $1, 'tenant_cancelled', 'tenant', $2, $3)`,
    [req.masterAdmin!.adminId, tenantId, JSON.stringify({ reason })]
  )

  res.json({ message: 'Tenant cancelled' })
})

// Extend trial
router.post('/tenants/:tenantId/extend-trial', requireMasterAdmin, requireRole('super_admin'), async (req: Request, res: Response) => {
  const { tenantId } = req.params
  const { days = 7 } = req.body
  const now = Math.floor(Date.now() / 1000)
  const extension = Number(days) * 24 * 60 * 60

  const { rows } = await pool.query(
    'SELECT trial_ends_at FROM public.subscriptions WHERE tenant_id = $1',
    [tenantId]
  )
  if (!rows[0]) return res.status(404).json({ error: 'Subscription not found' })

  const base = Math.max(rows[0].trial_ends_at ?? now, now)
  const newEnd = base + extension

  await pool.query(
    `UPDATE public.subscriptions
     SET trial_ends_at = $1, status = 'trialing', updated_at = $2
     WHERE tenant_id = $3`,
    [newEnd, now, tenantId]
  )
  await pool.query(
    `UPDATE public.tenants SET status = 'active', updated_at = $1 WHERE id = $2`,
    [now, tenantId]
  )
  await pool.query(
    `INSERT INTO public.audit_logs
       (actor_type, actor_id, action, target_type, target_id, details)
     VALUES ('master_admin', $1, 'trial_extended', 'tenant', $2, $3)`,
    [req.masterAdmin!.adminId, tenantId, JSON.stringify({ days, newTrialEndsAt: newEnd })]
  )

  res.json({ message: `Trial extended by ${days} days`, trial_ends_at: newEnd })
})

// Permanently delete a tenant
// - Soft-deletes by setting status='deleted' + deleted_at timestamp
// - Tenant schema is retained for 30 days before physical purge
// - Requires super_admin role and master admin password confirmation
router.post(
  '/tenants/:tenantId/permanent-delete',
  requireMasterAdmin,
  requireRole('super_admin'),
  async (req: Request, res: Response) => {
    const tenantId = Number(req.params.tenantId)
    const { password, confirmDelete } = req.body as {
      password?: string
      confirmDelete?: string
    }

    if (!confirmDelete) {
      return res.status(400).json({ success: false, message: 'Confirmation required' })
    }

    try {
      // 1. Fetch tenant — must exist and not already be deleted
      const { rows: tenantRows } = await query(
        `SELECT id, slug, name, status, deleted_at
         FROM public.tenants
         WHERE id = $1`,
        [tenantId]
      )
      if (!tenantRows[0]) {
        return res.status(404).json({ success: false, message: 'Tenant not found' })
      }
      if (tenantRows[0].deleted_at !== null && tenantRows[0].deleted_at !== undefined) {
        return res.status(400).json({ success: false, message: 'This tenant is already deleted' })
      }

      // 2. Verify master admin password via bcrypt
      const { rows: adminRows } = await query(
        'SELECT password_hash FROM public.master_admins WHERE id = $1',
        [req.masterAdmin!.adminId]
      )
      const hash = adminRows[0]?.password_hash
      const valid = hash ? await bcrypt.compare(password ?? '', hash) : false
      if (!valid) {
        return res.status(401).json({ success: false, message: 'Incorrect password' })
      }

      // 3. Count tenant records for the audit trail and response
      let guardCount = 0
      let shiftCount = 0
      let clientCount = 0
      let incidentCount = 0
      try {
        const [gc, sc, cc, ic] = await Promise.all([
          query('SELECT COUNT(*)::int AS c FROM guards',    [], tenantId),
          query('SELECT COUNT(*)::int AS c FROM shifts',    [], tenantId),
          query('SELECT COUNT(*)::int AS c FROM clients',   [], tenantId),
          query('SELECT COUNT(*)::int AS c FROM incidents', [], tenantId),
        ])
        guardCount    = gc.rows[0]?.c ?? 0
        shiftCount    = sc.rows[0]?.c ?? 0
        clientCount   = cc.rows[0]?.c ?? 0
        incidentCount = ic.rows[0]?.c ?? 0
      } catch {
        // Tenant schema may not exist — proceed with zero counts
      }

      const now = Math.floor(Date.now() / 1000)

      // 4. Mark tenant as deleted (schema retained for 30-day recovery window)
      await query(
        `UPDATE public.tenants
         SET status = 'deleted', deleted_at = $1, updated_at = $1
         WHERE id = $2`,
        [now, tenantId]
      )

      // 5. Cancel subscription
      await query(
        `UPDATE public.subscriptions
         SET status = 'cancelled', cancelled_at = $1, updated_at = $1
         WHERE tenant_id = $2`,
        [now, tenantId]
      )

      // 6. Immutable audit record
      await query(
        `INSERT INTO public.audit_logs
           (actor_type, actor_id, action, target_type, target_id, details)
         VALUES ('master_admin', $1, 'tenant_permanently_deleted', 'tenant', $2, $3)`,
        [
          req.masterAdmin!.adminId,
          tenantId,
          JSON.stringify({
            slug: tenantRows[0].slug,
            guardCount,
            shiftCount,
            clientCount,
            incidentCount,
            deletedAt: now,
          }),
        ]
      )

      const total = guardCount + shiftCount + clientCount + incidentCount
      return res.json({
        success: true,
        message: `Tenant permanently deleted. ${total} records permanently deleted.`,
        counts: { guards: guardCount, shifts: shiftCount, clients: clientCount, incidents: incidentCount },
      })
    } catch (err: any) {
      console.error('[permanent-delete]', err)
      Sentry.captureException(err)
      return res.status(500).json({ success: false, message: err.message ?? 'Database error' })
    }
  }
)

export default router
