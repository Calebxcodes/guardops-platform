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
  })
  const [emailError, setEmailError] = useState('')
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

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
