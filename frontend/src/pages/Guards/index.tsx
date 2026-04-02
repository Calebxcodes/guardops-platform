import { useEffect, useState } from 'react'
import { Guard } from '../../types'
import { guardsApi } from '../../api'
import StatusBadge from '../../components/StatusBadge'
import Modal from '../../components/Modal'
import { Plus, Search, Edit, Trash2, AlertTriangle } from 'lucide-react'
import { format, parseISO, differenceInDays } from 'date-fns'
import GuardForm from './GuardForm'

export default function Guards() {
  const [guards, setGuards] = useState<Guard[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Guard | null>(null)
  const [loading, setLoading] = useState(true)

  const load = () => guardsApi.list().then(setGuards).finally(() => setLoading(false))

  useEffect(() => { load() }, [])

  const filtered = guards.filter(g => {
    const name = `${g.first_name} ${g.last_name}`.toLowerCase()
    const matchSearch = !search || name.includes(search.toLowerCase()) || g.email?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = !statusFilter || g.status === statusFilter
    return matchSearch && matchStatus
  })

  const hasCertExpiringSoon = (g: Guard) =>
    g.certifications?.some(c => differenceInDays(parseISO(c.expiry), new Date()) <= 30)

  const handleDelete = async (id: number) => {
    if (!confirm('Deactivate this guard?')) return
    await guardsApi.delete(id)
    load()
  }

  const handleSave = async (data: any) => {
    if (editing) {
      await guardsApi.update(editing.id, data)
    } else {
      await guardsApi.create(data)
    }
    setShowForm(false)
    setEditing(null)
    load()
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Guards</h1>
          <p className="text-gray-500 text-sm mt-1">{guards.length} total guards</p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={() => { setEditing(null); setShowForm(true) }}>
          <Plus size={16} /> Add Guard
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="Search guards..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input w-40" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="on-duty">On Duty</option>
          <option value="off-duty">Off Duty</option>
          <option value="on-leave">On Leave</option>
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Guard</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Rate</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Skills</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Certifications</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(guard => (
                <tr key={guard.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-medium text-xs shrink-0">
                        {guard.first_name[0]}{guard.last_name[0]}
                      </div>
                      <div>
                        <div className="font-medium">{guard.first_name} {guard.last_name}</div>
                        <div className="text-gray-400 text-xs">{guard.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={guard.status} /></td>
                  <td className="px-4 py-3"><StatusBadge status={guard.employment_type} /></td>
                  <td className="px-4 py-3 font-medium">${guard.hourly_rate}/hr</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {guard.skills?.slice(0, 2).map(s => (
                        <span key={s} className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded">{s}</span>
                      ))}
                      {guard.skills?.length > 2 && (
                        <span className="text-xs text-gray-400">+{guard.skills.length - 2}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {hasCertExpiringSoon(guard) && (
                        <AlertTriangle size={14} className="text-yellow-500" title="Certification expiring soon" />
                      )}
                      <span className="text-gray-500">{guard.certifications?.length || 0} certs</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                        onClick={() => { setEditing(guard); setShowForm(true) }}
                      >
                        <Edit size={15} />
                      </button>
                      <button
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                        onClick={() => handleDelete(guard.id)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No guards found</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <Modal
          title={editing ? `Edit ${editing.first_name} ${editing.last_name}` : 'Add New Guard'}
          onClose={() => { setShowForm(false); setEditing(null) }}
          size="lg"
        >
          <GuardForm guard={editing} onSave={handleSave} onCancel={() => { setShowForm(false); setEditing(null) }} />
        </Modal>
      )}
    </div>
  )
}
