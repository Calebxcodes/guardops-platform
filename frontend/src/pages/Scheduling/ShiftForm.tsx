import { useState, useMemo } from 'react'
import { Site, Guard, Shift } from '../../types'
import { format } from 'date-fns'
import { AlertCircle } from 'lucide-react'

interface Props {
  initialStart?: Date
  initialEnd?: Date
  sites: Site[]
  guards: Guard[]
  shifts: Shift[]
  onSave: (data: any) => void
  onCancel: () => void
  error?: string
}

const toLocal = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm")

export default function ShiftForm({ initialStart, initialEnd, sites, guards, shifts, onSave, onCancel, error }: Props) {
  const [form, setForm] = useState({
    site_id: '',
    guard_id: '',
    start_time: initialStart ? toLocal(initialStart) : '',
    end_time: initialEnd ? toLocal(initialEnd) : '',
    hourly_rate: '',
    break_minutes: 30,
    notes: '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const onSiteChange = (siteId: string) => {
    const site = sites.find(s => s.id === parseInt(siteId))
    set('site_id', siteId)
    if (site) set('hourly_rate', site.hourly_rate)
  }

  // Guards with an overlapping non-cancelled shift for the selected time window
  const busyGuardIds = useMemo(() => {
    if (!form.start_time || !form.end_time) return new Set<number>()
    const selStart = new Date(form.start_time).getTime()
    const selEnd   = new Date(form.end_time).getTime()
    if (isNaN(selStart) || isNaN(selEnd) || selStart >= selEnd) return new Set<number>()
    return new Set(
      shifts
        .filter(s =>
          s.guard_id != null &&
          !['cancelled', 'completed'].includes(s.status) &&
          new Date(s.start_time).getTime() < selEnd &&
          new Date(s.end_time).getTime()   > selStart
        )
        .map(s => s.guard_id!)
    )
  }, [shifts, form.start_time, form.end_time])

  return (
    <form onSubmit={e => {
      e.preventDefault()
      onSave({
        ...form,
        guard_id: form.guard_id || null,
        // Convert browser-local datetime-local value to UTC ISO string so the
        // backend stores the correct instant regardless of server timezone
        start_time: form.start_time ? new Date(form.start_time).toISOString() : form.start_time,
        end_time:   form.end_time   ? new Date(form.end_time).toISOString()   : form.end_time,
      })
    }} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm flex items-center gap-2">
          <AlertCircle size={14} /> {error}
        </div>
      )}
      <div>
        <label className="label">Site *</label>
        <select className="input" required value={form.site_id} onChange={e => onSiteChange(e.target.value)}>
          <option value="">Select site</option>
          {sites.map(s => <option key={s.id} value={s.id}>{s.name} ({s.client_name})</option>)}
        </select>
      </div>
      <div>
        <label className="label">Assign Guard (optional)</label>
        <select className="input" value={form.guard_id} onChange={e => set('guard_id', e.target.value)}>
          <option value="">Leave unassigned</option>
          {guards.filter(g => g.status !== 'inactive').map(g => {
            const busy = busyGuardIds.has(g.id)
            return (
              <option key={g.id} value={g.id} disabled={busy}>
                {busy ? '⚠ ' : ''}{g.first_name} {g.last_name} — £{g.hourly_rate}/hr{busy ? ' (already scheduled)' : ''}
              </option>
            )
          })}
        </select>
        {busyGuardIds.size > 0 && form.start_time && form.end_time && (
          <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
            <AlertCircle size={11} />
            {busyGuardIds.size} guard{busyGuardIds.size > 1 ? 's' : ''} already scheduled during this time
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Start Time *</label>
          <input className="input" type="datetime-local" required value={form.start_time} onChange={e => set('start_time', e.target.value)} />
        </div>
        <div>
          <label className="label">End Time *</label>
          <input className="input" type="datetime-local" required value={form.end_time} onChange={e => set('end_time', e.target.value)} />
        </div>
        <div>
          <label className="label">Hourly Rate (£)</label>
          <input className="input" type="number" step="0.5" value={form.hourly_rate} onChange={e => set('hourly_rate', e.target.value)} placeholder="Auto from site" />
        </div>
        <div>
          <label className="label">Break (minutes)</label>
          <input className="input" type="number" min="0" value={form.break_minutes} onChange={e => set('break_minutes', parseInt(e.target.value))} />
        </div>
      </div>
      <div>
        <label className="label">Notes</label>
        <textarea className="input" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
      </div>
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
        <button type="submit" className="btn-primary">Create Shift</button>
      </div>
    </form>
  )
}
