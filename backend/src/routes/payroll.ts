import { Router, Request, Response } from 'express'
import { query } from '../db/schema'

const router = Router()

router.get('/', async (req: Request, res: Response) => {
  const { rows } = await query(`
    SELECT p.*, g.first_name, g.last_name, g.hourly_rate
    FROM payroll_records p
    LEFT JOIN guards g ON g.id = p.guard_id
    ORDER BY p.period_start DESC
  `)
  res.json(rows)
})

router.post('/generate', async (req: Request, res: Response) => {
  const { period_start, period_end } = req.body

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
    const deductions   = gross_pay * 0.1
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
  res.json(rows[0])
})

export default router
