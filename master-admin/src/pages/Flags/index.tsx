import { useEffect, useState } from 'react'
import {
  getGlobalFlags, getAllTenantFlags, setGlobalFlag, setTenantFlag,
  type FeatureFlags,
} from '../../api/masterAdminApi'

const FLAG_LABELS: Record<keyof FeatureFlags, string> = {
  stripe_payments_enabled:    'Stripe Payments',
  multi_tenancy_enabled:      'Multi-Tenancy',
  onboarding_videos_enabled:  'Onboarding Videos',
  websocket_messaging_enabled:'WebSocket Messaging',
  geofencing_alerts_enabled:  'Geofencing Alerts',
  api_v2_enabled:             'API v2',
}

const ALL_FLAGS = Object.keys(FLAG_LABELS) as (keyof FeatureFlags)[]

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={`relative w-10 h-5 rounded-full transition-colors ${
        checked ? 'bg-blue-600' : 'bg-gray-700'
      } disabled:opacity-40 flex-shrink-0`}
    >
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
        checked ? 'translate-x-5' : ''
      }`} />
    </button>
  )
}

export default function Flags() {
  const [globalFlags, setGlobalFlagsState] = useState<FeatureFlags | null>(null)
  const [tenantFlags, setTenantFlagsState] = useState<{ tenant_id: number; tenant_name: string; slug: string; flags: FeatureFlags }[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const [g, t] = await Promise.all([getGlobalFlags(), getAllTenantFlags()])
    setGlobalFlagsState(g)
    setTenantFlagsState(t)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function toggleGlobal(flag: keyof FeatureFlags, enabled: boolean) {
    setSaving(`global-${flag}`)
    try { await setGlobalFlag(flag, enabled); await load() }
    catch (err: any) { alert(err.response?.data?.error ?? 'Failed') }
    finally { setSaving(null) }
  }

  async function toggleTenant(tenantId: number, flag: keyof FeatureFlags, enabled: boolean) {
    setSaving(`${tenantId}-${flag}`)
    try { await setTenantFlag(tenantId, flag, enabled); await load() }
    catch (err: any) { alert(err.response?.data?.error ?? 'Failed') }
    finally { setSaving(null) }
  }

  if (loading) return <div className="p-8 text-gray-500">Loading…</div>

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-1">Feature Flags</h1>
      <p className="text-gray-500 text-sm mb-8">Global defaults + per-tenant overrides</p>

      {/* Global flags */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">
        <h2 className="text-sm font-semibold text-white mb-4 uppercase tracking-wide">Global Flags</h2>
        <div className="space-y-3">
          {globalFlags && ALL_FLAGS.map(flag => (
            <div key={flag} className="flex items-center justify-between">
              <span className="text-sm text-gray-300">{FLAG_LABELS[flag]}</span>
              <Toggle
                checked={globalFlags[flag]}
                onChange={v => toggleGlobal(flag, v)}
                disabled={saving === `global-${flag}`}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Per-tenant overrides */}
      {tenantFlags.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wide">Tenant Overrides</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800 text-xs">
                <th className="text-left px-5 py-3">Tenant</th>
                {ALL_FLAGS.map(f => (
                  <th key={f} className="text-center px-3 py-3" title={FLAG_LABELS[f]}>
                    {FLAG_LABELS[f].split(' ')[0]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tenantFlags.map(row => (
                <tr key={row.tenant_id} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                  <td className="px-5 py-3">
                    <div className="font-medium text-white">{row.tenant_name}</div>
                    <div className="text-gray-500 text-xs">{row.slug}</div>
                  </td>
                  {ALL_FLAGS.map(flag => (
                    <td key={flag} className="px-3 py-3 text-center">
                      <Toggle
                        checked={row.flags[flag]}
                        onChange={v => toggleTenant(row.tenant_id, flag, v)}
                        disabled={saving === `${row.tenant_id}-${flag}`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
