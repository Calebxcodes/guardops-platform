import { Router, Request, Response } from 'express'
import { getDb } from '../db/schema'

const router = Router()

router.get('/metrics', (req: Request, res: Response) => {
  const db = getDb()

  const guardsOnDuty = (db.prepare(`SELECT COUNT(*) as cnt FROM guards WHERE status = 'on-duty' AND active = 1`).get() as any).cnt
  const totalGuards = (db.prepare(`SELECT COUNT(*) as cnt FROM guards WHERE active = 1`).get() as any).cnt
  const uncoveredShifts = (db.prepare(`SELECT COUNT(*) as cnt FROM shifts WHERE status = 'unassigned' AND date(start_time) = date('now')`).get() as any).cnt
  const todayShifts = (db.prepare(`SELECT COUNT(*) as cnt FROM shifts WHERE date(start_time) = date('now') AND status != 'cancelled'`).get() as any).cnt
  const pendingTimesheets = (db.prepare(`SELECT COUNT(*) as cnt FROM timesheets WHERE status IN ('draft','submitted')`).get() as any).cnt

  // Revenue this month (completed shifts * rate * hours)
  const revenueData = db.prepare(`
    SELECT SUM((julianday(end_time) - julianday(start_time)) * 24 * hourly_rate) as revenue
    FROM shifts
    WHERE status IN ('completed','active') AND strftime('%Y-%m', start_time) = strftime('%Y-%m', 'now')
  `).get() as any

  // Payroll cost this month
  const payrollData = db.prepare(`
    SELECT SUM(gross_pay) as cost FROM payroll_records
    WHERE strftime('%Y-%m', period_start) = strftime('%Y-%m', 'now')
  `).get() as any

  // Today's shifts with guard info
  const todayShiftList = db.prepare(`
    SELECT sh.*, s.name as site_name, g.first_name, g.last_name
    FROM shifts sh
    LEFT JOIN sites s ON s.id = sh.site_id
    LEFT JOIN guards g ON g.id = sh.guard_id
    WHERE date(sh.start_time) = date('now') AND sh.status != 'cancelled'
    ORDER BY sh.start_time ASC
    LIMIT 15
  `).all()

  // Recent incidents
  const recentIncidents = db.prepare(`
    SELECT i.*, s.name as site_name, g.first_name, g.last_name
    FROM incidents i
    LEFT JOIN sites s ON s.id = i.site_id
    LEFT JOIN guards g ON g.id = i.guard_id
    ORDER BY i.created_at DESC LIMIT 5
  `).all()

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

router.get('/financial', (req: Request, res: Response) => {
  const db = getDb()

  // Monthly revenue for last 6 months
  const monthlyRevenue = db.prepare(`
    SELECT strftime('%Y-%m', start_time) as month,
      SUM((julianday(end_time) - julianday(start_time)) * 24 * hourly_rate) as revenue,
      COUNT(*) as shift_count
    FROM shifts WHERE status IN ('completed','active')
    AND start_time >= date('now', '-6 months')
    GROUP BY month ORDER BY month
  `).all()

  // Revenue by client
  const revenueByClient = db.prepare(`
    SELECT c.name, SUM((julianday(sh.end_time) - julianday(sh.start_time)) * 24 * sh.hourly_rate) as revenue
    FROM shifts sh
    JOIN sites s ON s.id = sh.site_id
    JOIN clients c ON c.id = s.client_id
    WHERE sh.status IN ('completed','active')
    GROUP BY c.id ORDER BY revenue DESC
  `).all()

  // Payroll by month
  const monthlyPayroll = db.prepare(`
    SELECT strftime('%Y-%m', period_start) as month, SUM(gross_pay) as cost
    FROM payroll_records WHERE period_start >= date('now', '-6 months')
    GROUP BY month ORDER BY month
  `).all()

  // Guard utilization
  const guardUtilization = db.prepare(`
    SELECT g.first_name || ' ' || g.last_name as name,
      SUM((julianday(sh.end_time) - julianday(sh.start_time)) * 24) as hours_worked
    FROM guards g
    LEFT JOIN shifts sh ON sh.guard_id = g.id AND sh.status IN ('completed','active')
      AND sh.start_time >= date('now', '-30 days')
    WHERE g.active = 1
    GROUP BY g.id ORDER BY hours_worked DESC LIMIT 8
  `).all()

  res.json({ monthlyRevenue, revenueByClient, monthlyPayroll, guardUtilization })
})

export default router
