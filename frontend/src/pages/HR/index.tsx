import { useState, useEffect, useCallback } from 'react'
import {
  Briefcase, Clock, CheckCircle, XCircle, Calendar, ChevronDown,
  Search, SlidersHorizontal, X, ShieldCheck
} from 'lucide-react'
import { timeOffApi } from '../../api'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'

interface TimeOffRequest {
  id: number
  guard_id: number
  first_name: string
  last_name: string
  guard_email: string
  type_name: string
  paid: number
  start_date: string
  end_date: string
  days: number
  reason: string | null
  status: 'pending' | 'approved' | 'rejected'
  reviewed_by: number | null
  reviewer_name: string | null
  review_note: string | null
  reviewed_at: string | null
  created_at: string
}

const statusConfig = {
  pending:  { label: 'Pending',  colour: 'text-amber-400',  bg: 'bg-amber-400/10',   border: 'border-amber-400/20',  icon: Clock },
  approved: { label: 'Approved', colour: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/20', icon: CheckCircle },
  rejected: { label: 'Rejected', colour: 'text-red-400',    bg: 'bg-red-400/10',     border: 'border-red-400/20',    icon: XCircle },
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function ReviewModal({
  request,
  action,
  onConfirm,
  onCancel,
}: {
  request: TimeOffRequest
  action: 'approve' | 'reject'
  onConfirm: (note: string) => void
  onCancel: () => void
}) {
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    setLoading(true)
    onConfirm(note)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-white font-semibold text-lg">
              {action === 'approve' ? 'Approve' : 'Reject'} Request
            </h3>
            <p className="text-white/50 text-sm mt-0.5">
              {request.first_name} {request.last_name} · {request.type_name}
            </p>
          </div>
          <button onClick={onCancel} className="text-white/30 hover:text-white/60 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="bg-white/5 rounded-xl p-4 mb-4 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-white/50">Period</span>
            <span className="text-white">{fmt(request.start_date)} – {fmt(request.end_date)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-white/50">Duration</span>
            <span className="text-white">{request.days} day{request.days !== 1 ? 's' : ''}</span>
          </div>
          {request.reason && (
            <div className="flex justify-between text-sm">
              <span className="text-white/50">Reason</span>
              <span className="text-white text-right max-w-48">{request.reason}</span>
            </div>
          )}
        </div>

        <div className="mb-4">
          <label className="text-xs font-medium text-white/50 uppercase tracking-wide block mb-1.5">
            Note <span className="normal-case text-white/30">(optional)</span>
          </label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={3}
            placeholder="Add a message for the guard…"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-brand-500 resize-none"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-white/60 bg-white/5 hover:bg-white/10 text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className={clsx(
              'flex-1 py-2.5 rounded-xl text-white text-sm font-medium transition-colors disabled:opacity-50',
              action === 'approve'
                ? 'bg-emerald-600 hover:bg-emerald-500'
                : 'bg-red-600 hover:bg-red-500'
            )}
          >
            {loading ? 'Processing…' : action === 'approve' ? 'Approve' : 'Reject'}
          </button>
        </div>
      </div>
    </div>
  )
}

function RequestCard({
  r,
  onAction,
}: {
  r: TimeOffRequest
  onAction: (request: TimeOffRequest, action: 'approve' | 'reject') => void
}) {
  const cfg = statusConfig[r.status] ?? statusConfig.pending
  const Icon = cfg.icon

  return (
    <div className="bg-gray-900 border border-white/8 rounded-2xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-brand-600/20 flex items-center justify-center shrink-0">
            <span className="text-brand-400 font-semibold text-sm">
              {r.first_name[0]}{r.last_name[0]}
            </span>
          </div>
          <div>
            <p className="text-white font-medium">{r.first_name} {r.last_name}</p>
            <p className="text-white/40 text-xs">{r.guard_email}</p>
          </div>
        </div>
        <span className={clsx('flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border', cfg.colour, cfg.bg, cfg.border)}>
          <Icon size={12} />
          {cfg.label}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 text-sm">
        <div>
          <p className="text-white/40 text-xs mb-0.5">Type</p>
          <p className="text-white">{r.type_name}</p>
        </div>
        <div>
          <p className="text-white/40 text-xs mb-0.5">Period</p>
          <p className="text-white text-xs">{fmt(r.start_date)} – {fmt(r.end_date)}</p>
        </div>
        <div>
          <p className="text-white/40 text-xs mb-0.5">Days</p>
          <p className="text-white">{r.days} day{r.days !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {r.reason && (
        <p className="text-white/40 text-sm bg-white/3 rounded-lg px-3 py-2 border border-white/5">
          {r.reason}
        </p>
      )}

      {r.review_note && (
        <p className={clsx('text-sm bg-white/3 rounded-lg px-3 py-2 border', cfg.colour, cfg.border)}>
          Note: {r.review_note}
          {r.reviewer_name && <span className="text-white/30 text-xs"> — {r.reviewer_name}</span>}
        </p>
      )}

      {r.status === 'pending' && (
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => onAction(r, 'approve')}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-400 text-sm font-medium border border-emerald-600/20 transition-colors"
          >
            <CheckCircle size={15} />
            Approve
          </button>
          <button
            onClick={() => onAction(r, 'reject')}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-600/15 hover:bg-red-600/25 text-red-400 text-sm font-medium border border-red-600/20 transition-colors"
          >
            <XCircle size={15} />
            Reject
          </button>
        </div>
      )}
    </div>
  )
}

