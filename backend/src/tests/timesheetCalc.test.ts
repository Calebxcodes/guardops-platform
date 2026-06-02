import { describe, it, expect } from 'vitest'

// Core timesheet calculation logic extracted for unit testing
function calcHours(clockIn: Date, clockOut: Date) {
  const msWorked = clockOut.getTime() - clockIn.getTime()
  const hoursWorked = Math.round((msWorked / 3600000) * 100) / 100
  return {
    total: hoursWorked,
    regular: Math.min(hoursWorked, 8),
    overtime: Math.max(0, hoursWorked - 8),
  }
}

function buildTimesheetRecord(guardId: number, shiftId: number, clockIn: Date, clockOut: Date, source: string) {
  const { total, regular, overtime } = calcHours(clockIn, clockOut)
  const today = clockOut.toISOString().split('T')[0]
  return {
    guard_id: guardId,
    shift_id: shiftId,
    period_start: today,
    period_end: today,
    regular_hours: regular,
    overtime_hours: overtime,
    total_hours: total,
    status: 'submitted',
    source,
  }
}

describe('Timesheet Hour Calculations', () => {
  it('calculates an exact 8-hour shift', () => {
    const clockIn  = new Date('2024-01-15T08:00:00Z')
    const clockOut = new Date('2024-01-15T16:00:00Z')
    const r = calcHours(clockIn, clockOut)
    expect(r.total).toBe(8)
    expect(r.regular).toBe(8)
    expect(r.overtime).toBe(0)
  })

  it('calculates a 12-hour shift with 4h overtime', () => {
    const clockIn  = new Date('2024-01-15T08:00:00Z')
    const clockOut = new Date('2024-01-15T20:00:00Z')
    const r = calcHours(clockIn, clockOut)
    expect(r.total).toBe(12)
    expect(r.regular).toBe(8)
    expect(r.overtime).toBe(4)
  })

  it('calculates a part-time 3.5h shift with no overtime', () => {
    const clockIn  = new Date('2024-01-15T09:00:00Z')
    const clockOut = new Date('2024-01-15T12:30:00Z')
    const r = calcHours(clockIn, clockOut)
    expect(r.total).toBe(3.5)
    expect(r.regular).toBe(3.5)
    expect(r.overtime).toBe(0)
  })

  it('calculates a midnight-crossing 10h night shift', () => {
    const clockIn  = new Date('2024-01-15T22:00:00Z')
    const clockOut = new Date('2024-01-16T08:00:00Z')
    const r = calcHours(clockIn, clockOut)
    expect(r.total).toBe(10)
    expect(r.regular).toBe(8)
    expect(r.overtime).toBe(2)
  })

  it('regular hours never exceed 8', () => {
    const clockIn  = new Date('2024-01-15T00:00:00Z')
    const clockOut = new Date('2024-01-15T23:59:00Z')
    const r = calcHours(clockIn, clockOut)
    expect(r.regular).toBeLessThanOrEqual(8)
    expect(r.overtime).toBeGreaterThan(0)
    expect(Math.abs(r.regular + r.overtime - r.total)).toBeLessThan(0.01)
  })

  it('auto clock-out timesheet has status=submitted and source=auto_clockout', () => {
    const rec = buildTimesheetRecord(
      1, 100,
      new Date('2024-01-15T08:00:00Z'),
      new Date('2024-01-15T16:00:00Z'),
      'auto_clockout'
    )
    expect(rec.status).toBe('submitted')
    expect(rec.source).toBe('auto_clockout')
  })

  it('manual clock-out timesheet has status=submitted', () => {
    const rec = buildTimesheetRecord(
      1, 100,
      new Date('2024-01-15T08:00:00Z'),
      new Date('2024-01-15T16:00:00Z'),
      'clock_out'
    )
    expect(rec.status).toBe('submitted')
    expect(rec.source).toBe('clock_out')
  })

  it('period_start and period_end match the clock-out date', () => {
    const clockOut = new Date('2024-03-20T16:00:00Z')
    const rec = buildTimesheetRecord(1, 5, new Date('2024-03-20T08:00:00Z'), clockOut, 'clock_out')
    expect(rec.period_start).toBe('2024-03-20')
    expect(rec.period_end).toBe('2024-03-20')
  })

  it('total_hours = regular + overtime', () => {
    const hours = [6, 8, 10, 12, 14]
    for (const h of hours) {
      const clockIn  = new Date('2024-01-15T00:00:00Z')
      const clockOut = new Date(clockIn.getTime() + h * 3600000)
      const r = calcHours(clockIn, clockOut)
      expect(Math.abs(r.regular + r.overtime - r.total)).toBeLessThan(0.01)
    }
  })
})
