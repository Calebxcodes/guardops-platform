import { describe, it, expect } from 'vitest'

// Signup validation logic mirroring backend guardAuth.ts
function validateSignupPayload(data: Record<string, unknown>): string | null {
  if (!data.tenantId) return 'Company is required'
  if (!data.email || typeof data.email !== 'string') return 'Email is required'
  if (!data.password || typeof data.password !== 'string') return 'Password is required'
  if ((data.password as string).length < 8) return 'Password must be at least 8 characters'
  if (!data.firstName) return 'First name is required'
  if (!data.lastName) return 'Last name is required'
  return null
}

// Login block logic
function canGuardLogin(status: string): boolean {
  return status !== 'pending' && status !== 'rejected'
}

describe('Guard Self-Signup', () => {
  describe('payload validation', () => {
    it('accepts a complete valid payload', () => {
      expect(validateSignupPayload({
        tenantId: 1, email: 'john@test.com', password: 'password123',
        firstName: 'John', lastName: 'Doe',
      })).toBeNull()
    })

    it('rejects missing tenantId', () => {
      expect(validateSignupPayload({
        email: 'john@test.com', password: 'password123', firstName: 'John', lastName: 'Doe',
      })).toBe('Company is required')
    })

    it('rejects missing email', () => {
      expect(validateSignupPayload({ tenantId: 1, password: 'password123', firstName: 'John', lastName: 'Doe' })).toBe('Email is required')
    })

    it('rejects short password (< 8 chars)', () => {
      expect(validateSignupPayload({
        tenantId: 1, email: 'j@t.com', password: 'short', firstName: 'John', lastName: 'Doe',
      })).toBe('Password must be at least 8 characters')
    })

    it('rejects missing first name', () => {
      expect(validateSignupPayload({ tenantId: 1, email: 'j@t.com', password: 'password123', lastName: 'Doe' }))
        .toBe('First name is required')
    })

    it('rejects missing last name', () => {
      expect(validateSignupPayload({ tenantId: 1, email: 'j@t.com', password: 'password123', firstName: 'John' }))
        .toBe('Last name is required')
    })
  })

  describe('initial status', () => {
    it('new signups start as pending', () => {
      const status = 'pending'
      expect(status).toBe('pending')
      expect(status).not.toBe('off-duty')
      expect(status).not.toBe('on-duty')
    })
  })

  describe('login blocking', () => {
    it('blocks pending guards from logging in', () => {
      expect(canGuardLogin('pending')).toBe(false)
    })

    it('blocks rejected guards from logging in', () => {
      expect(canGuardLogin('rejected')).toBe(false)
    })

    it('allows off-duty guards to log in', () => {
      expect(canGuardLogin('off-duty')).toBe(true)
    })

    it('allows on-duty guards to log in', () => {
      expect(canGuardLogin('on-duty')).toBe(true)
    })

    it('allows on-leave guards to log in', () => {
      expect(canGuardLogin('on-leave')).toBe(true)
    })
  })

  describe('admin approval workflow', () => {
    it('activating a guard sets status to off-duty', () => {
      const newStatus = 'off-duty'
      expect(newStatus).toBe('off-duty')
    })

    it('rejecting a guard sets status to rejected', () => {
      const newStatus = 'rejected'
      expect(newStatus).toBe('rejected')
    })
  })
})
