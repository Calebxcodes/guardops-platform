import { Router, Request, Response } from 'express'
import { getDb } from '../db/schema'

const router = Router()

router.get('/', (req: Request, res: Response) => {
  const db = getDb()
  const records = db.prepare(`
    SELECT p.*, g.first_name, g.last_name, g.hourly_rate
    FROM payroll_records p
    LEFT JOIN guards g ON g.id = p.guard_id
    ORDER BY p.period_start DESC
  `).all()
  res.json(records)
})

// Generate payroll for a period from approved timesheets
router.post('/generate', (req: Request, res: Response) => {
  const db = getDb()
  const { period_start, period_end } = req.body

  // Get all approved timesheets for period
  const timesheets = db.prepare(`
    SELECT t.*, g.hourly_rate
    FROM timesheets t
    JOIN guards g ON g.id = t.guard_id
    WHERE t.status = 'approved'
    AND t.period_start >= ? AND t.period_end <= ?
  `).all(period_start, period_end) as any[]

  // Group by guard
  const byGuard: Record<number, any> = {}
  for (const ts of timesheets) {
    if (!byGuard[ts.guard_id]) {
      byGuard[ts.guard_id] = {
        guard_id: ts.guard_id,
        hourly_rate: ts.hourly_rate,
        regular_hours: 0,
        overtime_hours: 0,
      }
    }
    byGuard[ts.guard_id].regular_hours += ts.regular_hours
    byGuard[ts.guard_id].overtime_hours += ts.overtime_hours
  }

  const records = []
  for (const guardId of Object.keys(byGuard)) {
    const g = byGuard[Number(guardId)]
    const regular_pay = g.regular_hours * g.hourly_rate
    const overtime_pay = g.overtime_hours * g.hourly_rate * 1.5
    const gross_pay = regular_pay + overtime_pay
    const deductions = gross_pay * 0.1 // 10% tax placeholder
    const net_pay = gross_pay - deductions

    // Check if record already exists
    const existing = db.prepare(`
      SELECT id FROM payroll_records WHERE guard_id = ? AND period_start = ? AND period_end = ?
    `).get(g.guard_id, period_start, period_end)

    if (!existing) {
      const result = db.prepare(`
        INSERT INTO payroll_records (guard_id, period_start, period_end, regular_hours, overtime_hours,
          regular_pay, overtime_pay, bonuses, deductions, gross_pay, net_pay, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 'pending')
      `).run(g.guard_id, period_start, period_end, g.regular_hours, g.overtime_hours,
          regular_pay, overtime_pay, deductions, gross_pay, net_pay)

      records.push(db.prepare('SELECT * FROM payroll_records WHERE id = ?').get(result.lastInsertRowid))
    }
  }
  res.json({ generated: records.length, records })
})

router.put('/:id', (req: Request, res: Response) => {
  const db = getDb()
  const { status, bonuses, deductions } = req.body
  const record = db.prepare('SELECT * FROM payroll_records WHERE id = ?').get(req.params.id) as any
  const newBonuses = bonuses ?? record.bonuses
  const newDeductions = deductions ?? record.deductions
  const gross = record.regular_pay + record.overtime_pay + newBonuses
  const net = gross - newDeductions
  const processedAt = status === 'paid' ? new Date().toISOString() : record.processed_at
  db.prepare(`
    UPDATE payroll_records SET status=?, bonuses=?, deductions=?, gross_pay=?, net_pay=?, processed_at=?
    WHERE id=?
  `).run(status || record.status, newBonuses, newDeductions, gross, net, processedAt, req.params.id)
  res.json(db.prepare('SELECT * FROM payroll_records WHERE id = ?').get(req.params.id))
})

export default router
