import { describe, it, expect } from 'vitest'

// Mirror of guard-app/src/utils/time.ts — tests the London timezone logic
const LONDON = 'Europe/London'

function formatLondon12(date: Date | string | number): string {
  const d = new Date(date)
  if (isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('en-GB', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: LONDON,
  }).format(d)
}

function isSameLondonDay(a: Date | string, b: Date | string): boolean {
  const fmt = (d: Date | string) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: LONDON, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(d))
  return fmt(a) === fmt(b)
}

function londonDateStr(date: Date | string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: LONDON, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(date))
}

describe('London Timezone Utilities', () => {
  describe('formatLondon12', () => {
    it('returns em-dash for invalid input', () => {
      expect(formatLondon12('not-a-date')).toBe('—')
      expect(formatLondon12('')).toBe('—')
    })

    it('formats afternoon time as pm in BST (summer, UTC+1)', () => {
      // 2024-06-01 13:00 UTC = 14:00 BST
      const result = formatLondon12('2024-06-01T13:00:00Z')
      expect(result.toLowerCase()).toContain('pm')
      expect(result).toContain('2:00')
    })

    it('formats morning time as am in GMT (winter, UTC+0)', () => {
      // 2024-01-15 09:00 UTC = 09:00 GMT
      const result = formatLondon12('2024-01-15T09:00:00Z')
      expect(result.toLowerCase()).toContain('am')
      expect(result).toContain('9:00')
    })

    it('applies +1 BST offset in summer', () => {
      // 2024-07-01 11:00 UTC = 12:00 BST (noon)
      const result = formatLondon12('2024-07-01T11:00:00Z')
      expect(result).toContain('12:00')
      expect(result.toLowerCase()).toContain('pm')
    })

    it('applies +0 GMT offset in winter', () => {
      // 2024-12-01 12:00 UTC = 12:00 GMT
      const result = formatLondon12('2024-12-01T12:00:00Z')
      expect(result).toContain('12:00')
      expect(result.toLowerCase()).toContain('pm')
    })

    it('accepts Date objects, strings, and timestamps', () => {
      const ts = new Date('2024-06-01T10:00:00Z').getTime()
      const r1 = formatLondon12(new Date('2024-06-01T10:00:00Z'))
      const r2 = formatLondon12('2024-06-01T10:00:00Z')
      const r3 = formatLondon12(ts)
      expect(r1).toBe(r2)
      expect(r2).toBe(r3)
    })
  })

  describe('isSameLondonDay', () => {
    it('returns true for same UTC day within same London day', () => {
      expect(isSameLondonDay('2024-06-01T00:00:00Z', '2024-06-01T22:00:00Z')).toBe(true)
    })

    it('returns false for different London days', () => {
      expect(isSameLondonDay('2024-06-01T00:00:00Z', '2024-06-02T10:00:00Z')).toBe(false)
    })

    it('handles DST boundary: 23:00 UTC in summer = midnight London next day', () => {
      // During BST (UTC+1), 23:00 UTC = 00:00 BST next day
      const utcNight = '2024-06-01T23:00:00Z'
      const bstMidnight = '2024-06-02T00:30:00Z'
      // Both are on June 2 in London time
      expect(londonDateStr(utcNight)).toBe('2024-06-02')
      expect(londonDateStr(bstMidnight)).toBe('2024-06-02')
      expect(isSameLondonDay(utcNight, bstMidnight)).toBe(true)
    })

    it('two noon UTC timestamps on same day are same London day', () => {
      expect(isSameLondonDay('2024-03-10T12:00:00Z', '2024-03-10T12:30:00Z')).toBe(true)
    })
  })
})
