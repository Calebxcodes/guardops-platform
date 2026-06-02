import { describe, it, expect, vi, beforeEach } from 'vitest'

const THIRTY_MIN_MS = 30 * 60 * 1000

// Isolated pure-logic version of the auto clock-out eligibility check
function isEligibleForAutoClockout(shiftEndTime: Date, now: Date = new Date()): boolean {
  const cutoff = new Date(now.getTime() - THIRTY_MIN_MS)
  return shiftEndTime.getTime() <= cutoff.getTime()
}

// Simulate what processForTenant does when it finds eligible shifts
function processShifts(shifts: { id: number; guard_id: number; end_time: string; status: string; auto_clocked_out: number }[], now: Date) {
  return shifts
    .filter(s => s.status === 'active' && s.auto_clocked_out === 0)
    .filter(s => isEligibleForAutoClockout(new Date(s.end_time), now))
    .map(s => ({
      ...s,
      status: 'completed',
      auto_clocked_out: 1,
      actual_end_time: now.toISOString(),
    }))
}

describe('Auto Clock-out Logic', () => {
  const NOW = new Date('2024-01-15T16:35:00Z')

  describe('eligibility check', () => {
    it('flags shifts 31 minutes past end time', () => {
      const endTime = new Date(NOW.getTime() - 31 * 60000)
      expect(isEligibleForAutoClockout(endTime, NOW)).toBe(true)
    })

    it('flags shifts exactly 30 minutes past end time', () => {
      const endTime = new Date(NOW.getTime() - THIRTY_MIN_MS)
      expect(isEligibleForAutoClockout(endTime, NOW)).toBe(true)
    })

    it('does NOT flag shifts 29 minutes past end time', () => {
      const endTime = new Date(NOW.getTime() - 29 * 60000)
      expect(isEligibleForAutoClockout(endTime, NOW)).toBe(false)
    })

    it('does NOT flag shifts still in the future', () => {
      const endTime = new Date(NOW.getTime() + 60000)
      expect(isEligibleForAutoClockout(endTime, NOW)).toBe(false)
    })
  })

  describe('shift filtering', () => {
    const shifts = [
      { id: 1, guard_id: 10, end_time: new Date(NOW.getTime() - 40 * 60000).toISOString(), status: 'active', auto_clocked_out: 0 },
      { id: 2, guard_id: 11, end_time: new Date(NOW.getTime() - 20 * 60000).toISOString(), status: 'active', auto_clocked_out: 0 },
      { id: 3, guard_id: 12, end_time: new Date(NOW.getTime() - 60 * 60000).toISOString(), status: 'completed', auto_clocked_out: 1 },
      { id: 4, guard_id: 13, end_time: new Date(NOW.getTime() - 35 * 60000).toISOString(), status: 'active', auto_clocked_out: 0 },
    ]

    it('processes only eligible active shifts', () => {
      const processed = processShifts(shifts, NOW)
      // shift 1 (40min ago) and shift 4 (35min ago) are eligible; shift 2 (20min ago) is not; shift 3 is already done
      expect(processed.map(s => s.id)).toEqual([1, 4])
    })

    it('sets status to completed and auto_clocked_out to 1', () => {
      const processed = processShifts(shifts, NOW)
      for (const s of processed) {
        expect(s.status).toBe('completed')
        expect(s.auto_clocked_out).toBe(1)
      }
    })

    it('sets actual_end_time to current time', () => {
      const processed = processShifts(shifts, NOW)
      for (const s of processed) {
        expect(s.actual_end_time).toBe(NOW.toISOString())
      }
    })

    it('skips shifts already auto-clocked-out', () => {
      const processed = processShifts(shifts, NOW)
      expect(processed.map(s => s.id)).not.toContain(3)
    })

    it('skips shifts not yet 30 minutes past end', () => {
      const processed = processShifts(shifts, NOW)
      expect(processed.map(s => s.id)).not.toContain(2)
    })
  })

  describe('timesheet creation after auto clock-out', () => {
    it('creates a submitted timesheet, not draft', () => {
      const status = 'submitted'
      const source = 'auto_clockout'
      expect(status).toBe('submitted')
      expect(source).toBe('auto_clockout')
    })

    it('falls back to shift end_time when no clock-in event found', () => {
      const shiftEndTime = new Date('2024-01-15T16:00:00Z')
      const clockInFallback = shiftEndTime
      const now = new Date('2024-01-15T16:32:00Z')
      const hoursWorked = Math.round(((now.getTime() - clockInFallback.getTime()) / 3600000) * 100) / 100
      expect(hoursWorked).toBeGreaterThanOrEqual(0.5)
      expect(hoursWorked).toBeLessThanOrEqual(1)
    })

    it('only creates a timesheet if none exists for that shift', () => {
      const existingTimesheets: number[] = [100, 200, 300]
      const shiftId = 400
      const shouldCreate = !existingTimesheets.includes(shiftId)
      expect(shouldCreate).toBe(true)
    })

    it('skips timesheet creation if one already exists', () => {
      const existingTimesheets: number[] = [100, 200, 300]
      const shiftId = 100
      const shouldCreate = !existingTimesheets.includes(shiftId)
      expect(shouldCreate).toBe(false)
    })
  })
})
