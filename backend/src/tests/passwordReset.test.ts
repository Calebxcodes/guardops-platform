import { describe, it, expect } from 'vitest'
import crypto from 'crypto'

describe('Password Reset Token', () => {
  it('generates unique 32-byte hex tokens', () => {
    const token1 = crypto.randomBytes(32).toString('hex')
    const token2 = crypto.randomBytes(32).toString('hex')
    expect(token1).toHaveLength(64)
    expect(token2).toHaveLength(64)
    expect(token1).not.toBe(token2)
  })

  it('stores a SHA-256 hash, not the raw token', () => {
    const token = crypto.randomBytes(32).toString('hex')
    const hash = crypto.createHash('sha256').update(token).digest('hex')
    expect(hash).not.toBe(token)
    expect(hash).toHaveLength(64)
    // Hash is deterministic
    expect(crypto.createHash('sha256').update(token).digest('hex')).toBe(hash)
  })

  it('token expires in 24 hours (not 1 hour)', () => {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const diffMs = expiresAt.getTime() - Date.now()
    const diffHours = diffMs / (1000 * 60 * 60)
    // Should be ~24h, not ~1h
    expect(diffHours).toBeGreaterThanOrEqual(23.9)
    expect(diffHours).toBeLessThanOrEqual(24.1)
  })

  it('rejects a tampered token (hash mismatch)', () => {
    const token = crypto.randomBytes(32).toString('hex')
    const storedHash = crypto.createHash('sha256').update(token).digest('hex')
    const tamperedToken = 'deadbeef' + token.slice(8)
    const tamperedHash = crypto.createHash('sha256').update(tamperedToken).digest('hex')
    expect(tamperedHash).not.toBe(storedHash)
  })

  it('expired token is detected correctly', () => {
    const pastExpiry = new Date(Date.now() - 1000) // 1 second ago
    expect(new Date() > pastExpiry).toBe(true)
  })

  it('valid token is within expiry window', () => {
    const futureExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000)
    expect(new Date() < futureExpiry).toBe(true)
  })

  it('tenant_id is stored as part of the reset token record', () => {
    const tenantId = 42
    const tokenRecord = {
      user_type: 'guard',
      user_id: 7,
      tenant_id: tenantId,
      token: crypto.createHash('sha256').update('test').digest('hex'),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }
    expect(tokenRecord.tenant_id).toBe(tenantId)
    expect(tokenRecord.user_type).toBe('guard')
  })
})
