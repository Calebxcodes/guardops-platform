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

  const today = new Date()
  const result = guards.map(g => {
    const certs = JSON.parse(g.certifications || '[]')
    const siaCert = certs.find((c: any) =>
      c.name?.toLowerCase().includes('sia') ||
      c.name?.toLowerCase().includes('door supervisor') ||
      c.name?.toLowerCase().includes('security guard license') ||
      c.name?.toLowerCase().includes('security guard licence')
    )
    const expiry = siaCert?.expiry ? new Date(siaCert.expiry) : null
    const daysLeft = expiry ? Math.floor((expiry.getTime() - today.getTime()) / 86400000) : null

    let siaStatus: 'valid' | 'expiring_soon' | 'expired' | 'missing' = 'missing'
    if (expiry) {
      if (daysLeft! < 0) siaStatus = 'expired'
      else if (daysLeft! <= 90) siaStatus = 'expiring_soon'
      else siaStatus = 'valid'
    }

    return {
      id: g.id,
      name: `${g.first_name} ${g.last_name}`,
      email: g.email,
      phone: g.phone,
      status: g.status,
      sia_cert_name: siaCert?.name || null,
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
