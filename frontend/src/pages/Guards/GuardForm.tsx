import { useState, useRef } from 'react'
import { Guard } from '../../types'
import { Plus, X, CheckCircle, AlertTriangle, Clock } from 'lucide-react'
import { differenceInDays, parseISO, format } from 'date-fns'

interface Props {
  guard: Guard | null
  onSave: (data: any) => void
  onCancel: () => void
}

// Official SIA licence categories
const SIA_LICENCES = [
  'Door Supervisor',
  'Security Guard',
  'CCTV Operator (Public Space Surveillance)',
  'Close Protection Officer',
  'Cash and Valuables in Transit Guard',
  'Key Holder',
  'Vehicle Immobiliser',
  'Maritime Security Guard',
  'First Aid at Work Certificate',
  'Emergency First Response',
  'Level 2 Award for Door Supervisors',
  'Level 3 Award for Close Protection',
  'Counter Terrorism Awareness Certificate',
  'SIA Approved Contractor Scheme (ACS)',
  'National CCTV Viewer Certificate',
]

// SIA-relevant professional skills
const SIA_SKILLS = [
  'Door Supervision',
  'Conflict Management',
  'Physical Intervention',
  'CCTV Operation',
  'First Aid',
  'Counter Terrorism Awareness',
  'Emergency Procedures',
  'Search Procedures',
  'Report Writing',
  'Lone Working',
  'Drug Awareness',
  'Licensing Law',
  'Fire Safety',
  'Customer Service',
  'Crowd Management',
  'Close Protection',
  'Radio Communication',
  'Cash Handling',
  'Crime Scene Preservation',
  'Driving Licence (Full UK)',
]

function certStatus(expiry: string): { label: string; color: string; bg: string; icon: any } {
  if (!expiry) return { label: 'No expiry', color: 'text-gray-500', bg: 'bg-gray-50', icon: null }
  const days = differenceInDays(parseISO(expiry), new Date())
  if (days < 0)   return { label: `Expired ${Math.abs(days)}d ago`, color: 'text-red-600',    bg: 'bg-red-50',    icon: AlertTriangle }
  if (days <= 30) return { label: `${days}d left`,                   color: 'text-orange-600', bg: 'bg-orange-50', icon: AlertTriangle }
  if (days <= 90) return { label: `${days}d left`,                   color: 'text-yellow-600', bg: 'bg-yellow-50', icon: Clock }
  return           { label: `Valid · ${days}d left`,                  color: 'text-green-600',  bg: 'bg-green-50',  icon: CheckCircle }
}

