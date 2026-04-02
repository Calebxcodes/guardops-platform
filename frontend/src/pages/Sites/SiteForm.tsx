import { useState } from 'react'
import { Site, Client } from '../../types'

interface Props { site: Site | null; clients: Client[]; onSave: (d: any) => void; onCancel: () => void }

export default function SiteForm({ site, clients, onSave, onCancel }: Props) {
  const [form, setForm] = useState({
    client_id: site?.client_id || '',
    name: site?.name || '',
    address: site?.address || '',
    lat: site?.lat || '',
    lng: site?.lng || '',
    requirements: site?.requirements || '',
    post_orders: site?.post_orders || '',
    guards_required: site?.guards_required || 1,
    hourly_rate: site?.hourly_rate || 0,
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form) }} className="space-y-4">
      <div>
        <label className="label">Client *</label>
        <select className="input" required value={form.client_id} onChange={e => set('client_id', e.target.value)}>
          <option value="">Select client</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Site Name *</label>
        <input className="input" required value={form.name} onChange={e => set('name', e.target.value)} />
      </div>
      <div>
        <label className="label">Address</label>
        <input className="input" value={form.address} onChange={e => set('address', e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Latitude</label>
          <input className="input" type="number" step="any" value={form.lat} onChange={e => set('lat', e.target.value)} placeholder="e.g. 41.8781" />
        </div>
        <div>
          <label className="label">Longitude</label>
          <input className="input" type="number" step="any" value={form.lng} onChange={e => set('lng', e.target.value)} placeholder="e.g. -87.6298" />
        </div>
        <div>
          <label className="label">Guards Required</label>
          <input className="input" type="number" min="1" value={form.guards_required} onChange={e => set('guards_required', parseInt(e.target.value))} />
        </div>
        <div>
          <label className="label">Hourly Rate (£)</label>
          <input className="input" type="number" min="0" step="0.5" value={form.hourly_rate} onChange={e => set('hourly_rate', parseFloat(e.target.value))} />
        </div>
      </div>
      <div>
        <label className="label">Security Requirements</label>
        <textarea className="input" rows={2} value={form.requirements} onChange={e => set('requirements', e.target.value)} placeholder="e.g. Armed guard, FOID required" />
      </div>
      <div>
        <label className="label">Post Orders</label>
        <textarea className="input" rows={3} value={form.post_orders} onChange={e => set('post_orders', e.target.value)} placeholder="Detailed instructions for guards at this site" />
      </div>
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
        <button type="submit" className="btn-primary">{site ? 'Save Changes' : 'Add Site'}</button>
      </div>
    </form>
  )
}
