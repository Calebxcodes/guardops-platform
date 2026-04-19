import { Router, Request, Response } from 'express'
import { query } from '../db/schema'

const router = Router()

// Reuse the same overnight-safe shift-hours expression as dashboard.ts
const SHIFT_HOURS = `
  GREATEST(0,
    EXTRACT(EPOCH FROM (
      CASE WHEN end_time < start_time THEN end_time + INTERVAL '1 day' ELSE end_time END
      - start_time
    )) / 3600
  )
`

function dateRange(req: Request): { from: string; to: string } {
  const now  = new Date()
  const from = (req.query.from as string) || new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10)
  const to   = (req.query.to   as string) || now.toISOString().slice(0, 10)
  return { from, to }
}

// ── GET /api/analytics/overview ───────────────────────────────────────────────
router.get('/overview', async (req: Request, res: Response) => {
  const { from, to } = dateRange(req)

  const [
    { rows: [rev] },
    { rows: [pay] },
    { rows: [inc] },
    { rows: [shf] },
    { rows: [grd] },
    { rows: [chk] },
  ] = await Promise.all([
    query(`
      SELECT COALESCE(SUM(${SHIFT_HOURS} * hourly_rate), 0) AS total
      FROM shifts WHERE status IN ('completed','active')
        AND start_time::date BETWEEN $1 AND $2
    `, [from, to]),
    query(`
      SELECT COALESCE(SUM(gross_pay), 0) AS total
      FROM payroll_records WHERE period_start::date BETWEEN $1 AND $2
    `, [from, to]),
    query(`
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE resolved = 1)::int AS resolved
      FROM incidents WHERE created_at::date BETWEEN $1 AND $2
    `, [from, to]),
    query(`
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE status IN ('completed','active'))::int AS covered,
             COUNT(*) FILTER (WHERE status = 'unassigned')::int AS uncovered
      FROM shifts
      WHERE start_time::date BETWEEN $1 AND $2 AND status != 'cancelled'
    `, [from, to]),
    query(`
      SELECT COUNT(DISTINCT guard_id)::int AS active
      FROM shifts
      WHERE start_time::date BETWEEN $1 AND $2
        AND status IN ('completed','active') AND guard_id IS NOT NULL
    `, [from, to]),
    query(`
      SELECT
        COUNT(DISTINCT rc.id)::int AS total,
        COUNT(DISTINCT cc.id)::int AS scanned
      FROM route_checkpoints rc
      LEFT JOIN checkpoint_checkins cc ON cc.checkpoint_id = rc.id
        AND cc.created_at::date BETWEEN $1 AND $2
    `, [from, to]),
  ])

  const revenue = Math.round(rev?.total || 0)
  const payroll = Math.round(pay?.total || 0)
  const profit  = revenue - payroll

  res.json({
    revenue,
    payroll,
    profit,
    margin:              revenue > 0 ? Math.round((profit / revenue) * 100) : 0,
    incidents:           inc?.total    || 0,
    incidents_resolved:  inc?.resolved || 0,
    shifts_total:        shf?.total    || 0,
    shifts_uncovered:    shf?.uncovered || 0,
    coverage_rate:       shf?.total > 0 ? Math.round((shf.covered / shf.total) * 100) : 100,
    active_guards:       grd?.active   || 0,
    checkpoint_scans:    chk?.scanned  || 0,
  })
})

// ── GET /api/analytics/revenue ────────────────────────────────────────────────
router.get('/revenue', async (req: Request, res: Response) => {
  const { from, to } = dateRange(req)

  const [{ rows: daily }, { rows: byClient }, { rows: bySite }] = await Promise.all([
    query(`
      SELECT TO_CHAR(start_time, 'YYYY-MM-DD') AS date,
             COALESCE(SUM(${SHIFT_HOURS} * hourly_rate), 0)::int AS revenue,
             COUNT(*)::int AS shifts
      FROM shifts
      WHERE status IN ('completed','active')
        AND start_time::date BETWEEN $1 AND $2
      GROUP BY date ORDER BY date
    `, [from, to]),
    query(`
      SELECT c.name,
             COALESCE(SUM(${SHIFT_HOURS} * sh.hourly_rate), 0)::int AS revenue,
             COUNT(DISTINCT sh.id)::int AS shifts
      FROM shifts sh
      JOIN sites s  ON s.id = sh.site_id
      JOIN clients c ON c.id = s.client_id
      WHERE sh.status IN ('completed','active')
        AND sh.start_time::date BETWEEN $1 AND $2
      GROUP BY c.id, c.name ORDER BY revenue DESC
    `, [from, to]),
    query(`
      SELECT s.name,
             COALESCE(SUM(${SHIFT_HOURS} * sh.hourly_rate), 0)::int AS revenue,
             COUNT(DISTINCT sh.id)::int AS shifts,
             ROUND(COALESCE(SUM(${SHIFT_HOURS}), 0)::numeric, 1)::float AS hours
      FROM shifts sh
      JOIN sites s ON s.id = sh.site_id
      WHERE sh.status IN ('completed','active')
        AND sh.start_time::date BETWEEN $1 AND $2
      GROUP BY s.id, s.name ORDER BY revenue DESC LIMIT 10
    `, [from, to]),
  ])

  res.json({ daily, byClient, bySite })
})