export default function HR() {
  const navigate = useNavigate()
  const [requests, setRequests] = useState<TimeOffRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('pending')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<{ request: TimeOffRequest; action: 'approve' | 'reject' } | null>(null)
  const [pendingCount, setPendingCount] = useState(0)

  const loadRequests = useCallback(async () => {
    setLoading(true)
    try {
      const params: any = {}
      if (statusFilter !== 'all') params.status = statusFilter
      const data = await timeOffApi.requests(params)
      setRequests(data)
    } catch { /* handled by interceptor */ }
    finally { setLoading(false) }
  }, [statusFilter])

  useEffect(() => { loadRequests() }, [loadRequests])
  useEffect(() => {
    timeOffApi.pendingCount().then(d => setPendingCount(d.count)).catch(() => {})
  }, [requests])

  async function handleAction(note: string) {
    if (!modal) return
    try {
      if (modal.action === 'approve') await timeOffApi.approve(modal.request.id, note)
      else await timeOffApi.reject(modal.request.id, note)
      setModal(null)
      loadRequests()
    } catch { /* handled */ }
  }

  const filtered = requests.filter(r => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      r.first_name.toLowerCase().includes(q) ||
      r.last_name.toLowerCase().includes(q) ||
      r.guard_email.toLowerCase().includes(q) ||
      r.type_name.toLowerCase().includes(q)
    )
  })

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {modal && (
        <ReviewModal
          request={modal.request}
          action={modal.action}
          onConfirm={handleAction}
          onCancel={() => setModal(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-600/20 rounded-xl flex items-center justify-center">
            <Briefcase size={20} className="text-brand-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">HR</h1>
            <p className="text-white/40 text-sm">
              {pendingCount > 0 ? `${pendingCount} request${pendingCount !== 1 ? 's' : ''} pending review` : 'Manage leave & compliance'}
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate('/hr/badges')}
          className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 text-sm font-medium px-4 py-2 rounded-xl transition-colors"
        >
          <ShieldCheck size={15} />
          Badge Verification
        </button>
      </div>

      {/* Section header for time off */}
      <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-4">Time Off Requests</p>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or type…"
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-brand-500"
          />
        </div>
        <div className="relative">
          <SlidersHorizontal size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl pl-9 pr-8 py-2.5 text-white text-sm appearance-none focus:outline-none focus:border-brand-500"
          >
            <option value="all" className="bg-gray-900">All Requests</option>
            <option value="pending" className="bg-gray-900">Pending</option>
            <option value="approved" className="bg-gray-900">Approved</option>
            <option value="rejected" className="bg-gray-900">Rejected</option>
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {(['pending', 'approved', 'rejected'] as const).map(s => {
          const cfg = statusConfig[s]
          const count = requests.filter(r => r.status === s).length
          const Icon = cfg.icon
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={clsx(
                'flex items-center gap-3 bg-white/5 border rounded-xl px-4 py-3 transition-all text-left',
                statusFilter === s ? `${cfg.border} ${cfg.bg}` : 'border-white/8 hover:border-white/15'
              )}
            >
              <Icon size={18} className={cfg.colour} />
              <div>
                <p className="text-white font-semibold">{count}</p>
                <p className="text-white/40 text-xs">{cfg.label}</p>
              </div>
            </button>
          )
        })}
      </div>

      {/* Requests */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Calendar size={40} className="text-white/15 mb-4" />
          <p className="text-white/40 text-sm">No requests found</p>
          {statusFilter !== 'all' && (
            <button onClick={() => setStatusFilter('all')} className="text-brand-400 text-sm mt-2 hover:underline">
              Show all requests
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(r => (
            <RequestCard key={r.id} r={r} onAction={(req, act) => setModal({ request: req, action: act })} />
          ))}
        </div>
      )}
    </div>
  )
}