export default function GuardForm({ guard, onSave, onCancel }: Props) {
  const [form, setForm] = useState({
    first_name:       guard?.first_name       || '',
    last_name:        guard?.last_name        || '',
    email:            guard?.email            || '',
    phone:            guard?.phone            || '',
    address:          guard?.address          || '',
    date_of_birth:    guard?.date_of_birth    || '',
    employment_type:  guard?.employment_type  || 'full-time',
    status:           guard?.status           || 'off-duty',
    hourly_rate:      guard?.hourly_rate      || 15,
    bank_account:     guard?.bank_account     || '',
    bank_routing:     guard?.bank_routing     || '',
    notes:            guard?.notes            || '',
    skills:           guard?.skills           || [] as string[],
    certifications:   guard?.certifications   || [] as { name: string; expiry: string; licence_number?: string }[],
    avatar_url:       guard?.avatar_url       || '',
  })

  const [newCert, setNewCert] = useState({ name: '', expiry: '', licence_number: '' })
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const set = (field: string, value: any) => setForm(f => ({ ...f, [field]: value }))

  const toggleSkill = (skill: string) => {
    set('skills', form.skills.includes(skill)
      ? form.skills.filter((s: string) => s !== skill)
      : [...form.skills, skill])
  }

  const addCert = () => {
    if (!newCert.name) return
    set('certifications', [...form.certifications, { ...newCert }])
    setNewCert({ name: '', expiry: '', licence_number: '' })
  }

  const removeCert = (i: number) => {
    set('certifications', form.certifications.filter((_: any, idx: number) => idx !== i))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(form)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Avatar + Name row */}
      <div className="flex items-start gap-4">
        {/* Optional profile photo */}
        <div className="shrink-0">
          <div
            className="w-16 h-16 rounded-full bg-blue-100 border-2 border-dashed border-blue-300 flex items-center justify-center cursor-pointer overflow-hidden hover:border-blue-500 transition-colors"
            onClick={() => avatarInputRef.current?.click()}
            title="Click to add profile photo URL"
          >
            {form.avatar_url ? (
              <img src={form.avatar_url} alt="Avatar" className="w-full h-full object-cover" onError={() => set('avatar_url', '')} />
            ) : (
              <span className="text-blue-400 text-xs text-center leading-tight px-1">Photo<br/>URL</span>
            )}
          </div>
        </div>
        <div className="flex-1 grid grid-cols-2 gap-4">
          <div>
            <label className="label">First Name *</label>
            <input className="input" required value={form.first_name} onChange={e => set('first_name', e.target.value)} />
          </div>
          <div>
            <label className="label">Last Name *</label>
            <input className="input" required value={form.last_name} onChange={e => set('last_name', e.target.value)} />
          </div>
        </div>
      </div>

      {/* Avatar URL field (shown separately for clarity) */}
      <div>
        <label className="label">Profile Photo URL <span className="text-gray-400 font-normal">(optional)</span></label>
        <input
          ref={avatarInputRef}
          className="input text-sm"
          placeholder="https://... (paste image URL)"
          value={form.avatar_url}
          onChange={e => set('avatar_url', e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
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
          <label className="label">Hourly Rate (£)</label>
          <input className="input" type="number" min="0" step="0.5" value={form.hourly_rate} onChange={e => set('hourly_rate', parseFloat(e.target.value))} />
        </div>
        <div>
          <label className="label">Employment Type</label>
          <select className="input" value={form.employment_type} onChange={e => set('employment_type', e.target.value)}>
            <option value="full-time">Full-Time</option>
            <option value="part-time">Part-Time</option>
            <option value="self-employed">Self-Employed</option>
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

      {/* SIA Skills */}
      <div>
        <label className="label">SIA Skills & Competencies</label>
        <div className="flex flex-wrap gap-2 mt-1">
          {SIA_SKILLS.map(skill => (
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

      {/* SIA Certifications */}
      <div>
        <label className="label">SIA Licences & Certifications</label>
        <div className="space-y-2 mb-3">
          {form.certifications.map((cert: { name: string; expiry: string; licence_number?: string }, i: number) => {
            const st = certStatus(cert.expiry)
            const Icon = st.icon
            return (
              <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${st.bg}`}>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{cert.name}</div>
                  <div className="text-xs text-gray-500">
                    {cert.licence_number && <span className="font-mono font-medium text-gray-700 mr-1.5">{cert.licence_number}</span>}
                    {cert.expiry ? `Expires: ${format(parseISO(cert.expiry), 'dd MMM yyyy')}` : 'No expiry set'}
                    {' · '}
                    {Icon && <Icon size={10} className={`inline mr-0.5 ${st.color}`} />}
                    <span className={`font-medium ${st.color}`}>{st.label}</span>
                  </div>
                </div>
                <button type="button" onClick={() => removeCert(i)} className="text-red-400 hover:text-red-600 shrink-0">
                  <X size={14} />
                </button>
              </div>
            )
          })}
          {form.certifications.length === 0 && (
            <p className="text-xs text-gray-400 italic">No licences added yet</p>
          )}
        </div>

        {/* Add cert row */}
        <div className="flex gap-2">
          <select
            className="input flex-1 text-sm"
            value={newCert.name}
            onChange={e => setNewCert(c => ({ ...c, name: e.target.value }))}
          >
            <option value="">Select SIA licence type…</option>
            {SIA_LICENCES.map(l => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
          <input
            className="input w-36 text-sm font-mono"
            type="text"
            inputMode="numeric"
            placeholder="Licence No."
            title="SIA licence number — digits only"
            value={newCert.licence_number}
            onChange={e => setNewCert(c => ({ ...c, licence_number: e.target.value.replace(/\D/g, '') }))}
          />
          <input
            className="input w-36 text-sm"
            type="date"
            title="Expiry date (optional)"
            value={newCert.expiry}
            onChange={e => setNewCert(c => ({ ...c, expiry: e.target.value }))}
          />
          <button
            type="button"
            onClick={addCert}
            disabled={!newCert.name}
            className="btn-secondary px-3 disabled:opacity-40"
            title="Add licence"
          >
            <Plus size={16} />
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1">Licence number and expiry date are optional but required for SIA compliance tracking.</p>
      </div>

      {/* Bank / Payroll */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Bank Account</label>
          <input className="input" value={form.bank_account} onChange={e => set('bank_account', e.target.value)} placeholder="Account number" />
        </div>
        <div>
          <label className="label">Sort Code</label>
          <input className="input" value={form.bank_routing} onChange={e => set('bank_routing', e.target.value)} placeholder="e.g. 12-34-56" />
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
