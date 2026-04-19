import { useEffect, useState, useCallback } from 'react'
import { analyticsApi } from '../../api'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from 'recharts'
import {
  TrendingUp, TrendingDown, Users, AlertTriangle, MapPin,
  Download, BarChart2, Clock, Shield, CheckSquare,
} from 'lucide-react'
import { format, subDays, subMonths } from 'date-fns'

// ── Types ──────────────────────────────────────────────────────────────────────
interface DateRange { from: string; to: string }

const PRESET_RANGES: { label: string; range: () => DateRange }[] = [
  { label: '7d',  range: () => ({ from: fmt(subDays(new Date(), 6)),   to: today() }) },
  { label: '30d', range: () => ({ from: fmt(subDays(new Date(), 29)),  to: today() }) },
  { label: '90d', range: () => ({ from: fmt(subDays(new Date(), 89)),  to: today() }) },
  { label: '1y',  range: () => ({ from: fmt(subMonths(new Date(), 12)), to: today() }) },
]

const TABS = ['Overview', 'Revenue', 'Workforce', 'Sites', 'Incidents'] as const
type Tab = typeof TABS[number]

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899']

// ── Helpers ────────────────────────────────────────────────────────────────────
function today()       { return format(new Date(), 'yyyy-MM-dd') }
function fmt(d: Date)  { return format(d, 'yyyy-MM-dd') }
function gbp(n: number) { return `£${Math.round(n).toLocaleString('en-GB')}` }
function pct(n: number) { return `${n}%` }

function exportCsv(rows: any[], filename: string) {
  if (!rows.length) return
  const cols = Object.keys(rows[0])
  const csv  = [cols.join(','), ...rows.map(r => cols.map(c => JSON.stringify(r[c] ?? '')).join(','))].join('\n')
  const a    = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
    download: filename,
  })
  a.click(); URL.revokeObjectURL(a.href)
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, sub, color }: any) {
  return (
    <div className="card p-4 sm:p-5">
      <div className={`inline-flex p-2 rounded-lg mb-3 ${color}`}>
        <Icon size={16} className="text-white" />
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  )
}

