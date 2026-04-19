import { useState, useEffect } from 'react'
import { CheckCircle, AlertTriangle, Users, X, ClipboardCheck, Loader } from 'lucide-react'
import { shiftsApi } from '../api'
import { enqueue } from '../lib/offlineQueue'

interface Props {
  shiftId: number
  checkNumber: number
  onComplete: () => void
  onDismiss: () => void
}

interface ChecklistItem {
  id: number | null
  label: string
  description?: string
}

export default function HourlyChecksModal({ shiftId, checkNumber, onComplete, onDismiss }: Props) {
  const [items, setItems]       = useState<ChecklistItem[]>([])
  const [checked, setChecked]   = useState<boolean[]>([])
  const [loadingItems, setLoadingItems] = useState(true)
  const [headcount, setHeadcount] = useState('')
  const [notes, setNotes]       = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => {
    shiftsApi.getChecklist(shiftId)
      .then((data: ChecklistItem[]) => {
        setItems(data)
        setChecked(new Array(data.length).fill(false))
      })
      .catch(() => {
        // Fallback to 3 defaults if fetch fails
        const defaults = [
          { id: null, label: 'Fire Exit Check', description: 'All fire exits are clear, unlocked and unobstructed' },
          { id: null, label: 'Toilet Check',    description: 'Facilities are clean, functional and accessible' },
          { id: null, label: 'Lighting Check',  description: 'All interior and exterior lighting is operational' },
        ]
        setItems(defaults)
        setChecked([false, false, false])
      })
      .finally(() => setLoadingItems(false))
  }, [shiftId])

  const toggle = (i: number) => setChecked(c => c.map((v, idx) => idx === i ? !v : v))

  const handleSubmit = async () => {
    if (!headcount) { setError('Please enter a headcount'); return }
    setSubmitting(true)
    setError('')

    const payload = {
      headcount: parseInt(headcount, 10),
      notes: notes || undefined,
      items: items.map((item, i) => ({
        template_id: item.id,
        label: item.label,
        checked: checked[i] ?? false,
      })),
    }

    try {
      if (!navigator.onLine) throw Object.assign(new Error('offline'), { offline: true })
      await shiftsApi.submitCheck(shiftId, payload)
      onComplete()
    } catch (err: any) {
      if (err.offline || !err.response) {
        // Queue for later sync
        await enqueue({
          type: 'check',
          url: `/api/guard/shifts/${shiftId}/checks`,
          method: 'POST',
          data: payload,
          enqueuedAt: new Date().toISOString(),
        })
        onComplete() // optimistic — guard's check is recorded locally
        return
      }
      setError('Failed to submit check. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const allChecked = checked.every(Boolean)

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end justify-center z-50 p-0">
      <div className="bg-surface-card w-full max-w-lg rounded-t-3xl p-6 pb-10 shadow-2xl border-t border-white/10 animate-slide-up">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-brand-600/20 rounded-2xl flex items-center justify-center">
              <ClipboardCheck size={22} className="text-brand-400" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg leading-tight">Hourly Safety Check</h2>
              <p className="text-white/40 text-sm">Check #{checkNumber} · Required every hour</p>
            </div>
          </div>
          <button onClick={onDismiss} className="text-white/30 hover:text-white/60 p-1">
            <X size={20} />
          </button>
        </div>

        {/* Headcount */}
        <div className="mb-4">
          <label className="block text-white/60 text-sm font-medium mb-2 flex items-center gap-1.5">
            <Users size={14} className="text-blue-400" /> Headcount — people on premises
          </label>
          <input
            type="number"
            min="0"
            value={headcount}
            onChange={e => setHeadcount(e.target.value)}
            placeholder="e.g. 42"
            className="w-full bg-surface-elevated border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-lg font-semibold"
          />
        </div>

        {/* Check items */}
        {loadingItems ? (
          <div className="flex items-center justify-center py-6">
            <Loader size={20} className="text-white/30 animate-spin" />
          </div>
        ) : (
          <div className="space-y-2 mb-4">
            {items.map((item, i) => (
              <button
                key={i}
                type="button"
                onClick={() => toggle(i)}
                className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border transition-all text-left ${
                  checked[i]
                    ? 'bg-green-900/30 border-green-700/50'
                    : 'bg-surface-elevated border-white/10 hover:border-white/20'
                }`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  checked[i] ? 'bg-green-600' : 'bg-white/5'
                }`}>
                  <CheckCircle size={18} className={checked[i] ? 'text-white' : 'text-white/20'} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-semibold text-sm ${checked[i] ? 'text-green-300' : 'text-white/80'}`}>
                    {item.label}
                  </p>
                  {item.description && (
                    <p className="text-white/30 text-xs truncate">{item.description}</p>
                  )}
                </div>
                {!checked[i] && <AlertTriangle size={14} className="text-yellow-500/60 shrink-0" />}
              </button>
            ))}
          </div>
        )}

        {/* Notes */}
        <div className="mb-5">
          <label className="block text-white/40 text-xs font-medium mb-1.5">Notes / Issues Found (optional)</label>
          <textarea
            rows={2}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Any issues, observations or actions taken..."
            className="w-full bg-surface-elevated border border-white/10 rounded-xl px-3 py-2 text-white/80 text-sm placeholder-white/20 focus:outline-none focus:border-brand-500 resize-none"
          />
        </div>

        {error && (
          <p className="text-red-400 text-sm mb-3 flex items-center gap-1.5">
            <AlertTriangle size={14} /> {error}
          </p>
        )}

        {!allChecked && items.length > 0 && (
          <p className="text-yellow-500/70 text-xs mb-3 flex items-center gap-1.5">
            <AlertTriangle size={12} /> Tick each item after physically checking it
          </p>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting || !headcount || loadingItems}
          className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white font-bold rounded-2xl py-3.5 flex items-center justify-center gap-2 transition-colors"
        >
          {submitting ? 'Submitting…' : 'Submit Check'}
        </button>
      </div>
    </div>
  )
}
