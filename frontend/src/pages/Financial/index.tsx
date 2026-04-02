import { useEffect, useState } from 'react'
import { dashboardApi } from '../../api'
import { FinancialData } from '../../types'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell
} from 'recharts'
import { TrendingUp, TrendingDown, PoundSterling, Users } from 'lucide-react'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

export default function Financial() {
  const [data, setData] = useState<FinancialData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    dashboardApi.financial().then(setData).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-6 text-gray-400">Loading financial data...</div>
  if (!data) return null

  // Merged monthly chart
  const monthlyChart = data.monthlyRevenue.map(r => {
    const payroll = data.monthlyPayroll.find(p => p.month === r.month)
    const revenue = Math.round(r.revenue || 0)
    const cost = Math.round(payroll?.cost || 0)
    return {
      month: r.month.substring(5),
      Revenue: revenue,
      Payroll: cost,
      Profit: revenue - cost,
    }
  })

  const totalRevenue = data.monthlyRevenue.reduce((s, r) => s + (r.revenue || 0), 0)
  const totalPayroll = data.monthlyPayroll.reduce((s, r) => s + (r.cost || 0), 0)
  const totalProfit = totalRevenue - totalPayroll
  const margin = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Financial Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Last 6 months overview</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-2 text-blue-600 mb-2">
            <PoundSterling size={18} /><span className="text-sm font-medium">Total Revenue</span>
          </div>
          <div className="text-2xl font-bold">£{Math.round(totalRevenue).toLocaleString('en-GB')}</div>
          <div className="text-xs text-gray-400 mt-1">6-month period</div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 text-red-500 mb-2">
            <TrendingDown size={18} /><span className="text-sm font-medium">Total Payroll</span>
          </div>
          <div className="text-2xl font-bold">£{Math.round(totalPayroll).toLocaleString('en-GB')}</div>
          <div className="text-xs text-gray-400 mt-1">6-month period</div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 text-green-600 mb-2">
            <TrendingUp size={18} /><span className="text-sm font-medium">Total Profit</span>
          </div>
          <div className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            £{Math.round(totalProfit).toLocaleString('en-GB')}
          </div>
          <div className="text-xs text-gray-400 mt-1">{margin}% margin</div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 text-purple-600 mb-2">
            <Users size={18} /><span className="text-sm font-medium">Top Earner Hours</span>
          </div>
          <div className="text-2xl font-bold">
            {data.guardUtilization[0] ? Math.round(data.guardUtilization[0].hours_worked || 0) : 0}h
          </div>
          <div className="text-xs text-gray-400 mt-1">{data.guardUtilization[0]?.name || '—'}</div>
        </div>
      </div>

      {/* Revenue vs Payroll vs Profit */}
      <div className="card p-5">
        <h2 className="font-semibold mb-4">Monthly Revenue, Payroll & Profit</h2>
        {monthlyChart.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={monthlyChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: number) => `£${v.toLocaleString('en-GB')}`} />
              <Legend />
              <Line type="monotone" dataKey="Revenue" stroke="#3b82f6" strokeWidth={2} dot />
              <Line type="monotone" dataKey="Payroll" stroke="#ef4444" strokeWidth={2} dot />
              <Line type="monotone" dataKey="Profit" stroke="#10b981" strokeWidth={2} dot strokeDasharray="5 5" />
            </LineChart>
          </ResponsiveContainer>
        ) : <div className="h-48 flex items-center justify-center text-gray-400">No data yet</div>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Client */}
        <div className="card p-5">
          <h2 className="font-semibold mb-4">Revenue by Client</h2>
          {data.revenueByClient.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={data.revenueByClient} dataKey="revenue" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`}>
                    {data.revenueByClient.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `£${Math.round(v).toLocaleString('en-GB')}`} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {data.revenueByClient.map((c, i) => (
                  <div key={c.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span>{c.name}</span>
                    </div>
                    <span className="font-semibold">£{Math.round(c.revenue).toLocaleString('en-GB')}</span>
                  </div>
                ))}
              </div>
            </>
          ) : <div className="h-48 flex items-center justify-center text-gray-400">No data</div>}
        </div>

        {/* Guard Utilization */}
        <div className="card p-5">
          <h2 className="font-semibold mb-4">Guard Utilization (Last 30 Days)</h2>
          {data.guardUtilization.filter(g => g.hours_worked > 0).length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.guardUtilization.filter(g => g.hours_worked > 0)} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 11 }} unit="h" />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                <Tooltip formatter={(v: number) => `${Math.round(v)}h`} />
                <Bar dataKey="hours_worked" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Hours Worked" />
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="h-48 flex items-center justify-center text-gray-400">No data</div>}
        </div>
      </div>
    </div>
  )
}
