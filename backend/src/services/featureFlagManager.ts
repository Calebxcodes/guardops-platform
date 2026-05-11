import { pool } from '../db/pool'

export interface FeatureFlags {
  stripe_payments_enabled: boolean
  multi_tenancy_enabled: boolean
  onboarding_videos_enabled: boolean
  websocket_messaging_enabled: boolean
  geofencing_alerts_enabled: boolean
  api_v2_enabled: boolean
  chatbot_enabled: boolean
}

const FLAG_ENV_MAP: Record<keyof FeatureFlags, string> = {
  stripe_payments_enabled:    'FEATURE_STRIPE',
  multi_tenancy_enabled:      'FEATURE_MULTI_TENANCY',
  onboarding_videos_enabled:  'FEATURE_VIDEOS',
  websocket_messaging_enabled:'FEATURE_WEBSOCKETS',
  geofencing_alerts_enabled:  'FEATURE_GEOFENCING',
  api_v2_enabled:             'FEATURE_API_V2',
  chatbot_enabled:            'FEATURE_CHATBOT',
}

export class FeatureFlagManager {
  private static cache: Map<string, FeatureFlags> = new Map()
  private static globalFlags: FeatureFlags | null = null

  static getGlobalFlags(): FeatureFlags {
    if (this.globalFlags) return this.globalFlags
    this.globalFlags = Object.fromEntries(
      Object.entries(FLAG_ENV_MAP).map(([flag, envKey]) => [
        flag,
        process.env[envKey] === 'true',
      ])
    ) as unknown as FeatureFlags
    return this.globalFlags
  }

  static async getTenantFlags(tenantId: number): Promise<FeatureFlags> {
    const cacheKey = `tenant_${tenantId}`
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey)!

    const global = this.getGlobalFlags()

    const { rows } = await pool.query(
      'SELECT flags FROM public.tenant_feature_flags WHERE tenant_id = $1',
      [tenantId]
    )

    const overrides: Partial<FeatureFlags> = rows[0]?.flags ?? {}
    const merged: FeatureFlags = { ...global, ...overrides }
    this.cache.set(cacheKey, merged)
    return merged
  }

  static async setTenantFlag(tenantId: number, flag: keyof FeatureFlags, enabled: boolean): Promise<void> {
    const current = await this.getTenantFlags(tenantId)
    const updated = { ...current, [flag]: enabled }
    const now = Math.floor(Date.now() / 1000)

    await pool.query(
      `INSERT INTO public.tenant_feature_flags (tenant_id, flags, updated_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (tenant_id) DO UPDATE SET flags = $2, updated_at = $3`,
      [tenantId, JSON.stringify(updated), now]
    )

    this.cache.delete(`tenant_${tenantId}`)
  }

  static setGlobalFlag(flag: keyof FeatureFlags, enabled: boolean): void {
    process.env[FLAG_ENV_MAP[flag]] = enabled ? 'true' : 'false'
    this.globalFlags = null
    this.cache.clear()
  }

  static invalidateTenant(tenantId: number): void {
    this.cache.delete(`tenant_${tenantId}`)
  }
}

export default FeatureFlagManager
