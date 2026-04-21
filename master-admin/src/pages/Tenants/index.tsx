import { useEffect, useState } from 'react'
import {
  getTenants, pauseTenant, resumeTenant, cancelTenant, extendTrial,
  type Tenant,
} from '../../api/masterAdminApi'
import { Search, PauseCircle, PlayCircle, XCircle, Clock } from 'lucide-react'

export default function Tenants() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<number | null>(null)

  async function load() {
    setLoading(true)
    const data = await getTenants({ search: search || undefined, status: statusFilter || undefined })
    setTenants(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [search, statusFilter])

  async function act(fn: () => Promise<unknown>, tenantId: number) {
    setActionLoading(tenantId)
    try { await fn(); await load() }
    catch (err: any) { alert(err.response?.data?.error ?? 'Action failed') }
    finally { setActionLoading(null) }
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-1">Tenants</h1>
      <p className="text-gray-500 text-sm mb-6">{tenants.length} companies</p>

      <div className="flex gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {loading ? (
        <div className="text-gray-500">Loading…</div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800 text-xs uppercase tracking-wide">
                <th className="text-left px-5 py-3">Company</th>
                <th className="text-left px-5 py-3">Tier</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-left px-5 py-3">Sub</th>
                <th className="text-right px-5 py-3">Guards</th>
                <th className="text-right px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map(t => (
                <tr key={t.id} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                  <td className="px-5 py-3">
                    <div className="font-medium text-white">{t.name}</div>
                    <div className="text-gray-500 text-xs">{t.slug}.strondis.com</div>
                  </td>
                  <td className="px-5 py-3 text-gray-400 capitalize">{t.tier}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      t.status === 'active'    ? 'bg-green-900/50 text-green-400' :
                      t.status === 'paused'    ? 'bg-yellow-900/50 text-yellow-400' :
                      'bg-red-900/50 text-red-400'
                    }`}>{t.status}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs ${
                      t.subscription_status === 'active'   ? 'text-green-400' :
                      t.subscription_status === 'trialing' ? 'text-yellow-400' :
                      'text-red-400'
                    }`}>{t.subscription_status ?? '—'}</span>
                  </td>
                  <td className="px-5 py-3 text-right text-gray-400">{t.guard_count}/{t.max_guards}</td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {t.status !== 'paused' && t.status !== 'cancelled' && (
                        <button
                          onClick={() => act(() => pauseTenant(t.id, 'Manual suspension'), t.id)}
                          disabled={actionLoading === t.id}
                          title="Pause"
                          className="p-1.5 rounded hover:bg-yellow-900/40 text-yellow-400 disabled:opacity-40"
                        >
                          <PauseCircle size={16} />
                        </button>
                      )}
                      {(t.status === 'paused') && (
                        <button
                          onClick={() => act(() => resumeTenant(t.id), t.id)}
                          disabled={actionLoading === t.id}
                          title="Resume"
                          className="p-1.5 rounded hover:bg-green-900/40 text-green-400 disabled:opacity-40"
                        >
                          <PlayCircle size={16} />
                        </button>
                      )}
                      {t.subscription_status === 'trialing' && (
                        <button
                          onClick={() => {
                            const days = parseInt(prompt('Extend trial by how many days?', '7') ?? '0', 10)
                            if (days > 0) act(() => extendTrial(t.id, days), t.id)
                          }}
                          disabled={actionLoading === t.id}
                          title="Extend trial"
                          className="p-1.5 rounded hover:bg-blue-900/40 text-blue-400 disabled:opacity-40"
                        >
                          <Clock size={16} />
                        </button>
                      )}
                      {t.status !== 'cancelled' && (
                        <button
                          onClick={() => {
                            if (!confirm(`Cancel ${t.name}? This is irreversible.`)) return
                            act(() => cancelTenant(t.id, 'Manual cancellation'), t.id)
                          }}
                          disabled={actionLoading === t.id}
                          title="Cancel"
                          className="p-1.5 rounded hover:bg-red-900/40 text-red-400 disabled:opacity-40"
                        >
                          <XCircle size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
