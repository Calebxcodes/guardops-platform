import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

// Every statement the routes run, with a per-test responder.
const calls: { sql: string; params: any[] }[] = []
let respond: (sql: string, params: any[]) => any[] = () => []

vi.mock('../db/schema', () => ({
  query: vi.fn(async (sql: string, params: any[] = []) => {
    calls.push({ sql, params })
    return { rows: respond(sql, params), rowCount: 0 }
  }),
  auditLog: vi.fn(),
}))
vi.mock('../middleware/auth', () => ({
  requireAuth: (req: any, _res: any, next: any) => { req.guardId = 7; next() },
}))
vi.mock('../middleware/rbac', () => ({ requirePermission: () => (_req: any, _res: any, next: any) => next() }))
vi.mock('../services/sse', () => ({ pushToAdmins: vi.fn() }))
vi.mock('../services/push', () => ({ notifyGuard: vi.fn(async () => {}) }))

import guardShifts from '../routes/guardShifts'
import payroll from '../routes/payroll'
import { autoClockoutTime, hoursBetween } from '../services/autoClockout'

const app = express()
app.use(express.json())
app.use('/guard/shifts', guardShifts)
app.use('/payroll', payroll)

const HOUR = 3600_000

beforeEach(() => {
  calls.length = 0
  respond = () => []
})

describe('clock events use the server clock, not the client', () => {
  const shift = { id: 1, guard_id: 7, status: 'scheduled', start_time: new Date(Date.now() - 4 * HOUR).toISOString(), geofence_radius: 183 }

  it('clock-in ignores clocked_at and keeps it only as client_reported_at', async () => {
    respond = sql => sql.includes('FROM shifts sh JOIN sites') ? [shift] : sql.includes('face_descriptor') ? [{ face_descriptor: '[0.1]' }] : []
    const claimed = new Date(Date.now() - 10 * HOUR).toISOString()
    const before = Date.now()
    const res = await request(app).post('/guard/shifts/clock-in').send({ shift_id: 1, face_verified: true, clocked_at: claimed })
    expect(res.status).toBe(200)
    const insert = calls.find(c => c.sql.includes('INSERT INTO clock_events'))!
    const recorded = new Date(insert.params[7]).getTime()
    expect(recorded).toBeGreaterThanOrEqual(before)
    expect(recorded).toBeLessThanOrEqual(Date.now())
    expect(insert.params[8]).toBe(claimed)
  })

  it('clock-out ignores a future clocked_at: a 4h shift records 4h, not 20h', async () => {
    const clockIn = new Date(Date.now() - 4 * HOUR).toISOString()
    respond = sql =>
      sql.includes('FROM shifts sh JOIN sites') ? [{ ...shift, status: 'active' }] :
      sql.includes('SELECT status FROM guards') ? [{ status: 'on-duty' }] :
      sql.includes('face_descriptor') ? [{ face_descriptor: '[0.1]' }] :
      sql.includes("type = 'clock_in'") ? [{ created_at: clockIn }] : []
    const res = await request(app).post('/guard/shifts/clock-out')
      .send({ shift_id: 1, face_verified: true, clocked_at: new Date(Date.now() + 25 * HOUR).toISOString() })
    expect(res.status).toBe(200)
    expect(res.body.hours_worked).toBeCloseTo(4, 1)
    const ts = calls.find(c => c.sql.includes('INSERT INTO timesheets'))!
    expect(ts.params[6]).toBeCloseTo(4, 1)
  })

  it('clocking out before the shift start records 0 hours, not negative', async () => {
    respond = sql =>
      sql.includes('FROM shifts sh JOIN sites') ? [{ ...shift, status: 'active' }] :
      sql.includes('SELECT status FROM guards') ? [{ status: 'on-duty' }] :
      sql.includes('face_descriptor') ? [{ face_descriptor: '[0.1]' }] :
      sql.includes("type = 'clock_in'") ? [{ created_at: new Date(Date.now() + HOUR).toISOString() }] : []
    const res = await request(app).post('/guard/shifts/clock-out').send({ shift_id: 1, face_verified: true })
    expect(res.body.hours_worked).toBe(0)
  })
})

