import { Router, Request, Response } from 'express'
import { query } from '../db/schema'

const router = Router()

// Shift duration helper: handles overnight shifts correctly
const SHIFT_HOURS = `
  GREATEST(0,
    EXTRACT(EPOCH FROM (
      CASE WHEN end_time < start_time THEN end_time + INTERVAL '1 day' ELSE end_time END
      - start_time
    )) / 3600
  )
`

router.get('/metrics', async (req: Request, res: Response) => {
  const [
    { rows: [{ cnt: guardsOnDuty }] },
    { rows: [{ cnt: totalGuards }] },
    { rows: [{ cnt: uncoveredShifts }] },
    { rows: [{ cnt: todayShifts }] },
    { rows: [{ cnt: pendingTimesheets }] },
    { rows: [revenueData] },
    { rows: [payrollData] },
    { rows: todayShiftList },
    { rows: recentIncidents },
  ] = await Promise.all([
    query(`SELECT COUNT(*)::int as cnt FROM guards WHERE status = 'on-duty' AND active = 1`),
    query(`SELECT COUNT(*)::int as cnt FROM guards WHERE active = 1`),
    query(`SELECT COUNT(*)::int as cnt FROM shifts WHERE status = 'unassigned' AND start_time::date = CURRENT_DATE`),
    query(`SELECT COUNT(*)::int as cnt FROM shifts WHERE start_time::date = CURRENT_DATE AND status != 'cancelled'`),
    query(`SELECT COUNT(*)::int as cnt FROM timesheets WHERE status IN ('draft','submitted')`),
    query(`
      SELECT COALESCE(SUM(${SHIFT_HOURS} * hourly_rate), 0) as revenue
      FROM shifts
      WHERE status IN ('completed','active')
        AND TO_CHAR(start_time, 'YYYY-MM') = TO_CHAR(NOW(), 'YYYY-MM')
    `),
    query(`
      SELECT COALESCE(SUM(gross_pay), 0) as cost FROM payroll_records
      WHERE TO_CHAR(period_start::date, 'YYYY-MM') = TO_CHAR(NOW(), 'YYYY-MM')
    `),
    query(`
      SELECT sh.*, s.name as site_name, g.first_name, g.last_name
      FROM shifts sh
      LEFT JOIN sites s ON s.id = sh.site_id
      LEFT JOIN guards g ON g.id = sh.guard_id
      WHERE sh.start_time::date = CURRENT_DATE AND sh.status != 'cancelled'
      ORDER BY sh.start_time ASC LIMIT 15
    `),
    query(`
      SELECT i.*, s.name as site_name, g.first_name, g.last_name
      FROM incidents i
      LEFT JOIN sites s ON s.id = i.site_id
      LEFT JOIN guards g ON g.id = i.guard_id
      ORDER BY i.created_at DESC LIMIT 5
    `),
  ])

  res.json({
    guards_on_duty: guardsOnDuty,
    total_guards: totalGuards,
    uncovered_shifts: uncoveredShifts,
    today_shifts: todayShifts,
    pending_timesheets: pendingTimesheets,
    revenue_this_month: Math.round(revenueData?.revenue || 0),
    payroll_cost_this_month: Math.round(payrollData?.cost || 0),
    today_shift_list: todayShiftList,
    recent_incidents: recentIncidents,
  })
})

router.get('/financial', async (req: Request, res: Response) => {
  const [
    { rows: monthlyRevenue },
    { rows: revenueByClient },
    { rows: monthlyPayroll },
    { rows: guardUtilization },
  ] = await Promise.all([
    query(`
      SELECT TO_CHAR(start_time, 'YYYY-MM') as month,
        COALESCE(SUM(${SHIFT_HOURS} * hourly_rate), 0) as revenue,
        COUNT(*)::int as shift_count
      FROM shifts WHERE status IN ('completed','active')
        AND start_time >= NOW() - INTERVAL '6 months'
      GROUP BY month ORDER BY month
    `),
    query(`
      SELECT c.name, COALESCE(SUM(${SHIFT_HOURS} * sh.hourly_rate), 0) as revenue
      FROM shifts sh
      JOIN sites s ON s.id = sh.site_id
      JOIN clients c ON c.id = s.client_id
      WHERE sh.status IN ('completed','active')
      GROUP BY c.id, c.name ORDER BY revenue DESC
    `),
    query(`
      SELECT TO_CHAR(period_start::date, 'YYYY-MM') as month, COALESCE(SUM(gross_pay), 0) as cost
      FROM payroll_records WHERE period_start::date >= NOW() - INTERVAL '6 months'
      GROUP BY month ORDER BY month
    `),
    query(`
      SELECT g.first_name || ' ' || g.last_name as name,
        COALESCE(SUM(${SHIFT_HOURS}), 0) as hours_worked
      FROM guards g
      LEFT JOIN shifts sh ON sh.guard_id = g.id
        AND sh.status IN ('completed','active')
        AND sh.start_time >= NOW() - INTERVAL '30 days'
      WHERE g.active = 1
      GROUP BY g.id, g.first_name, g.last_name ORDER BY hours_worked DESC LIMIT 8
    `),
  ])

  res.json({ monthlyRevenue, revenueByClient, monthlyPayroll, guardUtilization })
})

export default router
