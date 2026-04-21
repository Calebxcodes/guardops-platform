import { useEffect, useState } from 'react'
import {
  getPayments, getRevenue, retryPayment, refundPayment,
  type Payment, type RevenueStats,
} from '../../api/masterAdminApi'
import { RefreshCw, RotateCcw } from 'lucide-react'

const STATUS_COLORS: Record<string, string> = {
  succeeded: 'bg-green-900/50 text-green-400',
  failed:    'bg-red-900/50 text-red-400',
  refunded:  'bg-yellow-900/50 text-yellow-400',
  pending:   'bg-gray-700 text-gray-300',
}

export default function Payments() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [revenue, setRevenue] = useState<RevenueStats | null>(null)
  const [statusFilter, setStatusFilter] = useState('failed')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<number | null>(null)

  async function load() {
    setLoading(true)
    const [p, r] = await Promise.all([
      getPayments({ status: statusFilter || undefined }),
      getRevenue(),
    ])
    setPayments(p)
    setRevenue(r)
    setLoading(false)
  }

  useEffect(() => { load() }, [statusFilter])

  async function act(fn: () => Promise<unknown>, id: number) {
    setActionLoading(id)
    try { await fn(); await load() }
    catch (err: any) { alert(err.response?.data?.error ?? 'Action failed') }
    finally { setActionLoading(null) }
  }

  const fmt = (cents: number) => `£${(cents / 100).toFixed(2)}`

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-1">Payments</h1>
      <p className="text-gray-500 text-sm mb-6">Billing overview</p>

      {revenue && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Collected', value: fmt(revenue.total_collected_cents), color: 'text-green-400' },
            { label: 'Successful',      value: revenue.successful_payments,         color: 'text-white' },
            { label: 'Failed',          value: revenue.failed_payments,             color: 'text-red-400' },
            { label: 'Refunded',        value: fmt(revenue.total_refunded_cents),   color: 'text-yellow-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="text-sm text-gray-500 mb-1">{label}</div>
              <div className={`text-2xl font-bold ${color}`}>{value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3 mb-5">
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
        >
          <option value="">All</option>
          <option value="succeeded">Succeeded</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      {loading ? (
        <div className="text-gray-500">Loading…</div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800 text-xs uppercase tracking-wide">
                <th className="text-left px-5 py-3">Tenant</th>
                <th className="text-left px-5 py-3">Invoice</th>
                <th className="text-right px-5 py-3">Amount</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-right px-5 py-3">Retries</th>
                <th className="text-right px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.map(p => (
                <tr key={p.id} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                  <td className="px-5 py-3">
                    <div className="font-medium text-white">{p.tenant_name}</div>
                    <div className="text-gray-500 text-xs">{p.slug}</div>
                  </td>
                  <td className="px-5 py-3 text-gray-400 font-mono text-xs truncate max-w-[160px]">
                    {p.stripe_invoice_id}
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-white">{fmt(p.amount_cents)}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLORS[p.status] ?? 'text-gray-400'}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right text-gray-400">{p.retry_count}</td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {p.status === 'failed' && (
                        <button
                          onClick={() => act(() => retryPayment(p.id), p.id)}
                          disabled={actionLoading === p.id}
                          title="Retry"
                          className="p-1.5 rounded hover:bg-blue-900/40 text-blue-400 disabled:opacity-40"
                        >
                          <RefreshCw size={15} />
                        </button>
                      )}
                      {p.status === 'succeeded' && (
                        <button
                          onClick={() => {
                            const amt = prompt('Refund amount in pence (leave blank for full refund):')
                            act(() => refundPayment(p.id, amt ? parseInt(amt) : undefined), p.id)
                          }}
                          disabled={actionLoading === p.id}
                          title="Refund"
                          className="p-1.5 rounded hover:bg-yellow-900/40 text-yellow-400 disabled:opacity-40"
                        >
                          <RotateCcw size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-gray-500">No payments found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
