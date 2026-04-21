import { Router, Request, Response } from 'express'
import { pool } from '../db/pool'
import { FeatureFlagManager, FeatureFlags } from '../services/featureFlagManager'
import { requireMasterAdmin, requireRole } from './masterAdminAuth'

const router = Router()

// Global flags (from env)
router.get('/flags/global', requireMasterAdmin, (_req: Request, res: Response) => {
  res.json(FeatureFlagManager.getGlobalFlags())
})

// All per-tenant flag overrides
router.get('/flags', requireMasterAdmin, async (_req: Request, res: Response) => {
  const { rows } = await pool.query(
    `SELECT tf.tenant_id, t.name AS tenant_name, t.slug, tf.flags, tf.updated_at
     FROM public.tenant_feature_flags tf
     JOIN public.tenants t ON t.id = tf.tenant_id
     ORDER BY tf.tenant_id`
  )
  res.json(rows)
})

// Flags for a single tenant (merged global + overrides)
router.get('/flags/tenant/:tenantId', requireMasterAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.tenantId)
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid tenantId' })
  const flags = await FeatureFlagManager.getTenantFlags(id)
  res.json(flags)
})

// Toggle a flag for a specific tenant
router.post('/flags/tenant/:tenantId/:flag', requireMasterAdmin, requireRole('super_admin'), async (req: Request, res: Response) => {
  const { tenantId, flag } = req.params
  const { enabled } = req.body

  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: '`enabled` must be a boolean' })
  }

  const validFlags: (keyof FeatureFlags)[] = [
    'stripe_payments_enabled', 'multi_tenancy_enabled', 'onboarding_videos_enabled',
    'websocket_messaging_enabled', 'geofencing_alerts_enabled', 'api_v2_enabled',
  ]
  if (!validFlags.includes(flag as keyof FeatureFlags)) {
    return res.status(400).json({ error: `Unknown flag. Valid: ${validFlags.join(', ')}` })
  }

  await FeatureFlagManager.setTenantFlag(Number(tenantId), flag as keyof FeatureFlags, enabled)

  await pool.query(
    `INSERT INTO public.audit_logs
       (actor_type, actor_id, action, target_type, target_id, details)
     VALUES ('master_admin', $1, 'flag_toggled', 'tenant', $2, $3)`,
    [req.masterAdmin!.adminId, tenantId, JSON.stringify({ flag, enabled })]
  )

  res.json({ message: `${flag} set to ${enabled} for tenant ${tenantId}` })
})

// Toggle a global flag (affects all tenants without override)
router.post('/flags/global/:flag', requireMasterAdmin, requireRole('super_admin'), async (req: Request, res: Response) => {
  const { flag } = req.params
  const { enabled } = req.body

  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: '`enabled` must be a boolean' })
  }

  const validFlags: (keyof FeatureFlags)[] = [
    'stripe_payments_enabled', 'multi_tenancy_enabled', 'onboarding_videos_enabled',
    'websocket_messaging_enabled', 'geofencing_alerts_enabled', 'api_v2_enabled',
  ]
  if (!validFlags.includes(flag as keyof FeatureFlags)) {
    return res.status(400).json({ error: `Unknown flag. Valid: ${validFlags.join(', ')}` })
  }

  FeatureFlagManager.setGlobalFlag(flag as keyof FeatureFlags, enabled)

  await pool.query(
    `INSERT INTO public.audit_logs
       (actor_type, actor_id, action, target_type, target_id, details)
     VALUES ('master_admin', $1, 'global_flag_toggled', 'system', 0, $2)`,
    [req.masterAdmin!.adminId, JSON.stringify({ flag, enabled })]
  )

  res.json({ message: `Global ${flag} set to ${enabled}` })
})

export default router
