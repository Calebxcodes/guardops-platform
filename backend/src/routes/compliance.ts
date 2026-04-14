import { Router, Request, Response } from 'express'
import { query } from '../db/schema'

const router = Router()

router.get('/sia', async (req: Request, res: Response) => {
  const { rows: guards } = await query(`
    SELECT g.id, g.first_name, g.last_name, g.email, g.phone, g.status,
           g.certifications, g.active
    FROM guards g WHERE g.active = 1
    ORDER BY g.last_name, g.first_name
  `) as { rows: any[] }

  // Exact set of valid SIA licence types (matches the dropdown in GuardForm)
  const SIA_LICENCE_TYPES = new Set([
    'door supervisor',
    'security guard',
    'cctv operator (public space surveillance)',
    'close protection officer',
    'cash and valuables in transit guard',
    'key holder',
    'vehicle immobiliser',
    'maritime security guard',
    'first aid at work certificate',
    'emergency first response',
    'level 2 award for door supervisors',
    'level 3 award for close protection',
    'counter terrorism awareness certificate',
    'sia approved contractor scheme (acs)',
    'national cctv viewer certificate',
  ])

  const today = new Date()
  const result = guards.map(g => {
    const certs = JSON.parse(g.certifications || '[]')

    // Find all certs that match a recognised SIA licence type
    const siaCerts: any[] = certs.filter((c: any) =>
      SIA_LICENCE_TYPES.has(c.name?.toLowerCase().trim() || '')
    )

    // Pick the cert with the latest expiry (most favourable) — falls back to first match
    const siaCert = siaCerts.length === 0 ? null
      : siaCerts.reduce((best: any, c: any) => {
          if (!best) return c
          if (!best.expiry) return c
          if (!c.expiry) return best
          return new Date(c.expiry) > new Date(best.expiry) ? c : best
        }, null)
    const expiry = siaCert?.expiry ? new Date(siaCert.expiry) : null
    const daysLeft = expiry ? Math.floor((expiry.getTime() - today.getTime()) / 86400000) : null

    let siaStatus: 'valid' | 'expiring_soon' | 'expired' | 'missing' = 'missing'
    if (siaCert) {
      if (!expiry) {
        // Cert is on file but no expiry recorded — treat as valid (no-expiry cert)
        siaStatus = 'valid'
      } else if (daysLeft! < 0) {
        siaStatus = 'expired'
      } else if (daysLeft! <= 90) {
        siaStatus = 'expiring_soon'
      } else {
        siaStatus = 'valid'
      }
    }

    return {
      id: g.id,
      name: `${g.first_name} ${g.last_name}`,
      email: g.email,
      phone: g.phone,
      status: g.status,
      sia_cert_name: siaCert?.name || null,
      sia_licence_number: siaCert?.licence_number || null,
      sia_expiry: siaCert?.expiry || null,
      days_until_expiry: daysLeft,
      sia_status: siaStatus,
      all_certs: certs,
    }
  })

  const summary = {
    total: result.length,
    valid: result.filter(r => r.sia_status === 'valid').length,
    expiring_soon: result.filter(r => r.sia_status === 'expiring_soon').length,
    expired: result.filter(r => r.sia_status === 'expired').length,
    missing: result.filter(r => r.sia_status === 'missing').length,
  }

  res.json({ summary, officers: result })
})

router.get('/audit/:siteId', async (req: Request, res: Response) => {
  const { rows } = await query(`
    SELECT s.*, c.name as client_name, c.contact_name, c.contact_email
    FROM sites s LEFT JOIN clients c ON c.id = s.client_id
    WHERE s.id = $1
  `, [req.params.siteId])
  const site = rows[0]
  if (!site) return res.status(404).json({ error: 'Site not found' })

  const [
    { rows: assignedGuards },
    { rows: recentIncidents },
    { rows: activeShifts },
  ] = await Promise.all([
    query(`
      SELECT DISTINCT g.first_name, g.last_name, g.email, g.certifications, g.status
      FROM shifts sh JOIN guards g ON g.id = sh.guard_id
      WHERE sh.site_id = $1 AND sh.status IN ('active','assigned','completed')
      ORDER BY g.last_name
    `, [req.params.siteId]),
    query(`
      SELECT i.*, g.first_name, g.last_name
      FROM incidents i LEFT JOIN guards g ON g.id = i.guard_id
      WHERE i.site_id = $1
      ORDER BY i.created_at DESC LIMIT 10
    `, [req.params.siteId]),
    query(`
      SELECT sh.*, g.first_name, g.last_name
      FROM shifts sh LEFT JOIN guards g ON g.id = sh.guard_id
      WHERE sh.site_id = $1 AND sh.status IN ('active','assigned')
      ORDER BY sh.start_time
    `, [req.params.siteId]),
  ])

  res.json({
    site,
    assigned_guards: assignedGuards.map((g: any) => ({
      ...g,
      certifications: JSON.parse(g.certifications || '[]')
    })),
    recent_incidents: recentIncidents,
    active_shifts: activeShifts,
    generated_at: new Date().toISOString(),
  })
})

export default router
