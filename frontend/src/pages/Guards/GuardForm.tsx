import { useState } from 'react'
import { Guard } from '../../types'
import { Plus, X } from 'lucide-react'

interface Props {
  guard: Guard | null
  onSave: (data: any) => void
  onCancel: () => void
}

const SKILLS = ['Unarmed', 'Armed', 'Crowd Control', 'CCTV', 'Casino Security', 'De-escalation', 'First Aid', 'Patient Care', 'Event Security', 'Driving License', 'Surveillance', 'Customer Service']

export default function GuardForm({ guard, onSave, onCancel }: Props) {
  const [form, setForm] = useState({
    first_name: guard?.first_name || '',
    last_name: guard?.last_name || '',
    email: guard?.email || '',
    phone: guard?.phone || '',
    address: guard?.address || '',
    date_of_birth: guard?.date_of_birth || '',
    employment_type: guard?.employment_type || 'full-time',
    status: guard?.status || 'off-duty',
    hourly_rate: guard?.hourly_rate || 15,
    bank_account: guard?.bank_account || '',
    bank_routing: guard?.bank_routing || '',
    notes: guard?.notes || '',
    skills: guard?.skills || [],
    certifications: guard?.certifications || [],
  })

  const [newCert, setNewCert] = useState({ name: '', expiry: '' })

  const set = (field: string, value: any) => setForm(f => ({ ...f, [field]: value }))

  const toggleSkill = (skill: string) => {
    set('skills', form.skills.includes(skill)
      ? form.skills.filter(s => s !== skill)
      : [...form.skills, skill])
  }

  const addCert = () => {
    if (!newCert.name || !newCert.expiry) return
    set('certifications', [...form.certifications, { ...newCert }])
    setNewCert({ name: '', expiry: '' })
  }

  const removeCert = (i: number) => {
    set('certifications', form.certifications.filter((_, idx) => idx !== i))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(form)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">First Name *</label>
          <input className="input" required value={form.first_name} onChange={e => set('first_name', e.target.value)} />
        </div>
        <div>
          <label className="label">Last Name *</label>
          <input className="input" required value={form.last_name} onChange={e => set('last_name', e.target.value)} />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
        </div>
        <div>
          <label className="label">Phone</label>
          <input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="label">Address</label>
          <input className="input" value={form.address} onChange={e => set('address', e.target.value)} />
        </div>
        <div>
          <label className="label">Date of Birth</label>
          <input className="input" type="date" value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)} />
        </div>
        <div>
          <label className="label">Hourly Rate ($)</label>
          <input className="input" type="number" min="0" step="0.5" value={form.hourly_rate} onChange={e => set('hourly_rate', parseFloat(e.target.value))} />
        </div>
        <div>
          <label className="label">Employment Type</label>
          <select className="input" value={form.employment_type} onChange={e => set('employment_type', e.target.value)}>
            <option value="full-time">Full-Time</option>
            <option value="part-time">Part-Time</option>
            <option value="on-call">On-Call</option>
            <option value="contractor">Contractor</option>
          </select>
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
            <option value="off-duty">Off Duty</option>
            <option value="on-duty">On Duty</option>
            <option value="on-leave">On Leave</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Skills */}
      <div>
        <label className="label">Skills</label>
        <div className="flex flex-wrap gap-2 mt-1">
          {SKILLS.map(skill => (
            <button
              key={skill} type="button"
              onClick={() => toggleSkill(skill)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                form.skills.includes(skill)
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
              }`}
            >
              {skill}
            </button>
          ))}
        </div>
      </div>

      {/* Certifications */}
      <div>
        <label className="label">Certifications</label>
        <div className="space-y-2 mb-3">
          {form.certifications.map((cert, i) => (
            <div key={i} className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg">
              <span className="flex-1 text-sm font-medium">{cert.name}</span>
              <span className="text-xs text-gray-500">Expires: {cert.expiry}</span>
              <button type="button" onClick={() => removeCert(i)} className="text-red-400 hover:text-red-600">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            className="input flex-1" placeholder="Certificate name"
            value={newCert.name} onChange={e => setNewCert(c => ({ ...c, name: e.target.value }))}
          />
          <input
            className="input w-40" type="date"
            value={newCert.expiry} onChange={e => setNewCert(c => ({ ...c, expiry: e.target.value }))}
          />
          <button type="button" onClick={addCert} className="btn-secondary px-3">
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Bank / Payroll */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Bank Account</label>
          <input className="input" value={form.bank_account} onChange={e => set('bank_account', e.target.value)} placeholder="Account number" />
        </div>
        <div>
          <label className="label">Routing Number</label>
          <input className="input" value={form.bank_routing} onChange={e => set('bank_routing', e.target.value)} placeholder="Routing number" />
        </div>
      </div>

      <div>
        <label className="label">Notes</label>
        <textarea className="input" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
        <button type="submit" className="btn-primary">{guard ? 'Save Changes' : 'Add Guard'}</button>
      </div>
    </form>
  )
}
