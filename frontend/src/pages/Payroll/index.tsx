import { useEffect, useState } from 'react'
import { PayrollRecord } from '../../types'
import { payrollApi } from '../../api'
import StatusBadge from '../../components/StatusBadge'
import { format } from 'date-fns'
import { Download, RefreshCw, PoundSterling, AlertCircle } from 'lucide-react'

export default function Payroll() {
  const [records, setRecords] = useState<PayrollRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const load = () => payrollApi.list().then(setRecords).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const generate = async () => {
    if (!periodStart || !periodEnd) { setError('Select a period'); return }
    setGenerating(true); setError(''); setSuccess('')
    try {
      const result = await payrollApi.generate(periodStart, periodEnd)
      setSuccess(`Generated ${result.generated} payroll record(s)`)
      load()
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to generate payroll')
    } finally {
      setGenerating(false)
    }
  }

  const markPaid = async (id: number) => {
    if (!confirm('Mark this record as paid?')) return
    await payrollApi.update(id, { status: 'paid' })
    load()
  }

  const exportCsv = () => {
    const rows = [
      ['Guard', 'Period', 'Regular Hrs', 'OT Hrs', 'Regular Pay', 'OT Pay', 'Bonuses', 'Deductions', 'Gross Pay', 'Net Pay', 'Status'],
      ...records.map(r => [
        `${r.first_name} ${r.last_name}`,
        `${r.period_start} to ${r.period_end}`,
        r.regular_hours, r.overtime_hours,
        r.regular_pay.toFixed(2), r.overtime_pay.toFixed(2),
        r.bonuses.toFixed(2), r.deductions.toFixed(2),
        r.gross_pay.toFixed(2), r.net_pay.toFixed(2),
        r.status,
      ])
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'payroll.csv'; a.click()
  }

  const totalGross = records.filter(r => r.status !== 'paid').reduce((s, r) => s + r.gross_pay, 0)
  const totalNet = records.filter(r => r.status !== 'paid').reduce((s, r) => s + r.net_pay, 0)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Payroll</h1>
          <p className="text-gray-500 text-sm mt-1">Generate from approved timesheets</p>
        </div>
        <button className="btn-secondary flex items-center gap-2" onClick={exportCsv}>
          <Download size={16} /> Export CSV
        </button>
      </div>

      {/* Generate Payroll Panel */}
      <div className="card p-5">
        <h2 className="font-semibold mb-4">Generate Payroll Period</h2>
        <div className="flex items-end gap-3">
          <div>
            <label className="label">Period Start</label>
            <input className="input" type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} />
          </div>
          <div>
            <label className="label">Period End</label>
            <input className="input" type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} />
          </div>
          <button className="btn-primary flex items-center gap-2" onClick={generate} disabled={generating}>
            <RefreshCw size={16} className={generating ? 'animate-spin' : ''} />
            {generating ? 'Generating...' : 'Generate Payroll'}
          </button>
        </div>
        {error && (
          <div className="mt-3 text-red-600 text-sm flex items-center gap-1">
            <AlertCircle size={14} /> {error}
          </div>
        )}
        {success && (
          <div className="mt-3 text-green-600 text-sm">{success}</div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="text-sm text-gray-500">Pending Gross Pay</div>
          <div className="text-2xl font-bold mt-1">£{totalGross.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
        <div className="card p-4">
          <div className="text-sm text-gray-500">Pending Net Pay</div>
          <div className="text-2xl font-bold mt-1">£{totalNet.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
        <div className="card p-4">
          <div className="text-sm text-gray-500">Total Records</div>
          <div className="text-2xl font-bold mt-1">{records.length}</div>
        </div>
      </div>

      {/* Records Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Guard</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Period</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Reg Hrs</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">OT Hrs</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Regular Pay</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">OT Pay</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Deductions</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Net Pay</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
            ) : records.length === 0 ? (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400">No payroll records. Generate from approved timesheets.</td></tr>
            ) : records.map(r => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{r.first_name} {r.last_name}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {format(new Date(r.period_start), 'MMM d')} – {format(new Date(r.period_end), 'MMM d')}
                </td>
                <td className="px-4 py-3 text-right">{r.regular_hours}h</td>
                <td className="px-4 py-3 text-right">
                  {r.overtime_hours > 0 ? <span className="text-orange-600">{r.overtime_hours}h</span> : '—'}
                </td>
                <td className="px-4 py-3 text-right">£{r.regular_pay.toFixed(2)}</td>
                <td className="px-4 py-3 text-right">£{r.overtime_pay.toFixed(2)}</td>
                <td className="px-4 py-3 text-right text-red-500">-£{r.deductions.toFixed(2)}</td>
                <td className="px-4 py-3 text-right font-semibold">£{r.net_pay.toFixed(2)}</td>
                <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                <td className="px-4 py-3">
                  {r.status === 'pending' && (
                    <button
                      className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                      onClick={() => markPaid(r.id)}
                    >
                      <PoundSterling size={13} /> Mark Paid
                    </button>
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
