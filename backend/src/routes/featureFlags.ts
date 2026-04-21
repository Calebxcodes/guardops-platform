import { Router, Request, Response } from 'express'
import { FeatureFlagManager } from '../services/featureFlagManager'

const router = Router()

router.get('/feature-flags', async (req: Request, res: Response) => {
  const tenantId = req.tenant?.tenantId
  if (tenantId) {
    const flags = await FeatureFlagManager.getTenantFlags(tenantId)
    return res.json(flags)
  }
  res.json(FeatureFlagManager.getGlobalFlags())
})

export default router
