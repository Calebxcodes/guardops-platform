import { Router, Request, Response } from 'express'
import { FeatureFlagManager, FeatureFlags } from '../services/featureFlagManager'
import { requireAdmin } from './adminAuth'

const router = Router()

router.get('/feature-flags', async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId ?? req.tenant?.tenantId
  if (tenantId) {
    const flags = await FeatureFlagManager.getTenantFlags(tenantId)
    return res.json(flags)
  }
  res.json(FeatureFlagManager.getGlobalFlags())
})

// PATCH /api/feature-flags — owner can toggle per-tenant flags
router.patch('/feature-flags', requireAdmin, async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId as number
  const adminRole = (req as any).adminRole as string
  if (adminRole !== 'owner') {
    return res.status(403).json({ error: 'Only owners can change feature flags' })
  }
  const { flag, enabled } = req.body as { flag: keyof FeatureFlags; enabled: boolean }
  if (!flag || typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'flag and enabled are required' })
  }
  try {
    await FeatureFlagManager.setTenantFlag(tenantId, flag, enabled)
    const flags = await FeatureFlagManager.getTenantFlags(tenantId)
    return res.json({ success: true, flags })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

export default router
