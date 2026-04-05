import { useEffect, useState } from 'react'
import { Timesheet } from '../../types'
import { timesheetsApi } from '../../api'
import StatusBadge from '../../components/StatusBadge'
import Modal from '../../components/Modal'
import { format } from 'date-fns'
import { CheckSquare, Plus, Filter } from 'lucide-react'
import TimesheetForm from './TimesheetForm'
import TimesheetDetail from './TimesheetDetail'

export default function Timesheets() {
  const [timesheets, setTimesheets] = useState<Timesheet[]>([])
  const [total,       setTotal]       = useState(0)
  const [page,        setPage]        = useState(1)
  const PAGE_SIZE = 50
  const [statusFilter, setStatusFilter] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [showForm, setShowForm] = useState(false)
  const [viewDetail, setViewDetail] = useState<Timesheet | null>(null)
  const [loading, setLoading] = useState(true)

  const load = (p = 1, filter = statusFilter) => {
    const params: any = { page: p, limit: PAGE_SIZE }
    if (filter) params.status = filter
    timesheetsApi.list(params)
      .then(r => { setTimesheets(r.data); setTotal(r.total); setPage(p) })
      .finally(() => setLoading(false))
  }
  useEffect(() => { load(1, statusFilter) }, [statusFilter])

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectAll = () => {
    const approvable = timesheets.filter(t => t.status === 'submitted').map(t => t.id)
    setSelected(new Set(approvable))
  }

  const bulkApprove = async () => {
    if (!selected.size) return
    if (!confirm(`Approve ${selected.size} timesheet(s)?`)) return
    await timesheetsApi.bulkApprove([...selected])
    setSelected(new Set())
    load()
  }

  const submittedCount = timesheets.filter(t => t.status === 'submitted').length
  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Timesheets</h1>
          <p className="text-gray-500 text-sm mt-0.5">{submittedCount} pending approval</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {selected.size > 0 && (
            <button className="btn-primary flex items-center gap-1.5 text-sm" onClick={bulkApprove}>
              <CheckSquare size={15} /> Approve {selected.size}
            </button>
          )}
          <button className="btn-secondary text-sm" onClick={selectAll}>
            <span className="hidden sm:inline">Select Submitted</span><span className="sm:hidden">Select</span>
          </button>
          <button className="btn-primary flex items-center gap-1.5 text-sm" onClick={() => setShowForm(true)}>
            <Plus size={15} /><span className="hidden sm:inline">New Entry</span><span className="sm:hidden">New</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="overflow-x-auto pb-1">
        <div className="flex bg-gray-100 rounded-lg p-1 w-max">
          {['', 'draft', 'submitted', 'approved', 'rejected'].map(s => (
            <button
              key={s}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors capitalize whitespace-nowrap ${statusFilter === s ? 'bg-white shadow-sm' : 'text-gray-600'}`}
              onClick={() => setStatusFilter(s)}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 w-8"></th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Guard</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Period</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Regular</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Overtime</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Total</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Source</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
            ) : timesheets.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No timesheets found</td></tr>
            ) : timesheets.map(ts => (
              <tr key={ts.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  {ts.status === 'submitted' && (
                    <input
                      type="checkbox"
                      checked={selected.has(ts.id)}
                      onChange={() => toggleSelect(ts.id)}
                      className="rounded"
                    />
                  )}
                </td>
                <td className="px-4 py-3 font-medium">{ts.first_name} {ts.last_name}</td>
                <td className="px-4 py-3 text-gray-500">
                  {format(new Date(ts.period_start), 'MMM d')} – {format(new Date(ts.period_end), 'MMM d, yyyy')}
                </td>
                <td className="px-4 py-3">{ts.regular_hours}h</td>
                <td className="px-4 py-3">
                  {ts.overtime_hours > 0 ? (
                    <span className="text-orange-600 font-medium">{ts.overtime_hours}h</span>
                  ) : '—'}
                </td>
                <td className="px-4 py-3 font-semibold">{ts.total_hours}h</td>
                <td className="px-4 py-3 text-gray-400 capitalize">{ts.source}</td>
                <td className="px-4 py-3"><StatusBadge status={ts.status} /></td>
                <td className="px-4 py-3">
                  <button
                    className="text-sm text-blue-600 hover:underline"
                    onClick={() => setViewDetail(ts)}
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t flex items-center justify-between text-sm text-gray-500">
            <span>Page {page} of {totalPages} · {total} entries</span>
            <div className="flex gap-1">
              <button disabled={page <= 1} onClick={() => load(page - 1)}
                className="px-3 py-1 rounded border hover:bg-gray-50 disabled:opacity-30 text-xs">Prev</button>
              <button disabled={page >= totalPages} onClick={() => load(page + 1)}
                className="px-3 py-1 rounded border hover:bg-gray-50 disabled:opacity-30 text-xs">Next</button>
            </div>
          </div>
        )}
      </div>

      {showForm && (
        <Modal title="New Timesheet Entry" onClose={() => setShowForm(false)}>
          <TimesheetForm
            onSave={async (data) => { await timesheetsApi.create(data); setShowForm(false); load(1) }}
            onCancel={() => setShowForm(false)}
          />
        </Modal>
      )}

      {viewDetail && (
        <Modal title="Timesheet Detail" onClose={() => setViewDetail(null)} size="md">
          <TimesheetDetail
            timesheet={viewDetail}
            onApprove={async () => {
              await timesheetsApi.update(viewDetail.id, { status: 'approved' })
              setViewDetail(null); load(page)
            }}
            onReject={async (notes) => {
              await timesheetsApi.update(viewDetail.id, { status: 'rejected', manager_notes: notes })
              setViewDetail(null); load(page)
            }}
            onClose={() => setViewDetail(null)}
          />
        </Modal>
      )}
    </div>
  )
}
