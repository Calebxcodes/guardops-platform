import { Router, Response } from 'express'
import { pool } from '../db/pool'
import { requireAdmin } from './adminAuth'

const router = Router()

// Phase 2 foundation — dormant endpoints, not yet integrated into auth flow.
// Tables: public.permission_consents, public.permission_requests

router.get('/', requireAdmin, async (req: any, res: Response) => {
  const tenantId: number = req.tenantId
  try {
    const { rows } = await pool.query(
      'SELECT * FROM public.permission_consents WHERE tenant_id = $1 ORDER BY created_at DESC',
      [tenantId]
    )
    res.json({ consents: rows })
  } catch {
    res.json({ consents: [] })
  }
})

router.post('/', requireAdmin, async (req: any, res: Response) => {
  const tenantId: number = req.tenantId
  const adminId: number  = req.adminId
  const { feature, action, granted } = req.body as {
    feature?: string; action?: string; granted?: boolean
  }
  if (!feature || !action || typeof granted !== 'boolean') {
    return res.status(400).json({ error: 'feature, action, and granted are required' })
  }
  try {
    const now = Math.floor(Date.now() / 1000)
    const { rows } = await pool.query(
      `INSERT INTO public.permission_consents
         (tenant_id, admin_id, feature, action, granted, granted_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $6)
       ON CONFLICT (tenant_id, admin_id, feature, action)
       DO UPDATE SET granted = $5, granted_at = CASE WHEN $5 THEN $6 ELSE NULL END,
                     revoked_at = CASE WHEN NOT $5 THEN $6 ELSE NULL END
       RETURNING *`,
      [tenantId, adminId, feature, action, granted, now]
    )
    res.status(201).json({ consent: rows[0] })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/request', requireAdmin, async (req: any, res: Response) => {
  const tenantId: number  = req.tenantId
  const requesterId: number = req.adminId
  const { feature, action, reason } = req.body as {
    feature?: string; action?: string; reason?: string
  }
  if (!feature || !action) {
    return res.status(400).json({ error: 'feature and action are required' })
  }
  try {
    const now = Math.floor(Date.now() / 1000)
    const { rows } = await pool.query(
      `INSERT INTO public.permission_requests
         (tenant_id, requester_id, feature, action, reason, status, created_at)
       VALUES ($1, $2, $3, $4, $5, 'pending', $6)
       RETURNING *`,
      [tenantId, requesterId, feature, action, reason ?? null, now]
    )
    res.status(201).json({ request: rows[0] })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
