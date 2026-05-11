import { Request, Response, NextFunction } from 'express'
import { pool } from '../db/schema'

/**
 * Optional defense-in-depth middleware.
 * If the client sends X-Tenant-Slug, validate that it matches the JWT's tenantId.
 * Mount selectively on routes where you want extra slug-level enforcement.
 * The primary tenant isolation is already enforced via JWT (requireAdmin).
 */
export function validateTenantSlug(req: Request, res: Response, next: NextFunction) {
  const slug = req.headers['x-tenant-slug'] as string | undefined
  const tenantId = (req as any).tenantId as number | undefined

  if (!slug || !tenantId) return next()

  pool.query(
    `SELECT id FROM public.tenants WHERE slug = $1 AND status NOT IN ('deleted', 'archived')`,
    [slug]
  )
    .then(({ rows }) => {
      if (!rows[0]) {
        return res.status(403).json({ error: 'Invalid tenant slug' })
      }
      if (Number(rows[0].id) !== tenantId) {
        return res.status(403).json({ error: 'Tenant slug does not match your session' })
      }
      next()
    })
    .catch(() => next())
}
