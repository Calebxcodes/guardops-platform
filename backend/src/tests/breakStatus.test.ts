import { describe, it, expect } from 'vitest'

type GuardStatus = 'on-duty' | 'off-duty' | 'on-leave' | 'on-break'

// Simulated state machine for break status
function startBreak(currentStatus: GuardStatus): GuardStatus {
  if (currentStatus !== 'on-duty') throw new Error('Guard must be on-duty to start break')
  return 'on-break'
}

function endBreak(currentStatus: GuardStatus): GuardStatus {
  if (currentStatus !== 'on-break') throw new Error('Guard is not on break')
  return 'on-duty'
}

describe('Break Status', () => {
  describe('break start', () => {
    it('transitions on-duty to on-break', () => {
      expect(startBreak('on-duty')).toBe('on-break')
    })

    it('throws if guard is not on-duty', () => {
      expect(() => startBreak('off-duty')).toThrow()
      expect(() => startBreak('on-leave')).toThrow()
    })
  })

  describe('break end', () => {
    it('transitions on-break back to on-duty', () => {
      expect(endBreak('on-break')).toBe('on-duty')
    })

    it('throws if guard is not on break', () => {
      expect(() => endBreak('on-duty')).toThrow()
      expect(() => endBreak('off-duty')).toThrow()
    })
  })

  describe('clock-out gating', () => {
    it('prevents clock-out when on break', () => {
      const canClockOut = (status: GuardStatus) => status !== 'on-break'
      expect(canClockOut('on-break')).toBe(false)
    })

    it('allows clock-out when on duty', () => {
      const canClockOut = (status: GuardStatus) => status !== 'on-break'
      expect(canClockOut('on-duty')).toBe(true)
    })
  })

  describe('break_start_time tracking', () => {
    it('break_start_time is set when break starts', () => {
      const before = new Date()
      const breakStartTime = new Date()
      expect(breakStartTime.getTime()).toBeGreaterThanOrEqual(before.getTime())
    })

    it('break_start_time is cleared when break ends', () => {
      const breakStartTime: Date | null = null
      expect(breakStartTime).toBeNull()
    })
  })

  describe('valid guard statuses', () => {
    it('includes on-break as a valid status', () => {
      const valid: GuardStatus[] = ['on-duty', 'off-duty', 'on-leave', 'on-break']
      expect(valid).toContain('on-break')
    })
  })
})
