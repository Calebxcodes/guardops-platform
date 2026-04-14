import { useState } from 'react'
import { CheckCircle, AlertTriangle, Users, Flame, Lightbulb, Bath, X, ClipboardCheck } from 'lucide-react'
import { shiftsApi } from '../api'

interface Props {
  shiftId: number
  checkNumber: number
  onComplete: () => void
  onDismiss: () => void
}

interface CheckItem {
  key: 'fire_exits_clear' | 'toilets_ok' | 'lighting_ok'
  label: string
  description: string
  icon: any
}

const CHECK_ITEMS: CheckItem[] = [
  { key: 'fire_exits_clear', label: 'Fire Exit Check', description: 'All fire exits are clear, unlocked and unobstructed', icon: Flame },
  { key: 'toilets_ok',       label: 'Toilet Check',    description: 'Facilities are clean, functional and accessible',       icon: Bath },
  { key: 'lighting_ok',      label: 'Lighting Check',  description: 'All interior and exterior lighting is operational',      icon: Lightbulb },
]

export default function HourlyChecksModal({ shiftId, checkNumber, onComplete, onDismiss }: Props) {
  const [headcount, setHeadcount] = useState('')
  const [checks, setChecks] = useState<Record<string, boolean>>({
    fire_exits_clear: false,
    toilets_ok: false,
    lighting_ok: false,
  })
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const toggle = (key: string) => setChecks(c => ({ ...c, [key]: !c[key] }))
  const allChecked = Object.values(checks).every(Boolean)

  const handleSubmit = async () => {
    if (!headcount) { setError('Please enter a headcount'); return }
    setSubmitting(true)
    setError('')
    try {
      await shiftsApi.submitCheck(shiftId, {
        headcount: parseInt(headcount, 10),
        fire_exits_clear: checks.fire_exits_clear,
        toilets_ok: checks.toilets_ok,
        lighting_ok: checks.lighting_ok,
        notes: notes || undefined,
      })
      onComplete()
    } catch {
      setError('Failed to submit check. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

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
        <div className="space-y-2 mb-4">
          {CHECK_ITEMS.map(({ key, label, description, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => toggle(key)}
              className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border transition-all text-left ${
                checks[key]
                  ? 'bg-green-900/30 border-green-700/50'
                  : 'bg-surface-elevated border-white/10 hover:border-white/20'
              }`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                checks[key] ? 'bg-green-600' : 'bg-white/5'
              }`}>
                {checks[key]
                  ? <CheckCircle size={18} className="text-white" />
                  : <Icon size={18} className="text-white/40" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-semibold text-sm ${checks[key] ? 'text-green-300' : 'text-white/80'}`}>{label}</p>
                <p className="text-white/30 text-xs truncate">{description}</p>
              </div>
              {!checks[key] && <AlertTriangle size={14} className="text-yellow-500/60 shrink-0" />}
            </button>
          ))}
        </div>

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

        {!allChecked && (
          <p className="text-yellow-500/70 text-xs mb-3 flex items-center gap-1.5">
            <AlertTriangle size={12} /> Tick each item after physically checking it
          </p>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting || !headcount}
          className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white font-bold rounded-2xl py-3.5 flex items-center justify-center gap-2 transition-colors"
        >
          {submitting ? 'Submitting…' : 'Submit Check'}
        </button>
      </div>
    </div>
  )
}