function ChartCard({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm sm:text-base">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  )
}

function Empty() {
  return <div className="h-40 flex items-center justify-center text-gray-400 text-sm">No data for this period</div>
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function Analytics() {
  const [tab, setTab]           = useState<Tab>('Overview')
  const [range, setRange]       = useState<DateRange>(PRESET_RANGES[1].range())
  const [activePreset, setPreset] = useState('30d')
  const [loading, setLoading]   = useState(false)
  const [data, setData]         = useState<any>({})

  const fetchTab = useCallback(async (t: Tab, r: DateRange) => {
    setLoading(true)
    try {
      const key = t.toLowerCase() as 'overview' | 'revenue' | 'workforce' | 'sites' | 'incidents'
      const result = await analyticsApi[key](r)
      setData((prev: any) => ({ ...prev, [key]: result }))
    } catch { /* keep stale */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchTab(tab, range) }, [tab, range])

  const applyPreset = (label: string, r: DateRange) => {
    setPreset(label); setRange(r)
  }

  const overview  = data.overview  || {}
  const revenue   = data.revenue   || {}
  const workforce = data.workforce || {}
  const sites     = data.sites     || []
  const incidents = data.incidents || {}

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Analytics</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {format(new Date(range.from), 'd MMM yyyy')} – {format(new Date(range.to), 'd MMM yyyy')}
          </p>
        </div>

        {/* Date range controls */}
        <div className="flex flex-wrap items-center gap-2">
          {PRESET_RANGES.map(p => (
            <button
              key={p.label}
              onClick={() => applyPreset(p.label, p.range())}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                activePreset === p.label
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {p.label}
            </button>
          ))}
          <div className="flex items-center gap-1 border border-gray-200 rounded-lg px-2 py-1">
            <input
              type="date"
              className="text-xs text-gray-600 outline-none"
              value={range.from}
              max={range.to}
              onChange={e => { setPreset(''); setRange(r => ({ ...r, from: e.target.value })) }}
            />
            <span className="text-gray-300 text-xs">–</span>
            <input
              type="date"
              className="text-xs text-gray-600 outline-none"
              value={range.to}
              min={range.from}
              max={today()}
              onChange={e => { setPreset(''); setRange(r => ({ ...r, to: e.target.value })) }}
            />
          </div>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit flex-wrap">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading && <div className="text-center py-4 text-gray-400 text-sm">Loading…</div>}

      {/* ── Overview ─────────────────────────────────────────────────────── */}
      {tab === 'Overview' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <KpiCard icon={TrendingUp}   label="Revenue"       value={gbp(overview.revenue || 0)}       color="bg-blue-500"
              sub={`${pct(overview.margin || 0)} margin`} />
            <KpiCard icon={TrendingDown} label="Payroll Cost"  value={gbp(overview.payroll || 0)}       color="bg-red-400" />
            <KpiCard icon={TrendingUp}   label="Net Profit"
              value={<span className={(overview.profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}>{gbp(overview.profit || 0)}</span>}
              color="bg-green-500" />
            <KpiCard icon={Users}        label="Active Guards" value={overview.active_guards || 0}      color="bg-purple-500" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <KpiCard icon={Clock}        label="Shifts"        value={overview.shifts_total || 0}
              sub={`${overview.shifts_uncovered || 0} uncovered`}  color="bg-gray-500" />
            <KpiCard icon={MapPin}       label="Site Coverage" value={pct(overview.coverage_rate ?? 100)} color="bg-teal-500" />
            <KpiCard icon={AlertTriangle} label="Incidents"    value={overview.incidents || 0}
              sub={`${overview.incidents_resolved || 0} resolved`} color="bg-orange-500" />
            <KpiCard icon={CheckSquare}  label="Patrol Scans"  value={overview.checkpoint_scans || 0}  color="bg-indigo-500" />
          </div>
        </div>
      )}

      {/* ── Revenue ──────────────────────────────────────────────────────── */}
      {tab === 'Revenue' && (
        <div className="space-y-5">
          <ChartCard
            title="Daily Revenue"
            action={
              <button onClick={() => exportCsv(revenue.daily || [], 'revenue-daily.csv')}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors">
                <Download size={13} /> CSV
              </button>
            }
          >
            {(revenue.daily?.length || 0) > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={revenue.daily}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d: string) => format(new Date(d), 'd MMM')} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `£${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => gbp(v)} labelFormatter={(d: string) => format(new Date(d), 'd MMM yyyy')} />
                  <Bar dataKey="revenue" fill="#3b82f6" radius={[3, 3, 0, 0]} name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
            ) : <Empty />}
          </ChartCard>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <ChartCard title="Revenue by Client"
              action={<button onClick={() => exportCsv(revenue.byClient || [], 'revenue-by-client.csv')} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700"><Download size={13} /> CSV</button>}
            >
              {(revenue.byClient?.length || 0) > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={revenue.byClient} dataKey="revenue" nameKey="name" cx="50%" cy="50%" outerRadius={75}
                        label={({ name, percent }: any) => `${name.split(' ')[0]} ${Math.round(percent * 100)}%`}>
                        {(revenue.byClient || []).map((_: any, i: number) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => gbp(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5 mt-2">
                    {(revenue.byClient || []).map((c: any, i: number) => (
                      <div key={c.name} className="flex justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                          {c.name}
                        </div>
                        <span className="font-semibold">{gbp(c.revenue)}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : <Empty />}
            </ChartCard>

            <ChartCard title="Revenue by Site (Top 10)"
              action={<button onClick={() => exportCsv(revenue.bySite || [], 'revenue-by-site.csv')} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700"><Download size={13} /> CSV</button>}
            >
              {(revenue.bySite?.length || 0) > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={revenue.bySite} layout="vertical">
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v: number) => `£${(v/1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
                    <Tooltip formatter={(v: number) => gbp(v)} />
                    <Bar dataKey="revenue" fill="#10b981" radius={[0, 3, 3, 0]} name="Revenue" />
                  </BarChart>
                </ResponsiveContainer>
              ) : <Empty />}
            </ChartCard>
          </div>
        </div>
      )}

      {/* ── Workforce ────────────────────────────────────────────────────── */}
      {tab === 'Workforce' && (
        <div className="space-y-5">
          <ChartCard title="Guards Deployed Per Day">
            {(workforce.daily?.length || 0) > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={workforce.daily}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d: string) => format(new Date(d), 'd MMM')} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip labelFormatter={(d: string) => format(new Date(d), 'd MMM yyyy')} />
                  <Line type="monotone" dataKey="guards_deployed" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} name="Guards" />
                </LineChart>
              </ResponsiveContainer>
            ) : <Empty />}
          </ChartCard>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <ChartCard title="Hours by Guard"
              action={<button onClick={() => exportCsv(workforce.byGuard || [], 'hours-by-guard.csv')} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700"><Download size={13} /> CSV</button>}
            >
              {(workforce.byGuard?.filter((g: any) => g.hours > 0).length || 0) > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={workforce.byGuard.filter((g: any) => g.hours > 0)} layout="vertical">
                    <XAxis type="number" tick={{ fontSize: 10 }} unit="h" />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
                    <Tooltip formatter={(v: number) => `${v}h`} />
                    <Bar dataKey="hours" fill="#3b82f6" radius={[0, 3, 3, 0]} name="Hours" />
                  </BarChart>
                </ResponsiveContainer>
              ) : <Empty />}
            </ChartCard>

            <ChartCard title="Overtime Hours (Shifts > 8h)"
              action={<button onClick={() => exportCsv(workforce.overtime || [], 'overtime.csv')} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700"><Download size={13} /> CSV</button>}
            >
              {(workforce.overtime?.length || 0) > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={workforce.overtime} layout="vertical">
                    <XAxis type="number" tick={{ fontSize: 10 }} unit="h" />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
                    <Tooltip formatter={(v: number) => `${v}h`} />
                    <Bar dataKey="overtime_hours" fill="#f59e0b" radius={[0, 3, 3, 0]} name="Overtime" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-40 flex items-center justify-center text-gray-400 text-sm">
                  No overtime shifts in this period
                </div>
              )}
            </ChartCard>
          </div>

          {/* Guard table */}
          {(workforce.byGuard?.length || 0) > 0 && (
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <h3 className="font-semibold text-sm">Guard Summary</h3>
                <button onClick={() => exportCsv(workforce.byGuard, 'guard-summary.csv')}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700">
                  <Download size={13} /> CSV
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {['Guard', 'Shifts', 'Hours', 'Overtime', 'Completed'].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {workforce.byGuard.map((g: any) => (
                      <tr key={g.name} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium">{g.name}</td>
                        <td className="px-4 py-2.5 text-gray-600">{g.shifts}</td>
                        <td className="px-4 py-2.5 text-gray-600">{g.hours}h</td>
                        <td className="px-4 py-2.5">
                          {g.overtime_hours > 0
                            ? <span className="text-orange-600 font-medium">{g.overtime_hours}h</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-gray-600">{g.completed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Sites ────────────────────────────────────────────────────────── */}
      {tab === 'Sites' && (
        <div className="space-y-5">
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h3 className="font-semibold text-sm">Site Performance</h3>
              <button onClick={() => exportCsv(sites, 'site-performance.csv')}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700">
                <Download size={13} /> CSV
              </button>
            </div>
            {sites.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {['Site', 'Client', 'Revenue', 'Hours', 'Coverage', 'Shifts', 'Incidents', 'Patrol Scans'].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {sites.map((s: any) => (
                      <tr key={s.site} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium">{s.site}</td>
                        <td className="px-4 py-2.5 text-gray-500 text-xs">{s.client}</td>
                        <td className="px-4 py-2.5 font-semibold text-blue-600">{gbp(s.revenue)}</td>
                        <td className="px-4 py-2.5 text-gray-600">{s.hours}h</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-green-500 transition-all"
                                style={{ width: `${s.coverage_rate}%` }} />
                            </div>
                            <span className={`text-xs font-medium ${s.coverage_rate < 80 ? 'text-red-500' : 'text-green-600'}`}>
                              {s.coverage_rate}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-gray-600">{s.total_shifts}</td>
                        <td className="px-4 py-2.5">
                          {s.incidents > 0
                            ? <span className="text-orange-600 font-medium">{s.incidents}</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-gray-600">{s.checkpoint_scans}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <Empty />}
          </div>

          {/* Coverage rate bar chart */}
          {sites.filter((s: any) => s.total_shifts > 0).length > 0 && (
            <ChartCard title="Site Coverage Rate">
              <ResponsiveContainer width="100%" height={Math.max(200, sites.length * 32)}>
                <BarChart data={sites.filter((s: any) => s.total_shifts > 0)} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 10 }} domain={[0, 100]} unit="%" />
                  <YAxis type="category" dataKey="site" tick={{ fontSize: 10 }} width={110} />
                  <Tooltip formatter={(v: number) => `${v}%`} />
                  <Bar dataKey="coverage_rate" name="Coverage"
                    radius={[0, 3, 3, 0]}
                    fill="#10b981"
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}
        </div>
      )}

      {/* ── Incidents ────────────────────────────────────────────────────── */}
      {tab === 'Incidents' && (
        <div className="space-y-5">
          <ChartCard title="Incident Trend"
            action={<button onClick={() => exportCsv(incidents.daily || [], 'incidents-daily.csv')} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700"><Download size={13} /> CSV</button>}
          >
            {(incidents.daily?.length || 0) > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={incidents.daily}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d: string) => format(new Date(d), 'd MMM')} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip labelFormatter={(d: string) => format(new Date(d), 'd MMM yyyy')} />
                  <Line type="monotone" dataKey="count" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} name="Incidents" />
                </LineChart>
              </ResponsiveContainer>
            ) : <Empty />}
          </ChartCard>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* By type */}
            <ChartCard title="By Type"
              action={<button onClick={() => exportCsv(incidents.byType || [], 'incidents-by-type.csv')} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700"><Download size={13} /> CSV</button>}
            >
              {(incidents.byType?.length || 0) > 0 ? (
                <div className="space-y-2 mt-1">
                  {incidents.byType.map((t: any, i: number) => (
                    <div key={t.type}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium truncate">{t.type}</span>
                        <span className="text-gray-500 shrink-0 ml-2">{t.count} ({t.resolved} resolved)</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{
                          width: `${Math.round((t.count / incidents.byType[0].count) * 100)}%`,
                          backgroundColor: PIE_COLORS[i % PIE_COLORS.length],
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : <Empty />}
            </ChartCard>

            {/* By severity */}
            <ChartCard title="By Severity">
              {(incidents.bySeverity?.length || 0) > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={incidents.bySeverity} dataKey="count" nameKey="severity"
                      cx="50%" cy="50%" outerRadius={70}
                      label={({ severity, percent }: any) => `${severity} ${Math.round(percent * 100)}%`}>
                      {(incidents.bySeverity || []).map((_: any, i: number) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : <Empty />}
            </ChartCard>

            {/* By site */}
            <ChartCard title="By Site (Top 8)"
              action={<button onClick={() => exportCsv(incidents.bySite || [], 'incidents-by-site.csv')} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700"><Download size={13} /> CSV</button>}
            >
              {(incidents.bySite?.length || 0) > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={incidents.bySite} layout="vertical">
                    <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="site" tick={{ fontSize: 10 }} width={100} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#ef4444" radius={[0, 3, 3, 0]} name="Incidents" />
                  </BarChart>
                </ResponsiveContainer>
              ) : <Empty />}
            </ChartCard>
          </div>
        </div>
      )}
    </div>
  )
}
