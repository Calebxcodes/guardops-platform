import { useState, useEffect } from 'react'
import { CalendarOff, Plus, Clock, CheckCircle, XCircle, ChevronDown } from 'lucide-react'
import { timeOffApi } from '../../api'
import clsx from 'clsx'

interface LeaveType {
  id: number
  name: string
  paid: number
  max_days_per_year: number | null
  requires_approval: number
}

interface LeaveRequest {
  id: number
  type_name: string
  paid: number
  start_date: string
  end_date: string
  days: number
  reason: string | null
  status: 'pending' | 'approved' | 'rejected'
  review_note: string | null
  created_at: string
}

const statusConfig = {
  pending:  { label: 'Pending',  colour: 'text-amber-400',  bg: 'bg-amber-400/10',  icon: Clock },
  approved: { label: 'Approved', colour: 'text-emerald-400', bg: 'bg-emerald-400/10', icon: CheckCircle },
  rejected: { label: 'Rejected', colour: 'text-red-400',    bg: 'bg-red-400/10',    icon: XCircle },
}

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function TimeOff() {
  const [tab, setTab] = useState<'submit' | 'history'>('submit')

  // Form state
  const [types, setTypes] = useState<LeaveType[]>([])
  const [typeId, setTypeId] = useState<number | ''>('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitSuccess, setSubmitSuccess] = useState(false)

  // History state
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [noTenant, setNoTenant] = useState(false)

  useEffect(() => {
    timeOffApi.types()
      .then(data => setTypes(data))
      .catch(err => {
        if (err.response?.status === 403) setNoTenant(true)
      })
  }, [])

  useEffect(() => {
    if (tab === 'history') loadHistory()
  }, [tab])

  async function loadHistory() {
    setLoadingHistory(true)
    try {
      const data = await timeOffApi.myRequests()
      setRequests(data)
    } catch { /* handled by api interceptor */ }
    finally { setLoadingHistory(false) }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!typeId || !startDate || !endDate) return
    setSubmitting(true)
    setSubmitError('')
    try {
      await timeOffApi.submit({ type_id: Number(typeId), start_date: startDate, end_date: endDate, reason: reason || undefined })
      setSubmitSuccess(true)
      setTypeId('')
      setStartDate('')
      setEndDate('')
      setReason('')
      setTimeout(() => setSubmitSuccess(false), 4000)
    } catch (err: any) {
      setSubmitError(err.response?.data?.error || 'Failed to submit request. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const days = startDate && endDate
    ? Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1
    : 0

  if (noTenant) {
    return (
      <div className="flex flex-col items-center justify-center h-64 px-6 text-center">
        <CalendarOff size={40} className="text-white/20 mb-4" />
        <p className="text-white/60 text-sm">Time off requests require an updated login.</p>
        <p className="text-white/40 text-xs mt-2">Please log out and log back in to enable this feature.</p>
      </div>
    )
  }

  return (
    <div className="pb-6">
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-lg font-semibold text-white">Time Off</h1>
        <p className="text-white/40 text-xs mt-0.5">Submit and track leave requests</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 mb-4">
        {(['submit', 'history'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              'flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
              tab === t ? 'bg-brand-600 text-white' : 'bg-white/5 text-white/50 hover:text-white/70'
            )}
          >
            {t === 'submit' ? 'New Request' : 'My Requests'}
          </button>
        ))}
      </div>

      {tab === 'submit' && (
        <form onSubmit={handleSubmit} className="px-4 space-y-4">
          {submitSuccess && (
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
              <CheckCircle size={16} className="text-emerald-400 shrink-0" />
              <span className="text-emerald-300 text-sm">Request submitted successfully!</span>
            </div>
          )}
          {submitError && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <XCircle size={16} className="text-red-400 shrink-0" />
              <span className="text-red-300 text-sm">{submitError}</span>
            </div>
          )}

          {/* Leave type */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/60 uppercase tracking-wide">Leave Type</label>
            <div className="relative">
              <select
                value={typeId}
                onChange={e => setTypeId(Number(e.target.value))}
                required
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm appearance-none focus:outline-none focus:border-brand-500"
              >
                <option value="" disabled className="bg-gray-900">Select leave type…</option>
                {types.map(t => (
                  <option key={t.id} value={t.id} className="bg-gray-900">
                    {t.name}{t.paid ? '' : ' (Unpaid)'}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
            </div>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white/60 uppercase tracking-wide">Start Date</label>
              <input
                type="date"
                value={startDate}
                min={new Date().toISOString().slice(0, 10)}
                onChange={e => setStartDate(e.target.value)}
                required
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-500 [color-scheme:dark]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white/60 uppercase tracking-wide">End Date</label>
              <input
                type="date"
                value={endDate}
                min={startDate || new Date().toISOString().slice(0, 10)}
                onChange={e => setEndDate(e.target.value)}
                required
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-500 [color-scheme:dark]"
              />
            </div>
          </div>

          {days > 0 && (
            <p className="text-white/40 text-xs text-center">
              {days} day{days !== 1 ? 's' : ''} selected
            </p>
          )}

          {/* Reason */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/60 uppercase tracking-wide">Reason <span className="normal-case text-white/30">(optional)</span></label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              placeholder="Add a note for your manager…"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-brand-500 resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !typeId || !startDate || !endDate}
            className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium py-3 rounded-xl transition-colors"
          >
            <Plus size={18} />
            {submitting ? 'Submitting…' : 'Submit Request'}
          </button>
        </form>
      )}

      {tab === 'history' && (
        <div className="px-4 space-y-3">
          {loadingHistory ? (
            <div className="flex justify-center py-12">
              <div className="w-7 h-7 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CalendarOff size={36} className="text-white/20 mb-3" />
              <p className="text-white/40 text-sm">No requests yet</p>
            </div>
          ) : (
            requests.map(r => {
              const cfg = statusConfig[r.status] ?? statusConfig.pending
              const Icon = cfg.icon
              return (
                <div key={r.id} className="bg-white/5 border border-white/8 rounded-xl p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-white font-medium text-sm">{r.type_name}</p>
                      <p className="text-white/40 text-xs mt-0.5">
                        {fmt(r.start_date)} – {fmt(r.end_date)} · {r.days} day{r.days !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <span className={clsx('flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full', cfg.colour, cfg.bg)}>
                      <Icon size={12} />
                      {cfg.label}
                    </span>
                  </div>
                  {r.reason && (
                    <p className="text-white/40 text-xs border-t border-white/5 pt-2">{r.reason}</p>
                  )}
                  {r.review_note && (
                    <p className={clsx('text-xs border-t border-white/5 pt-2', cfg.colour)}>
                      Manager note: {r.review_note}
                    </p>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
