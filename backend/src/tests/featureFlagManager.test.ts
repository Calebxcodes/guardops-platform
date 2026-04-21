import { describe, it, expect, beforeEach, vi } from 'vitest'
import { FeatureFlagManager } from '../services/featureFlagManager'

// Mock pool.query so no DB needed
vi.mock('../db/pool', () => ({
  pool: {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  },
}))

describe('FeatureFlagManager', () => {
  beforeEach(() => {
    // Reset internal cache between tests
    // @ts-expect-error private access for test reset
    FeatureFlagManager.globalFlags = null
    // @ts-expect-error private access for test reset
    FeatureFlagManager.cache = new Map()
    // Clear env vars
    delete process.env.FEATURE_STRIPE
    delete process.env.FEATURE_MULTI_TENANCY
    delete process.env.FEATURE_VIDEOS
  })

  it('reads global flags from env vars (all false by default)', () => {
    const flags = FeatureFlagManager.getGlobalFlags()
    expect(flags.stripe_payments_enabled).toBe(false)
    expect(flags.multi_tenancy_enabled).toBe(false)
    expect(flags.onboarding_videos_enabled).toBe(false)
  })

  it('reads global flags as true when env vars are set', () => {
    process.env.FEATURE_STRIPE = 'true'
    process.env.FEATURE_MULTI_TENANCY = 'true'
    const flags = FeatureFlagManager.getGlobalFlags()
    expect(flags.stripe_payments_enabled).toBe(true)
    expect(flags.multi_tenancy_enabled).toBe(true)
    expect(flags.onboarding_videos_enabled).toBe(false)
  })

  it('setGlobalFlag updates process.env and invalidates cache', () => {
    process.env.FEATURE_STRIPE = 'false'
    FeatureFlagManager.getGlobalFlags() // prime cache
    FeatureFlagManager.setGlobalFlag('stripe_payments_enabled', true)
    const flags = FeatureFlagManager.getGlobalFlags()
    expect(flags.stripe_payments_enabled).toBe(true)
  })

  it('getTenantFlags returns global flags when no DB overrides exist', async () => {
    process.env.FEATURE_STRIPE = 'true'
    const flags = await FeatureFlagManager.getTenantFlags(1)
    expect(flags.stripe_payments_enabled).toBe(true)
  })

  it('getTenantFlags merges DB overrides over global flags', async () => {
    const { pool } = await import('../db/pool')
    ;(pool.query as any).mockResolvedValueOnce({
      rows: [{ flags: { onboarding_videos_enabled: true } }],
      rowCount: 1,
    })
    process.env.FEATURE_VIDEOS = 'false'
    const flags = await FeatureFlagManager.getTenantFlags(42)
    expect(flags.onboarding_videos_enabled).toBe(true)
  })

  it('invalidateTenant removes cache entry', async () => {
    const { pool } = await import('../db/pool')
    ;(pool.query as any).mockResolvedValue({ rows: [], rowCount: 0 })
    await FeatureFlagManager.getTenantFlags(5)
    // @ts-expect-error private access
    expect(FeatureFlagManager.cache.has('tenant_5')).toBe(true)
    FeatureFlagManager.invalidateTenant(5)
    // @ts-expect-error private access
    expect(FeatureFlagManager.cache.has('tenant_5')).toBe(false)
  })
})
