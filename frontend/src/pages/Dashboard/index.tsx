import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { dashboardApi } from '../../api'
import { DashboardMetrics } from '../../types'
import {
  Users, AlertCircle, Clock, FileText, TrendingUp, Shield,
  MapPin, Activity, ChevronRight, UserX
} from 'lucide-react'
import StatusBadge from '../../components/StatusBadge'
import InstallPromptButton from '../../components/InstallPromptButton'
import PrivacyDialog from '../../components/PrivacyDialog'
import { format, isPast, differenceInMinutes } from 'date-fns'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar
} from 'recharts'

const MONTH_LABELS: Record<string, string> = {
  '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr',
  '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Aug',
  '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec',
}

function KpiCard({ icon: Icon, label, value, sub, color, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className="card p-4 sm:p-5 flex items-start gap-3 sm:gap-4 text-left w-full hover:shadow-md transition-shadow group"
    >
      <div className={`p-2.5 sm:p-3 rounded-lg shrink-0 ${color}`}>
        <Icon size={18} className="text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs sm:text-sm text-gray-500 truncate">{label}</p>
        <p className="text-xl sm:text-2xl font-bold mt-0.5 truncate">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5 truncate">{sub}</p>}
      </div>
      <ChevronRight size={15} className="text-gray-300 group-hover:text-gray-500 shrink-0 self-center transition-colors" />
    </button>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [financial, setFinancial] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showPrivacy, setShowPrivacy] = useState(false)

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

  // Shifts that started >5 min ago but guard hasn't clocked in
  const lateClockIns = metrics.today_shift_list.filter(s =>
    s.status === 'assigned' &&
    isPast(new Date(s.start_time)) &&
    differenceInMinutes(new Date(), new Date(s.start_time)) >= 5
  )

  const margin = metrics.revenue_this_month > 0
    ? Math.round(((metrics.revenue_this_month - metrics.payroll_cost_this_month) / metrics.revenue_this_month) * 100)
    : 0

  const chartData = (financial?.monthlyRevenue || []).map((r: any) => {
    const payrollEntry = financial?.monthlyPayroll?.find((p: any) => p.month === r.month)
    // r.month is "YYYY-MM" — convert "MM" part to month name
    const monthCode = r.month.substring(5)   // "04"
    const monthLabel = MONTH_LABELS[monthCode] ?? monthCode
    const yearSuffix = `'${r.month.substring(2, 4)}`  // "'26"
    return {
      month: `${monthLabel} ${yearSuffix}`,
      revenue: Math.round(r.revenue || 0),
      payroll: Math.round(payrollEntry?.cost || 0),
    }
  })

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      {showPrivacy && <PrivacyDialog onClose={() => setShowPrivacy(false)} />}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">{format(new Date(), 'EEEE, d MMMM yyyy')}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setShowPrivacy(true)} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
            Privacy
          </button>
          <InstallPromptButton className="!w-auto px-4 py-2 text-xs" />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard icon={Users}       label="Guards On Duty"      value={metrics.guards_on_duty}
          sub={`of ${metrics.total_guards} total`}        color="bg-green-500"
          onClick={() => navigate('/guards')} />
        <KpiCard icon={AlertCircle} label="Uncovered Shifts"    value={metrics.uncovered_shifts}
          sub="today"                                     color={metrics.uncovered_shifts > 0 ? 'bg-red-500' : 'bg-gray-400'}
          onClick={() => navigate('/scheduling')} />
        <KpiCard icon={TrendingUp}  label="Revenue (Month)"
          value={`£${metrics.revenue_this_month.toLocaleString('en-GB')}`}
          sub={`${margin}% margin`}                       color="bg-blue-500"
          onClick={() => navigate('/financial')} />
        <KpiCard icon={FileText}    label="Pending Timesheets"  value={metrics.pending_timesheets}
          sub="awaiting approval"                         color="bg-yellow-500"
          onClick={() => navigate('/timesheets')} />
      </div>

      {/* Late clock-in alert */}
      {lateClockIns.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <UserX size={16} className="text-red-600 shrink-0" />
            <h2 className="font-semibold text-red-700 text-sm">
              Late Clock-In{lateClockIns.length > 1 ? `s (${lateClockIns.length})` : ''} — Guards Not Clocked In
            </h2>
          </div>
          <div className="space-y-1.5">
            {lateClockIns.map(s => {
              const minsLate = differenceInMinutes(new Date(), new Date(s.start_time))
              return (
                <button
                  key={s.id}
                  onClick={() => navigate('/scheduling')}
                  className="flex items-center justify-between w-full text-left hover:bg-red-100 rounded-lg px-2 py-1.5 transition-colors"
                >
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-red-800 truncate block">
                      {s.first_name ? `${s.first_name} ${s.last_name}` : 'Unassigned'} — {s.site_name}
                    </span>
                    <span className="text-xs text-red-600">
                      Was due at {format(new Date(s.start_time), 'HH:mm')} · {minsLate} min{minsLate !== 1 ? 's' : ''} late
                    </span>
                  </div>
                  <ChevronRight size={14} className="text-red-400 shrink-0 ml-2" />
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="card p-4 sm:p-5 lg:col-span-2">
          <h2 className="font-semibold text-sm sm:text-base mb-4 flex items-center gap-2">
            <Activity size={15} className="text-blue-500 shrink-0" />
            Revenue vs Payroll — Last 6 Months
          </h2>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={55} tickFormatter={(v: number) => `£${(v/1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(v: number, name: string) => [`£${v.toLocaleString('en-GB')}`, name === 'revenue' ? 'Revenue' : 'Payroll']}
                  labelStyle={{ fontWeight: 600 }}
                />
                <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} name="Revenue" />
                <Line type="monotone" dataKey="payroll" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} name="Payroll" />
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
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v: number) => `£${(v/1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={70} />
                <Tooltip formatter={(v: number) => [`£${Math.round(v).toLocaleString('en-GB')}`, 'Revenue']} />
                <Bar dataKey="revenue" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-44 flex items-center justify-center text-gray-400 text-sm">No data yet</div>
          )}
        </div>
      </div>

      {/* Shifts + Incidents */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Today's Shifts */}
        <div className="card p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm sm:text-base flex items-center gap-2">
              <Clock size={15} className="text-blue-500 shrink-0" />
              Today's Shifts ({metrics.today_shifts})
            </h2>
            <button onClick={() => navigate('/scheduling')} className="text-xs text-blue-500 hover:underline">
              View all
            </button>
          </div>
          <div className="space-y-1 max-h-64 overflow-y-auto -mx-1 px-1">
            {metrics.today_shift_list.length === 0 && (
              <p className="text-gray-400 text-sm py-4 text-center">No shifts today</p>
            )}
            {metrics.today_shift_list.map(shift => (
              <button
                key={shift.id}
                onClick={() => navigate('/scheduling')}
                className="flex items-center justify-between w-full py-2 border-b last:border-0 gap-2 min-w-0 hover:bg-gray-50 rounded px-1 -mx-1 transition-colors group"
              >
                <div className="min-w-0 text-left">
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
                <div className="shrink-0 flex items-center gap-1">
                  <StatusBadge status={shift.status} />
                  <ChevronRight size={12} className="text-gray-300 group-hover:text-gray-500" />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Recent Incidents */}
        <div className="card p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm sm:text-base flex items-center gap-2">
              <Shield size={15} className="text-red-500 shrink-0" /> Recent Incidents
            </h2>
            <button onClick={() => navigate('/incidents')} className="text-xs text-blue-500 hover:underline">
              View all
            </button>
          </div>
          <div className="space-y-1 max-h-64 overflow-y-auto -mx-1 px-1">
            {metrics.recent_incidents.length === 0 && (
              <p className="text-gray-400 text-sm py-4 text-center">No incidents recorded</p>
            )}
            {metrics.recent_incidents.map(inc => (
              <button
                key={inc.id}
                onClick={() => navigate('/incidents')}
                className="flex items-start justify-between w-full py-2 border-b last:border-0 gap-2 min-w-0 hover:bg-gray-50 rounded px-1 -mx-1 transition-colors group"
              >
                <div className="min-w-0 text-left">
                  <div className="text-sm font-medium truncate">{inc.type}</div>
                  <div className="text-xs text-gray-500 truncate">
                    {inc.site_name}{inc.first_name ? ` · ${inc.first_name} ${inc.last_name}` : ''}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {format(new Date(inc.created_at), 'd MMM, HH:mm')}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <StatusBadge status={inc.severity} />
                  <span className={`text-xs ${inc.resolved ? 'text-green-600' : 'text-red-500'}`}>
                    {inc.resolved ? 'Resolved' : 'Open'}
                  </span>
                  <ChevronRight size={12} className="text-gray-300 group-hover:text-gray-500" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