describe('payroll pays the site guard rate', () => {
  it('prices each timesheet at its site guard rate (4h at £13 = £52)', async () => {
    respond = sql => sql.includes('FROM timesheets t') ? [{ id: 1, guard_id: 7, regular_hours: 4, overtime_hours: 0, site_id: 3, site_name: 'S', site_guard_rate: 13 }] : []
    const res = await request(app).post('/payroll/generate').send({ period_start: '2026-10-01', period_end: '2026-10-31' })
    expect(res.status).toBe(200)
    const insert = calls.find(c => c.sql.includes('INSERT INTO payroll_records'))!
    expect(insert.params[5]).toBe(52)   // regular_pay
    expect(insert.params[6]).toBe(0)    // overtime_pay
  })

  it('mixes sites and overtime correctly per timesheet', async () => {
    respond = sql => sql.includes('FROM timesheets t') ? [
      { id: 1, guard_id: 7, regular_hours: 8, overtime_hours: 2, site_id: 3, site_name: 'A', site_guard_rate: 12 },
      { id: 2, guard_id: 7, regular_hours: 5, overtime_hours: 0, site_id: 4, site_name: 'B', site_guard_rate: 15 },
    ] : []
    await request(app).post('/payroll/generate').send({ period_start: '2026-10-01', period_end: '2026-10-31' })
    const insert = calls.find(c => c.sql.includes('INSERT INTO payroll_records'))!
    expect(insert.params[5]).toBe(8 * 12 + 5 * 15)
    expect(insert.params[6]).toBe(2 * 12 * 1.5)
  })

  it('refuses to generate when a timesheet has no site guard rate', async () => {
    respond = sql => sql.includes('FROM timesheets t') ? [{ id: 9, guard_id: 7, regular_hours: 4, overtime_hours: 0, site_id: 3, site_name: 'No rate', site_guard_rate: 0 }] : []
    const res = await request(app).post('/payroll/generate').send({ period_start: '2026-10-01', period_end: '2026-10-31' })
    expect(res.status).toBe(422)
    expect(res.body.unpriced[0].timesheet_id).toBe(9)
    expect(calls.some(c => c.sql.includes('INSERT INTO payroll_records'))).toBe(false)
  })

  it('pays a timesheet at most once: only unlinked timesheets, linked in the same statement', async () => {
    respond = sql => sql.includes('FROM timesheets t') ? [
      { id: 1, guard_id: 7, regular_hours: 4, overtime_hours: 0, site_id: 3, site_name: 'A', site_guard_rate: 13 },
      { id: 2, guard_id: 7, regular_hours: 2, overtime_hours: 0, site_id: 3, site_name: 'A', site_guard_rate: 13 },
    ] : []
    await request(app).post('/payroll/generate').send({ period_start: '2026-10-01', period_end: '2026-10-31' })
    expect(calls.find(c => c.sql.includes('FROM timesheets t'))!.sql).toMatch(/payroll_record_id IS NULL/)
    const insert = calls.find(c => c.sql.includes('INSERT INTO payroll_records'))!
    expect(insert.sql).toMatch(/UPDATE timesheets SET payroll_record_id/)
    expect(insert.params[10]).toEqual([1, 2])
  })

  it('does not read the hidden guards.hourly_rate', async () => {
    await request(app).post('/payroll/generate').send({ period_start: '2026-10-01', period_end: '2026-10-31' })
    expect(calls.find(c => c.sql.includes('FROM timesheets t'))!.sql).not.toMatch(/g\.hourly_rate/)
  })
})

describe('auto clock-out pays up to the scheduled end', () => {
  it('a job running 15 days late does not add 15 days of hours', () => {
    const clockIn = new Date('2026-05-18T00:18:12Z')
    const end = autoClockoutTime('2026-05-18T07:30:00Z', new Date('2026-06-02T08:00:00Z'))
    expect(end.toISOString()).toBe('2026-05-18T07:30:00.000Z')
    expect(hoursBetween(clockIn, end)).toBe(7.2)
  })

  it('never produces negative hours', () => {
    expect(hoursBetween(new Date('2026-01-01T10:00:00Z'), new Date('2026-01-01T09:00:00Z'))).toBe(0)
  })
})
