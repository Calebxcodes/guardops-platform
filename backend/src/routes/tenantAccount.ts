import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import * as Sentry from '@sentry/node'
import { query } from '../db/pool'
import { requireAdmin } from './adminAuth'
import { requirePermission } from '../middleware/rbac'

const router = Router()

// Helper: verify admin password, returns false on mismatch or missing hash
async function verifyAdminPassword(
  adminId: number,
  tenantId: number,
  password: string | undefined,
): Promise<boolean> {
  const { rows } = await query('SELECT password_hash FROM admin_users WHERE id = $1', [adminId], tenantId)
  const hash = rows[0]?.password_hash
  return hash ? bcrypt.compare(password ?? '', hash) : false
}

// POST /api/tenant/export — download all tenant data as JSON (password-gated, owner/manager only)
router.post('/export', requireAdmin, requirePermission('settings', 'update'), async (req: any, res: Response) => {
  const { password } = req.body as { password?: string }
  const tenantId: number = req.tenantId
  const adminId: number  = req.adminId

  if (!password) {
    return res.status(400).json({ success: false, message: 'Password required' })
  }

  try {
    if (!(await verifyAdminPassword(adminId, tenantId, password))) {
      return res.status(401).json({ success: false, message: 'Incorrect password' })
    }

    const tables = [
      'guards', 'shifts', 'clients', 'sites', 'incidents',
      'timesheets', 'payroll_records', 'admin_users',
    ]
    const exportData: Record<string, any[]> = {}
    for (const table of tables) {
      try {
        const { rows } = await query(`SELECT * FROM ${table}`, [], tenantId)
        // Strip sensitive columns from admin_users export
        if (table === 'admin_users') {
          exportData[table] = rows.map(({ password_hash, ...rest }) => rest)
        } else {
          exportData[table] = rows
        }
      } catch {
        exportData[table] = []
      }
    }

    const now = Math.floor(Date.now() / 1000)
    await query(
      `INSERT INTO public.audit_logs (actor_type, actor_id, action, target_type, target_id, details)
       VALUES ('admin', $1, 'tenant_data_exported', 'tenant', $2, $3)`,
      [adminId, tenantId, JSON.stringify({ exportedAt: now })]
    )

    return res.json({
      success: true,
      message: 'Data export generated.',
      exportedAt: new Date().toISOString(),
      tenantId,
      data: exportData,
    })
  } catch (err: any) {
    console.error('[tenant export]', err)
    Sentry.captureException(err)
    return res.status(500).json({ success: false, message: err.message ?? 'Export failed' })
  }
})

// POST /api/tenant/archive — soft-archive (owner/manager only, password-gated)
router.post('/archive', requireAdmin, requirePermission('settings', 'update'), async (req: any, res: Response) => {
  const { password } = req.body as { password?: string }
  const tenantId: number = req.tenantId
  const adminId: number  = req.adminId

  if (!password) {
    return res.status(400).json({ success: false, message: 'Password required' })
  }

  try {
    const { rows: tenantRows } = await query(
      `SELECT id, slug, status, archived_at, deleted_at FROM public.tenants WHERE id = $1`,
      [tenantId]
    )
    if (!tenantRows[0]) {
      return res.status(404).json({ success: false, message: 'Tenant not found' })
    }
    if (tenantRows[0].deleted_at) {
      return res.status(400).json({ success: false, message: 'This account is already deleted' })
    }
    if (tenantRows[0].archived_at) {
      return res.status(400).json({ success: false, message: 'This account is already archived' })
    }

    if (!(await verifyAdminPassword(adminId, tenantId, password))) {
      return res.status(401).json({ success: false, message: 'Incorrect password' })
    }

    const now = Math.floor(Date.now() / 1000)
    await query(
      `UPDATE public.tenants SET status = 'archived', archived_at = $1, updated_at = $1 WHERE id = $2`,
      [now, tenantId]
    )

    await query(
      `UPDATE public.subscriptions SET status = 'cancelled', cancelled_at = $1, updated_at = $1 WHERE tenant_id = $2`,
      [now, tenantId]
    )

    await query(
      `INSERT INTO public.audit_logs (actor_type, actor_id, action, target_type, target_id, details)
       VALUES ('admin', $1, 'tenant_archived', 'tenant', $2, $3)`,
      [adminId, tenantId, JSON.stringify({ slug: tenantRows[0].slug, archivedAt: now })]
    )

    return res.json({ success: true, message: 'Account archived. Contact support within 30 days to restore.' })
  } catch (err: any) {
    console.error('[tenant archive]', err)
    Sentry.captureException(err)
    return res.status(500).json({ success: false, message: err.message ?? 'Archive failed' })
  }
})

// Tenant admin permanently deletes their own company account.
// - Soft-delete only: sets status='deleted' + deleted_at; schema retained 30 days.
// - Requires admin password + explicit confirmDelete flag.
// - Shift history, payroll, and incidents are preserved for compliance.
router.delete('/permanent-delete', requireAdmin, requirePermission('settings', 'update'), async (req: any, res: Response) => {
  const { password, confirmDelete } = req.body as {
    password?: string
    confirmDelete?: boolean
  }
  const tenantId: number = req.tenantId
  const adminId: number  = req.adminId

  if (!password) {
    return res.status(400).json({ success: false, message: 'Password required' })
  }
  if (!confirmDelete) {
    return res.status(400).json({ success: false, message: 'Confirmation required' })
  }

  try {
    // 1. Verify tenant exists and is not already deleted
    const { rows: tenantRows } = await query(
      `SELECT id, slug, name, status, deleted_at FROM public.tenants WHERE id = $1`,
      [tenantId]
    )
    if (!tenantRows[0]) {
      return res.status(404).json({ success: false, message: 'Tenant not found' })
    }
    if (tenantRows[0].deleted_at) {
      return res.status(400).json({ success: false, message: 'This tenant is already deleted' })
    }

    // 2. Verify admin password
    const { rows: adminRows } = await query(
      'SELECT password_hash FROM admin_users WHERE id = $1',
      [adminId],
      tenantId
    )
    const hash = adminRows[0]?.password_hash
    const valid = hash ? await bcrypt.compare(password ?? '', hash) : false
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Incorrect password' })
    }

    // 3. Count records for audit trail
    let guardCount = 0, shiftCount = 0, clientCount = 0, incidentCount = 0
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
      // Schema may not be fully initialised — proceed anyway
    }

    const now = Math.floor(Date.now() / 1000)

    // 4. Soft-delete tenant (schema retained for 30-day recovery window)
    await query(
      `UPDATE public.tenants SET status = 'deleted', deleted_at = $1, updated_at = $1 WHERE id = $2`,
      [now, tenantId]
    )

    // 5. Cancel subscription
    await query(
      `UPDATE public.subscriptions
       SET status = 'cancelled', cancelled_at = $1, updated_at = $1
       WHERE tenant_id = $2`,
      [now, tenantId]
    )

    // 6. Audit log
    await query(
      `INSERT INTO public.audit_logs
         (actor_type, actor_id, action, target_type, target_id, details)
       VALUES ('admin', $1, 'tenant_self_deleted', 'tenant', $2, $3)`,
      [
        adminId,
        tenantId,
        JSON.stringify({
          slug: tenantRows[0].slug,
          guardCount, shiftCount, clientCount, incidentCount,
          deletedAt: now,
        }),
      ]
    )

    return res.json({ success: true, message: 'Account deleted.' })
  } catch (err: any) {
    console.error('[tenant permanent-delete]', err)
    Sentry.captureException(err)
    return res.status(500).json({ success: false, message: err.message ?? 'Database error' })
  }
})

export default router
