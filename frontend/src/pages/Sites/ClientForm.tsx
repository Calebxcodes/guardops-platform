import { useState } from 'react'
import { Client } from '../../types'

interface Props { client: Client | null; onSave: (d: any) => void; onCancel: () => void }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function ClientForm({ client, onSave, onCancel }: Props) {
  const [form, setForm] = useState({
    name: client?.name || '',
    contact_name: client?.contact_name || '',
    contact_email: client?.contact_email || '',
    contact_phone: client?.contact_phone || '',
    address: client?.address || '',
    notes: client?.notes || '',
    hourly_rate: (client as any)?.hourly_rate ?? 0,
    guard_hourly_rate: (client as any)?.guard_hourly_rate ?? 0,
  })
  const [emailError, setEmailError] = useState('')
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const clientRate = parseFloat(String(form.hourly_rate)) || 0
  const guardRate  = parseFloat(String(form.guard_hourly_rate)) || 0
  const margin     = clientRate > 0 ? Math.round(((clientRate - guardRate) / clientRate) * 100) : 0

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.contact_email.trim()) {
      setEmailError('Email is required')
      return
    }
    if (!EMAIL_RE.test(form.contact_email)) {
      setEmailError('Please enter a valid email address')
      return
    }
    setEmailError('')
    onSave(form)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Company Name *</label>
        <input className="input" required value={form.name} onChange={e => set('name', e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Contact Person</label>
          <input className="input" value={form.contact_name} onChange={e => set('contact_name', e.target.value)} />
        </div>
        <div>
          <label className="label">Contact Email *</label>
          <input
            className={`input ${emailError ? 'border-red-400' : ''}`}
            type="email"
            required
            value={form.contact_email}
            onChange={e => { set('contact_email', e.target.value); if (emailError) setEmailError('') }}
            onBlur={() => {
              if (form.contact_email && !EMAIL_RE.test(form.contact_email))
                setEmailError('Please enter a valid email address')
            }}
            placeholder="contact@company.com"
          />
          {emailError && <p className="text-xs text-red-500 mt-1">{emailError}</p>}
        </div>
        <div>
          <label className="label">Contact Phone</label>
          <input className="input" value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} />
        </div>
      </div>
      <div>
        <label className="label">Address</label>
        <input className="input" value={form.address} onChange={e => set('address', e.target.value)} />
      </div>

      {/* Billing rates */}
      <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-700">Default Billing Rates</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Client Hourly Bill (£)</label>
            <input
              className="input"
              type="number"
              min="0"
              step="0.01"
              value={form.hourly_rate}
              onChange={e => set('hourly_rate', e.target.value)}
              placeholder="0.00"
            />
            <p className="text-xs text-gray-400 mt-1">Rate billed to client per hour</p>
          </div>
          <div>
            <label className="label">Guard Hourly Pay (£)</label>
            <input
              className="input"
              type="number"
              min="0"
              step="0.01"
              value={form.guard_hourly_rate}
              onChange={e => set('guard_hourly_rate', e.target.value)}
              placeholder="0.00"
            />
            <p className="text-xs text-gray-400 mt-1">Rate paid to guards per hour</p>
          </div>
        </div>
        {clientRate > 0 && (
          <div className={`text-sm font-medium rounded-lg px-3 py-2 ${
            margin >= 20 ? 'bg-green-50 text-green-700' :
            margin >= 10 ? 'bg-yellow-50 text-yellow-700' :
            'bg-red-50 text-red-700'
          }`}>
            Profit margin: <span className="font-bold">{margin}%</span>
            {' '}(£{(clientRate - guardRate).toFixed(2)}/hr)
            {margin < 10 && ' — Low margin warning'}
          </div>
        )}
      </div>

      <div>
        <label className="label">Notes</label>
        <textarea className="input" rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} />
      </div>
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
        <button type="submit" className="btn-primary">{client ? 'Save Changes' : 'Add Client'}</button>
      </div>
    </form>
  )
}
