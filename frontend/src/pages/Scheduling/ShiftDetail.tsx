import { useState, useMemo } from 'react'
import { Shift, Site, Guard } from '../../types'
import StatusBadge from '../../components/StatusBadge'
import { format } from 'date-fns'
import { AlertCircle, Trash2 } from 'lucide-react'

interface Props {
  shift: Shift
  sites: Site[]
  guards: Guard[]
  shifts: Shift[]
  onSave: (data: any) => void
  onDelete: () => void
  onCancel: () => void
  error?: string
}

const toLocal = (s: string) => format(new Date(s), "yyyy-MM-dd'T'HH:mm")

export default function ShiftDetail({ shift, sites, guards, shifts, onSave, onDelete, onCancel, error }: Props) {
  const [form, setForm] = useState({
    site_id: shift.site_id,
    guard_id: shift.guard_id || '',
    start_time: toLocal(shift.start_time),
    end_time: toLocal(shift.end_time),
    status: shift.status,
    hourly_rate: shift.hourly_rate,
    break_minutes: shift.break_minutes,
    notes: shift.notes || '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  // Guards with a conflicting shift — exclude the shift being edited
  const busyGuardIds = useMemo(() => {
    if (!form.start_time || !form.end_time) return new Set<number>()
    const selStart = new Date(form.start_time).getTime()
    const selEnd   = new Date(form.end_time).getTime()
    if (isNaN(selStart) || isNaN(selEnd) || selStart >= selEnd) return new Set<number>()
    return new Set(
      shifts
        .filter(s =>
          s.id !== shift.id &&
          s.guard_id != null &&
          !['cancelled', 'completed'].includes(s.status) &&
          new Date(s.start_time).getTime() < selEnd &&
          new Date(s.end_time).getTime()   > selStart
        )
        .map(s => s.guard_id!)
    )
  }, [shifts, shift.id, form.start_time, form.end_time])

  const durationHours = ((new Date(shift.end_time).getTime() - new Date(shift.start_time).getTime()) / 3600000).toFixed(1)

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm flex items-center gap-2">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <StatusBadge status={shift.status} />
        <span className="text-sm text-gray-500">{durationHours}h · £{shift.hourly_rate}/hr</span>
      </div>

      <form onSubmit={e => {
        e.preventDefault()
        onSave({
          ...form,
          guard_id: form.guard_id || null,
          start_time: form.start_time ? new Date(form.start_time).toISOString() : form.start_time,
          end_time:   form.end_time   ? new Date(form.end_time).toISOString()   : form.end_time,
        })
      }} className="space-y-4">
        <div>
          <label className="label">Site</label>
          <select className="input" value={form.site_id} onChange={e => set('site_id', parseInt(e.target.value))}>
            {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Guard</label>
          <select className="input" value={form.guard_id} onChange={e => set('guard_id', e.target.value)}>
            <option value="">Unassigned</option>
            {guards.filter(g => g.status !== 'inactive').map(g => {
              const busy = busyGuardIds.has(g.id)
              return (
                <option key={g.id} value={g.id} disabled={busy}>
                  {busy ? '⚠ ' : ''}{g.first_name} {g.last_name}{busy ? ' (already scheduled)' : ''}
                </option>
              )
            })}
          </select>
          {busyGuardIds.size > 0 && (
            <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
              <AlertCircle size={11} />
              {busyGuardIds.size} guard{busyGuardIds.size > 1 ? 's' : ''} already scheduled during this time
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Start</label>
            <input className="input" type="datetime-local" value={form.start_time} onChange={e => set('start_time', e.target.value)} />
          </div>
          <div>
            <label className="label">End</label>
            <input className="input" type="datetime-local" value={form.end_time} onChange={e => set('end_time', e.target.value)} />
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
              <option value="unassigned">Unassigned</option>
              <option value="assigned">Assigned</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="label">Hourly Rate (£)</label>
            <input className="input" type="number" step="0.5" value={form.hourly_rate} onChange={e => set('hourly_rate', parseFloat(e.target.value))} />
          </div>
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea className="input" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
        </div>
        <div className="flex items-center justify-between pt-2">
          <button type="button" onClick={onDelete} className="btn-danger flex items-center gap-1">
            <Trash2 size={14} /> Cancel Shift
          </button>
          <div className="flex gap-3">
            <button type="button" onClick={onCancel} className="btn-secondary">Close</button>
            <button type="submit" className="btn-primary">Save Changes</button>
          </div>
        </div>
      </form>
    </div>
  )
}