// ── GET /api/analytics/workforce ──────────────────────────────────────────────
router.get('/workforce', async (req: Request, res: Response) => {
  const { from, to } = dateRange(req)

  const [{ rows: byGuard }, { rows: daily }, { rows: overtime }] = await Promise.all([
    query(`
      SELECT g.first_name || ' ' || g.last_name AS name,
             ROUND(COALESCE(SUM(${SHIFT_HOURS}), 0)::numeric, 1)::float AS hours,
             COUNT(sh.id)::int AS shifts,
             COUNT(sh.id) FILTER (WHERE sh.status = 'completed')::int AS completed,
             ROUND(COALESCE(SUM(GREATEST(0, ${SHIFT_HOURS} - 8)), 0)::numeric, 1)::float AS overtime_hours
      FROM guards g
      LEFT JOIN shifts sh ON sh.guard_id = g.id
        AND sh.start_time::date BETWEEN $1 AND $2
        AND sh.status IN ('completed','active')
      WHERE g.active = 1
      GROUP BY g.id, g.first_name, g.last_name
      ORDER BY hours DESC
    `, [from, to]),
    query(`
      SELECT TO_CHAR(start_time, 'YYYY-MM-DD') AS date,
             COUNT(DISTINCT guard_id)::int AS guards_deployed,
             COUNT(*)::int AS shifts
      FROM shifts
      WHERE status IN ('completed','active')
        AND start_time::date BETWEEN $1 AND $2
        AND guard_id IS NOT NULL
      GROUP BY date ORDER BY date
    `, [from, to]),
    query(`
      SELECT g.first_name || ' ' || g.last_name AS name,
             ROUND(SUM(GREATEST(0, ${SHIFT_HOURS} - 8))::numeric, 1)::float AS overtime_hours,
             COUNT(*)::int AS overtime_shifts
      FROM guards g
      JOIN shifts sh ON sh.guard_id = g.id
        AND sh.start_time::date BETWEEN $1 AND $2
        AND sh.status IN ('completed','active')
        AND ${SHIFT_HOURS} > 8
      WHERE g.active = 1
      GROUP BY g.id, g.first_name, g.last_name
      HAVING SUM(GREATEST(0, ${SHIFT_HOURS} - 8)) > 0
      ORDER BY overtime_hours DESC LIMIT 8
    `, [from, to]),
  ])

  res.json({ byGuard, daily, overtime })
})

// ── GET /api/analytics/sites ──────────────────────────────────────────────────
router.get('/sites', async (req: Request, res: Response) => {
  const { from, to } = dateRange(req)

  const { rows } = await query(`
    SELECT s.name AS site,
           c.name AS client,
           COUNT(DISTINCT sh.id)::int AS total_shifts,
           COUNT(DISTINCT sh.id) FILTER (WHERE sh.status IN ('completed','active'))::int AS covered_shifts,
           COUNT(DISTINCT sh.id) FILTER (WHERE sh.status = 'unassigned')::int AS uncovered_shifts,
           COALESCE(SUM(${SHIFT_HOURS} * sh.hourly_rate), 0)::int AS revenue,
           ROUND(COALESCE(SUM(${SHIFT_HOURS}), 0)::numeric, 1)::float AS hours,
           COUNT(DISTINCT i.id)::int AS incidents,
           COUNT(DISTINCT cc.id)::int AS checkpoint_scans
    FROM sites s
    LEFT JOIN clients c ON c.id = s.client_id
    LEFT JOIN shifts sh ON sh.site_id = s.id
      AND sh.start_time::date BETWEEN $1 AND $2
      AND sh.status != 'cancelled'
    LEFT JOIN incidents i ON i.site_id = s.id
      AND i.created_at::date BETWEEN $1 AND $2
    LEFT JOIN checkpoint_checkins cc ON cc.shift_id = sh.id
    WHERE s.active = 1
    GROUP BY s.id, s.name, c.name
    ORDER BY revenue DESC
  `, [from, to])

  res.json(rows.map((r: any) => ({
    ...r,
    coverage_rate: r.total_shifts > 0
      ? Math.round((r.covered_shifts / r.total_shifts) * 100) : 100,
  })))
})

// ── GET /api/analytics/incidents ──────────────────────────────────────────────
router.get('/incidents', async (req: Request, res: Response) => {
  const { from, to } = dateRange(req)

  const [{ rows: byType }, { rows: bySeverity }, { rows: daily }, { rows: bySite }] = await Promise.all([
    query(`
      SELECT type, COUNT(*)::int AS count,
             COUNT(*) FILTER (WHERE resolved = 1)::int AS resolved
      FROM incidents WHERE created_at::date BETWEEN $1 AND $2
      GROUP BY type ORDER BY count DESC
    `, [from, to]),
    query(`
      SELECT severity, COUNT(*)::int AS count
      FROM incidents WHERE created_at::date BETWEEN $1 AND $2
      GROUP BY severity ORDER BY count DESC
    `, [from, to]),
    query(`
      SELECT TO_CHAR(created_at, 'YYYY-MM-DD') AS date, COUNT(*)::int AS count
      FROM incidents WHERE created_at::date BETWEEN $1 AND $2
      GROUP BY date ORDER BY date
    `, [from, to]),
    query(`
      SELECT s.name AS site, COUNT(i.id)::int AS count,
             COUNT(i.id) FILTER (WHERE i.resolved = 1)::int AS resolved
      FROM incidents i
      JOIN sites s ON s.id = i.site_id
      WHERE i.created_at::date BETWEEN $1 AND $2
      GROUP BY s.id, s.name ORDER BY count DESC LIMIT 8
    `, [from, to]),
  ])

  res.json({ byType, bySeverity, daily, bySite })
})

export default router
