import { Router, Request, Response } from 'express'
import { query } from '../db/schema'
import { notifyGuard } from '../services/push'

const router = Router()

router.get('/', async (req: Request, res: Response) => {
  const page  = Math.max(1, parseInt(req.query.page  as string) || 1)
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50))
  const offset = (page - 1) * limit

  const { rows: [{ total }] } = await query(`SELECT COUNT(*)::int as total FROM payroll_records`)
  const { rows } = await query(`
    SELECT p.*, g.first_name, g.last_name, g.hourly_rate
    FROM payroll_records p
    LEFT JOIN guards g ON g.id = p.guard_id
    ORDER BY p.period_start DESC
    LIMIT $1 OFFSET $2
  `, [limit, offset])
  res.json({ data: rows, total, page, limit, pages: Math.ceil(total / limit) })
})

router.post('/generate', async (req: Request, res: Response) => {
  const { period_start, period_end, tax_rate } = req.body

  // Validate date format (YYYY-MM-DD)
  const dateRe = /^\d{4}-\d{2}-\d{2}$/
  if (!period_start || !period_end)
    return res.status(400).json({ error: 'period_start and period_end are required' })
  if (!dateRe.test(period_start) || !dateRe.test(period_end))
    return res.status(400).json({ error: 'Dates must be in YYYY-MM-DD format' })
  const startD = new Date(period_start), endD = new Date(period_end)
  if (isNaN(startD.getTime()) || isNaN(endD.getTime()))
    return res.status(400).json({ error: 'Invalid date values' })
  if (startD >= endD)
    return res.status(400).json({ error: 'period_start must be before period_end' })

  // Validate tax rate
  if (tax_rate !== undefined && (typeof tax_rate !== 'number' || tax_rate < 0 || tax_rate > 100))
    return res.status(400).json({ error: 'tax_rate must be a number between 0 and 100' })
  const deductionRate = typeof tax_rate === 'number' ? tax_rate / 100 : 0.1

  const { rows: timesheets } = await query(`
    SELECT t.*, g.hourly_rate
    FROM timesheets t
    JOIN guards g ON g.id = t.guard_id
    WHERE t.status = 'approved'
    AND t.period_start >= $1 AND t.period_end <= $2
  `, [period_start, period_end]) as { rows: any[] }

  // Group by guard
  const byGuard: Record<number, any> = {}
  for (const ts of timesheets) {
    if (!byGuard[ts.guard_id]) {
      byGuard[ts.guard_id] = { guard_id: ts.guard_id, hourly_rate: ts.hourly_rate, regular_hours: 0, overtime_hours: 0 }
    }
    byGuard[ts.guard_id].regular_hours  += ts.regular_hours
    byGuard[ts.guard_id].overtime_hours += ts.overtime_hours
  }

  const records: any[] = []
  for (const guardId of Object.keys(byGuard)) {
    const g = byGuard[Number(guardId)]
    const regular_pay  = g.regular_hours  * g.hourly_rate
    const overtime_pay = g.overtime_hours * g.hourly_rate * 1.5
    const gross_pay    = regular_pay + overtime_pay
    const deductions   = gross_pay * deductionRate
    const net_pay      = gross_pay - deductions

    const { rows: existing } = await query(
      `SELECT id FROM payroll_records WHERE guard_id = $1 AND period_start = $2 AND period_end = $3`,
      [g.guard_id, period_start, period_end]
    )

    if (!existing[0]) {
      const { rows } = await query(`
        INSERT INTO payroll_records (guard_id, period_start, period_end, regular_hours, overtime_hours,
          regular_pay, overtime_pay, bonuses, deductions, gross_pay, net_pay, status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,0,$8,$9,$10,'pending') RETURNING *
      `, [g.guard_id, period_start, period_end, g.regular_hours, g.overtime_hours,
          regular_pay, overtime_pay, deductions, gross_pay, net_pay])
      records.push(rows[0])
    }
  }
  res.json({ generated: records.length, records })
})

router.put('/:id', async (req: Request, res: Response) => {
  const { status, bonuses, deductions } = req.body
  const { rows: existing } = await query('SELECT * FROM payroll_records WHERE id = $1', [req.params.id])
  const record = existing[0]
  const newBonuses    = bonuses    ?? record.bonuses
  const newDeductions = deductions ?? record.deductions
  const gross = record.regular_pay + record.overtime_pay + newBonuses
  const net   = gross - newDeductions
  const processedAt = status === 'paid' ? new Date().toISOString() : record.processed_at
  await query(`
    UPDATE payroll_records SET status=$1, bonuses=$2, deductions=$3, gross_pay=$4, net_pay=$5, processed_at=$6
    WHERE id=$7
  `, [status || record.status, newBonuses, newDeductions, gross, net, processedAt, req.params.id])
  const { rows } = await query('SELECT * FROM payroll_records WHERE id = $1', [req.params.id])
  const updated = rows[0]
  // Notify guard when payslip is marked as paid
  if ((status === 'paid' || status === 'approved') && record.status !== status) {
    notifyGuard(updated.guard_id, {
      title: status === 'paid' ? 'Pay Processed' : 'Payslip Approved',
      body: status === 'paid'
        ? `Your payment of £${updated.net_pay.toFixed(2)} for ${updated.period_start} – ${updated.period_end} has been processed`
        : `Your timesheet for ${updated.period_start} – ${updated.period_end} has been approved`,
      url: '/timesheet',
      tag: `payroll-${updated.id}`,
      urgency: 'normal',
    }, { email: true }).catch(() => {})
  }
  res.json(updated)
})

export default router
