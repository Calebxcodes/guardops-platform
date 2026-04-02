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
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar
} from 'recharts'

function KpiCard({ icon: Icon, label, value, sub, color }: any) {
  return (
    <div className="card p-5 flex items-start gap-4">
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
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
    <div className="flex items-center justify-center h-full">
      <div className="text-gray-400">Loading dashboard...</div>
    </div>
  )
  if (!metrics) return null

  const margin = metrics.revenue_this_month > 0
    ? Math.round(((metrics.revenue_this_month - metrics.payroll_cost_this_month) / metrics.revenue_this_month) * 100)
    : 0

  // Merge monthly revenue + payroll for chart
  const chartData = (financial?.monthlyRevenue || []).map((r: any) => {
    const payrollEntry = financial?.monthlyPayroll?.find((p: any) => p.month === r.month)
    return {
      month: r.month.substring(5), // MM
      revenue: Math.round(r.revenue || 0),
      payroll: Math.round(payrollEntry?.cost || 0),
    }
  })

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">{format(new Date(), 'EEEE, MMMM d yyyy')}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Users} label="Guards On Duty" value={metrics.guards_on_duty}
          sub={`of ${metrics.total_guards} total`} color="bg-green-500" />
        <KpiCard icon={AlertCircle} label="Uncovered Shifts" value={metrics.uncovered_shifts}
          sub="today" color={metrics.uncovered_shifts > 0 ? "bg-red-500" : "bg-gray-400"} />
        <KpiCard icon={TrendingUp} label="Revenue (Month)" value={`$${metrics.revenue_this_month.toLocaleString()}`}
          sub={`${margin}% margin`} color="bg-blue-500" />
        <KpiCard icon={FileText} label="Pending Timesheets" value={metrics.pending_timesheets}
          sub="awaiting approval" color="bg-yellow-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue chart */}
        <div className="card p-5 lg:col-span-2">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Activity size={16} className="text-blue-500" /> Revenue vs Payroll (Last 6 months)
          </h2>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} dot={false} name="Revenue" />
                <Line type="monotone" dataKey="payroll" stroke="#ef4444" strokeWidth={2} dot={false} name="Payroll" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data yet</div>
          )}
        </div>

        {/* Revenue by client */}
        <div className="card p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-blue-500" /> Revenue by Client
          </h2>
          {financial?.revenueByClient?.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={financial.revenueByClient} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                <Tooltip formatter={(v: number) => `$${Math.round(v).toLocaleString()}`} />
                <Bar dataKey="revenue" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data yet</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Shifts */}
        <div className="card p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Clock size={16} className="text-blue-500" /> Today's Shifts ({metrics.today_shifts})
          </h2>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {metrics.today_shift_list.length === 0 && (
              <p className="text-gray-400 text-sm">No shifts today</p>
            )}
            {metrics.today_shift_list.map(shift => (
              <div key={shift.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <div className="text-sm font-medium flex items-center gap-1">
                    <MapPin size={12} className="text-gray-400" />
                    {shift.site_name}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {shift.first_name ? `${shift.first_name} ${shift.last_name}` : 'Unassigned'}
                    {' · '}
                    {format(new Date(shift.start_time), 'HH:mm')} – {format(new Date(shift.end_time), 'HH:mm')}
                  </div>
                </div>
                <StatusBadge status={shift.status} />
              </div>
            ))}
          </div>
        </div>

        {/* Recent Incidents */}
        <div className="card p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Shield size={16} className="text-red-500" /> Recent Incidents
          </h2>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {metrics.recent_incidents.length === 0 && (
              <p className="text-gray-400 text-sm">No incidents recorded</p>
            )}
            {metrics.recent_incidents.map(inc => (
              <div key={inc.id} className="flex items-start justify-between py-2 border-b last:border-0">
                <div>
                  <div className="text-sm font-medium">{inc.type}</div>
                  <div className="text-xs text-gray-500">
                    {inc.site_name} · {inc.first_name} {inc.last_name}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {format(new Date(inc.created_at), 'MMM d, HH:mm')}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <StatusBadge status={inc.severity} />
                  {inc.resolved ? (
                    <span className="text-xs text-green-600">Resolved</span>
                  ) : (
                    <span className="text-xs text-red-500">Open</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
