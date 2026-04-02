import { useEffect, useState } from 'react'
import { Guard } from '../../types'
import { guardsApi } from '../../api'

interface Props { onSave: (d: any) => void; onCancel: () => void }

export default function TimesheetForm({ onSave, onCancel }: Props) {
  const [guards, setGuards] = useState<Guard[]>([])
  const [form, setForm] = useState({
    guard_id: '',
    period_start: '',
    period_end: '',
    regular_hours: 40,
    overtime_hours: 0,
    source: 'manual',
    guard_notes: '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => { guardsApi.list().then(setGuards) }, [])

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form) }} className="space-y-4">
      <div>
        <label className="label">Guard *</label>
        <select className="input" required value={form.guard_id} onChange={e => set('guard_id', e.target.value)}>
          <option value="">Select guard</option>
          {guards.map(g => <option key={g.id} value={g.id}>{g.first_name} {g.last_name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Period Start *</label>
          <input className="input" type="date" required value={form.period_start} onChange={e => set('period_start', e.target.value)} />
        </div>
        <div>
          <label className="label">Period End *</label>
          <input className="input" type="date" required value={form.period_end} onChange={e => set('period_end', e.target.value)} />
        </div>
        <div>
          <label className="label">Regular Hours</label>
          <input className="input" type="number" min="0" step="0.5" value={form.regular_hours} onChange={e => set('regular_hours', parseFloat(e.target.value))} />
        </div>
        <div>
          <label className="label">Overtime Hours</label>
          <input className="input" type="number" min="0" step="0.5" value={form.overtime_hours} onChange={e => set('overtime_hours', parseFloat(e.target.value))} />
        </div>
      </div>
      <div>
        <label className="label">Notes</label>
        <textarea className="input" rows={2} value={form.guard_notes} onChange={e => set('guard_notes', e.target.value)} />
      </div>
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
        <button type="submit" className="btn-primary">Submit Timesheet</button>
      </div>
    </form>
  )
}
