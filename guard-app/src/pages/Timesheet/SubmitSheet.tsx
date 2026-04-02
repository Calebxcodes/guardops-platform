import { useState } from 'react'
import { CheckCircle, Loader, AlertCircle } from 'lucide-react'
import { timesheetsApi } from '../../api'
import { GuardTimesheet } from '../../types'
import BottomSheet from '../../components/ui/BottomSheet'
import StatusBadge from '../../components/ui/StatusBadge'
import { format } from 'date-fns'

interface Props {
  timesheet: GuardTimesheet | null
  onClose: () => void
  onSuccess: () => void
}

export default function SubmitSheet({ timesheet, onClose, onSuccess }: Props) {
  const [form, setForm] = useState({
    period_start: timesheet?.period_start || new Date().toISOString().split('T')[0],
    period_end: timesheet?.period_end || new Date().toISOString().split('T')[0],
    regular_hours: timesheet?.regular_hours ?? 8,
    overtime_hours: timesheet?.overtime_hours ?? 0,
    guard_notes: timesheet?.guard_notes || '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  const total = form.regular_hours + form.overtime_hours

  const handleSubmit = async () => {
    setError('')
    setSubmitting(true)
    try {
      if (timesheet) {
        await timesheetsApi.submit(timesheet.id, { ...form })
      } else {
        const ts = await timesheetsApi.manual(form)
        await timesheetsApi.submit(ts.id, { guard_notes: form.guard_notes })
      }
      setDone(true)
      setTimeout(onSuccess, 1500)
    } catch (e: any) {
      setError(e.response?.data?.error || 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  const isReadOnly = timesheet?.status === 'approved' || timesheet?.status === 'submitted'

  return (
    <BottomSheet title={timesheet ? 'Timesheet Detail' : 'New Timesheet'} onClose={onClose}>
      {done ? (
        <div className="text-center py-8">
          <CheckCircle size={48} className="text-green-400 mx-auto mb-3" />
          <p className="text-white font-semibold text-lg">Submitted!</p>
          <p className="text-white/40 text-sm mt-1">Pending manager approval</p>
        </div>
      ) : (
        <div className="space-y-4">
          {timesheet && (
            <div className="flex items-center justify-between">
              <span className="text-white/40 text-sm">Status</span>
              <StatusBadge status={timesheet.status} />
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-3 py-2.5 flex items-center gap-2 text-sm">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-white/40 text-xs mb-1.5">Period Start</label>
              <input
                type="date"
                className="w-full bg-surface rounded-xl px-3 py-2.5 text-white text-sm border border-white/10 focus:outline-none focus:border-brand-500 disabled:opacity-40"
                value={form.period_start}
                onChange={e => set('period_start', e.target.value)}
                disabled={isReadOnly}
              />
            </div>
            <div>
              <label className="block text-white/40 text-xs mb-1.5">Period End</label>
              <input
                type="date"
                className="w-full bg-surface rounded-xl px-3 py-2.5 text-white text-sm border border-white/10 focus:outline-none focus:border-brand-500 disabled:opacity-40"
                value={form.period_end}
                onChange={e => set('period_end', e.target.value)}
                disabled={isReadOnly}
              />
            </div>
            <div>
              <label className="block text-white/40 text-xs mb-1.5">Regular Hours</label>
              <input
                type="number" min="0" step="0.5"
                className="w-full bg-surface rounded-xl px-3 py-2.5 text-white text-sm border border-white/10 focus:outline-none focus:border-brand-500 disabled:opacity-40"
                value={form.regular_hours}
                onChange={e => set('regular_hours', parseFloat(e.target.value) || 0)}
                disabled={isReadOnly}
              />
            </div>
            <div>
              <label className="block text-white/40 text-xs mb-1.5">Overtime Hours</label>
              <input
                type="number" min="0" step="0.5"
                className="w-full bg-surface rounded-xl px-3 py-2.5 text-orange-300 text-sm border border-white/10 focus:outline-none focus:border-brand-500 disabled:opacity-40"
                value={form.overtime_hours}
                onChange={e => set('overtime_hours', parseFloat(e.target.value) || 0)}
                disabled={isReadOnly}
              />
            </div>
          </div>

          <div className="bg-surface rounded-xl px-4 py-3 flex justify-between items-center">
            <span className="text-white/50">Total hours</span>
            <span className="text-white font-bold text-lg">{total.toFixed(1)}h</span>
          </div>

          <div>
            <label className="block text-white/40 text-xs mb-1.5">Notes (optional)</label>
            <textarea
              rows={3}
              className="w-full bg-surface rounded-xl px-3 py-2.5 text-white text-sm border border-white/10 focus:outline-none focus:border-brand-500 resize-none disabled:opacity-40"
              placeholder="Any corrections or notes for your manager..."
              value={form.guard_notes}
              onChange={e => set('guard_notes', e.target.value)}
              disabled={isReadOnly}
            />
          </div>

          {timesheet?.manager_notes && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3">
              <p className="text-yellow-400 text-xs font-medium mb-1">Manager's Note</p>
              <p className="text-white/60 text-sm">{timesheet.manager_notes}</p>
            </div>
          )}

          {!isReadOnly && (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full py-4 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold rounded-xl flex items-center justify-center gap-2"
            >
              {submitting ? <Loader size={16} className="animate-spin" /> : <CheckCircle size={16} />}
              Submit Timesheet
            </button>
          )}
        </div>
      )}
    </BottomSheet>
  )
}
