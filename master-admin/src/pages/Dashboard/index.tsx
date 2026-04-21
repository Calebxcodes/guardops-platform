import { useEffect, useState } from 'react'
import { getTenants, getRevenue, type Tenant, type RevenueStats } from '../../api/masterAdminApi'
import { Building2, AlertTriangle, Users } from 'lucide-react'

function StatCard({ label, value, icon: Icon, accent = 'blue' }: {
  label: string
  value: string | number
  icon: React.ElementType
  accent?: string
}) {
  const colors: Record<string, string> = {
    blue:   'bg-blue-900/40 text-blue-400',
    green:  'bg-green-900/40 text-green-400',
    red:    'bg-red-900/40 text-red-400',
    yellow: 'bg-yellow-900/40 text-yellow-400',
  }
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${colors[accent]}`}>
        <Icon size={20} />
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-sm text-gray-500 mt-1">{label}</div>
    </div>
  )
}

export default function Dashboard() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [revenue, setRevenue] = useState<RevenueStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getTenants(), getRevenue()])
      .then(([t, r]) => { setTenants(t); setRevenue(r) })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-8 text-gray-500">Loading…</div>

  const active   = tenants.filter(t => t.status === 'active').length
  const trialing = tenants.filter(t => t.subscription_status === 'trialing').length
  const failed   = tenants.reduce((s, t) => s + t.failed_payments, 0)
  const guards   = tenants.reduce((s, t) => s + t.guard_count, 0)
  const mrr      = revenue ? (revenue.total_collected_cents / 100).toFixed(0) : '—'

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-1">Dashboard</h1>
      <p className="text-gray-500 text-sm mb-8">Platform overview</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Active Tenants"    value={active}   icon={Building2}    accent="blue"   />
        <StatCard label="On Free Trial"     value={trialing} icon={Users}         accent="yellow" />
        <StatCard label="Failed Payments"   value={failed}   icon={AlertTriangle} accent="red"    />
        <StatCard label="Guards Managed"    value={guards}   icon={Users}         accent="green"  />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="text-sm text-gray-500 mb-1">Total Collected</div>
          <div className="text-3xl font-bold text-green-400">£{mrr}</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="text-sm text-gray-500 mb-1">Successful Payments</div>
          <div className="text-3xl font-bold text-white">{revenue?.successful_payments ?? 0}</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="text-sm text-gray-500 mb-1">Refunded</div>
          <div className="text-3xl font-bold text-yellow-400">
            £{revenue ? (revenue.total_refunded_cents / 100).toFixed(0) : 0}
          </div>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white">Recent Tenants</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 border-b border-gray-800">
              <th className="text-left px-6 py-3 font-medium">Company</th>
              <th className="text-left px-6 py-3 font-medium">Tier</th>
              <th className="text-left px-6 py-3 font-medium">Status</th>
              <th className="text-left px-6 py-3 font-medium">Guards</th>
              <th className="text-left px-6 py-3 font-medium">Subscription</th>
            </tr>
          </thead>
          <tbody>
            {tenants.slice(0, 10).map(t => (
              <tr key={t.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="px-6 py-3">
                  <div className="font-medium text-white">{t.name}</div>
                  <div className="text-gray-500 text-xs">{t.email}</div>
                </td>
                <td className="px-6 py-3 text-gray-400">{t.tier}</td>
                <td className="px-6 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    t.status === 'active'    ? 'bg-green-900/50 text-green-400'  :
                    t.status === 'paused'    ? 'bg-yellow-900/50 text-yellow-400':
                    'bg-red-900/50 text-red-400'
                  }`}>{t.status}</span>
                </td>
                <td className="px-6 py-3 text-gray-400">{t.guard_count}</td>
                <td className="px-6 py-3">
                  <span className={`text-xs ${
                    t.subscription_status === 'active'   ? 'text-green-400'  :
                    t.subscription_status === 'trialing' ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>{t.subscription_status ?? 'none'}</span>
                  {t.failed_payments > 0 && (
                    <span className="ml-2 text-xs text-red-400">⚠ {t.failed_payments}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
