import { useEffect, useState } from 'react'
import { Incident } from '../../types'
import { incidentsApi, sitesApi, guardsApi } from '../../api'
import StatusBadge from '../../components/StatusBadge'
import Modal from '../../components/Modal'
import { Plus, CheckCircle } from 'lucide-react'
import { format } from 'date-fns'

export default function Incidents() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [sites, setSites] = useState<any[]>([])
  const [guards, setGuards] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ site_id: '', guard_id: '', type: '', severity: 'minor', description: '' })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const load = () => incidentsApi.list().then(setIncidents)
  useEffect(() => {
    load()
    sitesApi.list().then(setSites)
    guardsApi.list().then(setGuards)
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    await incidentsApi.create(form)
    setShowForm(false)
    setForm({ site_id: '', guard_id: '', type: '', severity: 'minor', description: '' })
    load()
  }

  const resolve = async (id: number) => {
    if (!confirm('Mark as resolved?')) return
    await incidentsApi.resolve(id)
    load()
  }

  const openCount = incidents.filter(i => !i.resolved).length

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Incidents</h1>
          <p className="text-gray-500 text-sm mt-1">{openCount} open incidents</p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={() => setShowForm(true)}>
          <Plus size={16} /> Report Incident
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Site</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Guard</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Severity</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Description</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {incidents.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No incidents recorded</td></tr>
            )}
            {incidents.map(inc => (
              <tr key={inc.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{inc.type}</td>
                <td className="px-4 py-3">{inc.site_name}</td>
                <td className="px-4 py-3">{inc.first_name} {inc.last_name}</td>
                <td className="px-4 py-3"><StatusBadge status={inc.severity} /></td>
                <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">{inc.description}</td>
                <td className="px-4 py-3 text-gray-400 text-xs">{format(new Date(inc.created_at), 'MMM d, HH:mm')}</td>
                <td className="px-4 py-3">
                  {inc.resolved ? (
                    <span className="text-green-600 text-xs flex items-center gap-1"><CheckCircle size={13} /> Resolved</span>
                  ) : (
                    <span className="text-red-500 text-xs">Open</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {!inc.resolved && (
                    <button className="text-xs text-blue-600 hover:underline" onClick={() => resolve(inc.id)}>Resolve</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal title="Report Incident" onClose={() => setShowForm(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="label">Site *</label>
              <select className="input" required value={form.site_id} onChange={e => set('site_id', e.target.value)}>
                <option value="">Select site</option>
                {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Guard Involved</label>
              <select className="input" value={form.guard_id} onChange={e => set('guard_id', e.target.value)}>
                <option value="">None</option>
                {guards.map(g => <option key={g.id} value={g.id}>{g.first_name} {g.last_name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Incident Type *</label>
                <input className="input" required value={form.type} onChange={e => set('type', e.target.value)} placeholder="e.g. Theft, Disturbance" />
              </div>
              <div>
                <label className="label">Severity</label>
                <select className="input" value={form.severity} onChange={e => set('severity', e.target.value)}>
                  <option value="minor">Minor</option>
                  <option value="major">Major</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label">Description</label>
              <textarea className="input" rows={4} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Describe what happened..." />
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary">Submit Report</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
