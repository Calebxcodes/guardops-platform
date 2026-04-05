import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle, Clock, Shield, Download, Mail, RefreshCw } from 'lucide-react'
import { format, parseISO, differenceInDays } from 'date-fns'
import axios from 'axios'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api' })

interface OfficerCompliance {
  id: number
  name: string
  email: string
  phone: string
  status: string
  sia_cert_name: string | null
  sia_expiry: string | null
  days_until_expiry: number | null
  sia_status: 'valid' | 'expiring_soon' | 'expired' | 'missing'
  all_certs: { name: string; expiry: string }[]
}

interface Summary {
  total: number
  valid: number
  expiring_soon: number
  expired: number
  missing: number
}

export default function Compliance() {
  const [officers, setOfficers] = useState<OfficerCompliance[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [selected, setSelected] = useState<OfficerCompliance | null>(null)

  const load = () => {
    setLoading(true)
    api.get('/compliance/sia')
      .then(r => { setOfficers(r.data.officers); setSummary(r.data.summary) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const filtered = filter === 'all' ? officers : officers.filter(o => o.sia_status === filter)

  const statusConfig = {
    valid:          { label: 'Valid',          color: 'text-green-600',  bg: 'bg-green-50',  border: 'border-green-200', icon: CheckCircle },
    expiring_soon:  { label: 'Expiring Soon',  color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200', icon: Clock },
    expired:        { label: 'Expired',         color: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-200',    icon: AlertTriangle },
    missing:        { label: 'No SIA on File',  color: 'text-gray-500',   bg: 'bg-gray-50',   border: 'border-gray-200',   icon: Shield },
  }

  const exportCSV = () => {
    const rows = [
      ['Name', 'Email', 'Phone', 'SIA Status', 'SIA Expiry', 'Days Remaining', 'Employment Status'],
      ...officers.map(o => [
        o.name, o.email, o.phone,
        statusConfig[o.sia_status].label,
        o.sia_expiry || 'N/A',
        o.days_until_expiry !== null ? String(o.days_until_expiry) : 'N/A',
        o.status
      ])
    ]
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `secureedge-sia-compliance-${format(new Date(), 'yyyy-MM-dd')}.csv`; a.click()
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">SIA Compliance</h1>
          <p className="text-gray-500 text-sm mt-0.5">Licence tracking and compliance overview</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn-secondary flex items-center gap-1.5 text-sm">
            <RefreshCw size={14} /><span className="hidden sm:inline">Refresh</span>
          </button>
          <button onClick={exportCSV} className="btn-secondary flex items-center gap-1.5 text-sm">
            <Download size={14} /><span className="hidden sm:inline">Export CSV</span><span className="sm:hidden">Export</span>
          </button>
        </div>
      </div>

      {/* Alert banner */}
      {summary && (summary.expired > 0 || summary.expiring_soon > 0) && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={20} />
          <div>
            <div className="font-semibold text-red-800">Immediate Action Required</div>
            <div className="text-red-700 text-sm mt-1">
              {summary.expired > 0 && <span><strong>{summary.expired} officer{summary.expired !== 1 ? 's' : ''}</strong> with expired SIA licences must NOT be deployed. </span>}
              {summary.expiring_soon > 0 && <span><strong>{summary.expiring_soon} officer{summary.expiring_soon !== 1 ? 's' : ''}</strong> have licences expiring within 90 days.</span>}
            </div>
          </div>
        </div>
      )}

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {([
            { key: 'valid',         label: 'Valid',           value: summary.valid,         color: 'border-t-green-500' },
            { key: 'expiring_soon', label: 'Expiring Soon',   value: summary.expiring_soon, color: 'border-t-yellow-500' },
            { key: 'expired',       label: 'Expired',          value: summary.expired,       color: 'border-t-red-500' },
            { key: 'missing',       label: 'No SIA on File',   value: summary.missing,       color: 'border-t-gray-400' },
          ] as const).map(({ key, label, value, color }) => (
            <button
              key={key}
              onClick={() => setFilter(filter === key ? 'all' : key)}
              className={`card p-4 text-left border-t-4 ${color} transition-all hover:shadow-md ${filter === key ? 'ring-2 ring-blue-500' : ''}`}
            >
              <div className="text-sm text-gray-500">{label}</div>
              <div className="text-3xl font-bold mt-1">{value}</div>
              <div className="text-xs text-gray-400 mt-1">of {summary.total} total</div>
            </button>
          ))}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'all', label: 'All Officers' },
          { key: 'expired', label: '🔴 Expired' },
          { key: 'expiring_soon', label: '🟡 Expiring Soon' },
          { key: 'valid', label: '🟢 Valid' },
          { key: 'missing', label: '⚫ Missing' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              filter === key
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {label} {key !== 'all' && summary ? `(${summary[key as keyof Summary]})` : ''}
          </button>
        ))}
      </div>

      {/* Officers table */}
      <div className="card overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading compliance data...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Officer</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">SIA Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Licence / Expiry</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Days Remaining</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Duty Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No officers in this category</td></tr>
              )}
              {filtered.map(o => {
                const cfg = statusConfig[o.sia_status]
                const Icon = cfg.icon
                return (
                  <tr key={o.id} className={`hover:bg-gray-50 ${o.sia_status === 'expired' ? 'bg-red-50/40' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">
                          {o.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{o.name}</div>
                          <div className="text-xs text-gray-400">{o.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
                        <Icon size={11} />
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {o.sia_expiry ? (
                        <div>
                          <div className="text-xs text-gray-500">{o.sia_cert_name}</div>
                          <div className="font-medium text-gray-900">
                            {format(parseISO(o.sia_expiry), 'dd MMM yyyy')}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">Not on file</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {o.days_until_expiry !== null ? (
                        <span className={`font-bold text-sm ${
                          o.days_until_expiry < 0 ? 'text-red-600' :
                          o.days_until_expiry <= 30 ? 'text-orange-500' :
                          o.days_until_expiry <= 90 ? 'text-yellow-600' : 'text-green-600'
                        }`}>
                          {o.days_until_expiry < 0 ? `${Math.abs(o.days_until_expiry)} days overdue` : `${o.days_until_expiry} days`}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        o.status === 'on-duty' ? 'bg-green-100 text-green-700' :
                        o.status === 'off-duty' ? 'bg-gray-100 text-gray-600' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>{o.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSelected(o)}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          View All Certs
                        </button>
                        <a href={`mailto:${o.email}?subject=SIA Licence Renewal Reminder&body=Dear ${o.name.split(' ')[0]}, please ensure your SIA licence is renewed before the expiry date.`}
                           className="text-xs text-gray-400 hover:text-blue-600 flex items-center gap-0.5">
                          <Mail size={11} /> Email
                        </a>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Cert detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                {selected.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div>
                <div className="font-bold text-gray-900">{selected.name}</div>
                <div className="text-sm text-gray-500">{selected.email}</div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-semibold text-gray-600 mb-3">All Certifications</div>
              {selected.all_certs.length === 0 ? (
                <div className="text-gray-400 text-sm">No certifications on file</div>
              ) : selected.all_certs.map((c, i) => {
                const days = differenceInDays(parseISO(c.expiry), new Date())
                return (
                  <div key={i} className={`flex items-center justify-between p-3 rounded-lg border ${days < 0 ? 'bg-red-50 border-red-200' : days <= 90 ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
                    <div>
                      <div className="text-sm font-medium text-gray-900">{c.name}</div>
                      <div className="text-xs text-gray-500">Expires: {format(parseISO(c.expiry), 'dd MMM yyyy')}</div>
                    </div>
                    <span className={`text-xs font-bold ${days < 0 ? 'text-red-600' : days <= 90 ? 'text-yellow-600' : 'text-green-600'}`}>
                      {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d left`}
                    </span>
                  </div>
                )
              })}
            </div>
            <button onClick={() => setSelected(null)} className="mt-5 w-full btn-secondary text-sm">Close</button>
          </div>
        </div>
      )}
    </div>
  )
}
