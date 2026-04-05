import { useEffect, useState } from 'react'
import { dashboardApi } from '../../api'
import { DashboardMetrics } from '../../types'
import {
  Users, AlertCircle, Clock, FileText, TrendingUp, Shield,
  MapPin, Activity
} from 'lucide-react'
import StatusBadge from '../../components/StatusBadge'
import { format } from 'date-fns'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar
} from 'recharts'

function KpiCard({ icon: Icon, label, value, sub, color }: any) {
  return (
    <div className="card p-4 sm:p-5 flex items-start gap-3 sm:gap-4">
      <div className={`p-2.5 sm:p-3 rounded-lg shrink-0 ${color}`}>
        <Icon size={18} className="text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xs sm:text-sm text-gray-500 truncate">{label}</p>
        <p className="text-xl sm:text-2xl font-bold mt-0.5 truncate">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [financial, setFinancial] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([dashboardApi.metrics(), dashboardApi.financial()])
      .then(([m, f]) => { setMetrics(m); setFinancial(f) })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-400 text-sm">Loading dashboard...</div>
    </div>
  )
  if (!metrics) return null

  const margin = metrics.revenue_this_month > 0
    ? Math.round(((metrics.revenue_this_month - metrics.payroll_cost_this_month) / metrics.revenue_this_month) * 100)
    : 0

  const chartData = (financial?.monthlyRevenue || []).map((r: any) => {
    const payrollEntry = financial?.monthlyPayroll?.find((p: any) => p.month === r.month)
    return {
      month: r.month.substring(5),
      revenue: Math.round(r.revenue || 0),
      payroll: Math.round(payrollEntry?.cost || 0),
    }
  })

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">{format(new Date(), 'EEEE, MMMM d yyyy')}</p>
      </div>

      {/* KPI Cards — 2 cols mobile, 4 cols desktop */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard icon={Users} label="Guards On Duty" value={metrics.guards_on_duty}
          sub={`of ${metrics.total_guards} total`} color="bg-green-500" />
        <KpiCard icon={AlertCircle} label="Uncovered Shifts" value={metrics.uncovered_shifts}
          sub="today" color={metrics.uncovered_shifts > 0 ? 'bg-red-500' : 'bg-gray-400'} />
        <KpiCard icon={TrendingUp} label="Revenue (Month)"
          value={`£${metrics.revenue_this_month.toLocaleString('en-GB')}`}
          sub={`${margin}% margin`} color="bg-blue-500" />
        <KpiCard icon={FileText} label="Pending Timesheets" value={metrics.pending_timesheets}
          sub="awaiting approval" color="bg-yellow-500" />
      </div>

      {/* Charts — stacked on mobile, side by side on lg */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="card p-4 sm:p-5 lg:col-span-2">
          <h2 className="font-semibold text-sm sm:text-base mb-4 flex items-center gap-2">
            <Activity size={15} className="text-blue-500 shrink-0" />
            Revenue vs Payroll (Last 6 months)
          </h2>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={50} />
                <Tooltip formatter={(v: number) => `£${v.toLocaleString('en-GB')}`} />
                <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} dot={false} name="Revenue" />
                <Line type="monotone" dataKey="payroll" stroke="#ef4444" strokeWidth={2} dot={false} name="Payroll" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-44 flex items-center justify-center text-gray-400 text-sm">No data yet</div>
          )}
        </div>

        <div className="card p-4 sm:p-5">
          <h2 className="font-semibold text-sm sm:text-base mb-4 flex items-center gap-2">
            <TrendingUp size={15} className="text-blue-500 shrink-0" /> Revenue by Client
          </h2>
          {financial?.revenueByClient?.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={financial.revenueByClient} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={70} />
                <Tooltip formatter={(v: number) => `£${Math.round(v).toLocaleString('en-GB')}`} />
                <Bar dataKey="revenue" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-44 flex items-center justify-center text-gray-400 text-sm">No data yet</div>
          )}
        </div>
      </div>

      {/* Shifts + Incidents — stacked on mobile, side by side on lg */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="card p-4 sm:p-5">
          <h2 className="font-semibold text-sm sm:text-base mb-3 flex items-center gap-2">
            <Clock size={15} className="text-blue-500 shrink-0" />
            Today's Shifts ({metrics.today_shifts})
          </h2>
          <div className="space-y-1 max-h-64 overflow-y-auto -mx-1 px-1">
            {metrics.today_shift_list.length === 0 && (
              <p className="text-gray-400 text-sm py-4 text-center">No shifts today</p>
            )}
            {metrics.today_shift_list.map(shift => (
              <div key={shift.id} className="flex items-center justify-between py-2 border-b last:border-0 gap-2 min-w-0">
                <div className="min-w-0">
                  <div className="text-sm font-medium flex items-center gap-1 truncate">
                    <MapPin size={11} className="text-gray-400 shrink-0" />
                    <span className="truncate">{shift.site_name}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 truncate">
                    {shift.first_name ? `${shift.first_name} ${shift.last_name}` : 'Unassigned'}
                    {' · '}
                    {format(new Date(shift.start_time), 'HH:mm')}–{format(new Date(shift.end_time), 'HH:mm')}
                  </div>
                </div>
                <div className="shrink-0"><StatusBadge status={shift.status} /></div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-4 sm:p-5">
          <h2 className="font-semibold text-sm sm:text-base mb-3 flex items-center gap-2">
            <Shield size={15} className="text-red-500 shrink-0" /> Recent Incidents
          </h2>
          <div className="space-y-1 max-h-64 overflow-y-auto -mx-1 px-1">
            {metrics.recent_incidents.length === 0 && (
              <p className="text-gray-400 text-sm py-4 text-center">No incidents recorded</p>
            )}
            {metrics.recent_incidents.map(inc => (
              <div key={inc.id} className="flex items-start justify-between py-2 border-b last:border-0 gap-2 min-w-0">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{inc.type}</div>
                  <div className="text-xs text-gray-500 truncate">
                    {inc.site_name} · {inc.first_name} {inc.last_name}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {format(new Date(inc.created_at), 'MMM d, HH:mm')}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <StatusBadge status={inc.severity} />
                  <span className={`text-xs ${inc.resolved ? 'text-green-600' : 'text-red-500'}`}>
                    {inc.resolved ? 'Resolved' : 'Open'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
