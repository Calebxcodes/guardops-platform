import { useEffect, useState } from 'react'
import { Guard } from '../../types'
import { guardsApi } from '../../api'
import StatusBadge from '../../components/StatusBadge'
import Modal from '../../components/Modal'
import { Plus, Search, Edit, Trash2, AlertTriangle, Filter } from 'lucide-react'
import { differenceInDays, parseISO } from 'date-fns'
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
    if (editing) await guardsApi.update(editing.id, data)
    else await guardsApi.create(data)
    setShowForm(false)
    setEditing(null)
    load()
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Guards</h1>
          <p className="text-gray-500 text-sm mt-0.5">{guards.length} total officers</p>
        </div>
        <button
          className="btn-primary flex items-center gap-1.5 text-sm whitespace-nowrap"
          onClick={() => { setEditing(null); setShowForm(true) }}
        >
          <Plus size={15} />
          <span className="hidden sm:inline">Add Guard</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-9 w-full text-sm"
            placeholder="Search guards..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="relative">
          <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <select
            className="input pl-8 pr-3 text-sm w-36 sm:w-40"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="on-duty">On Duty</option>
            <option value="off-duty">Off Duty</option>
            <option value="on-leave">On Leave</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="card p-8 text-center text-gray-400 text-sm">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="card p-8 text-center text-gray-400 text-sm">No guards found</div>
      ) : (
        <>
          {/* ── Desktop table (md+) ─────────────────────────────── */}
          <div className="card overflow-hidden hidden md:block">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Guard</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Rate</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Skills</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Certs</th>
                  <th className="px-4 py-3 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(guard => (
                  <tr key={guard.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold text-xs shrink-0 overflow-hidden">
                          {guard.avatar_url
                            ? <img src={guard.avatar_url} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display='none' }} />
                            : <>{guard.first_name[0]}{guard.last_name[0]}</>}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium truncate">{guard.first_name} {guard.last_name}</div>
                          <div className="text-gray-400 text-xs truncate">{guard.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={guard.status} /></td>
                    <td className="px-4 py-3"><StatusBadge status={guard.employment_type} /></td>
                    <td className="px-4 py-3 font-medium">£{guard.hourly_rate}/hr</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {guard.skills?.slice(0, 2).map(s => (
                          <span key={s} className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded">{s}</span>
                        ))}
                        {(guard.skills?.length ?? 0) > 2 && (
                          <span className="text-xs text-gray-400">+{guard.skills.length - 2}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {hasCertExpiringSoon(guard) && <AlertTriangle size={13} className="text-yellow-500" />}
                        <span className="text-gray-500">{guard.certifications?.length || 0} certs</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                          onClick={() => { setEditing(guard); setShowForm(true) }}>
                          <Edit size={14} />
                        </button>
                        <button className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                          onClick={() => handleDelete(guard.id)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Mobile cards (< md) ─────────────────────────────── */}
          <div className="md:hidden space-y-3">
            {filtered.map(guard => (
              <div key={guard.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold text-sm shrink-0 overflow-hidden">
                      {guard.avatar_url
                        ? <img src={guard.avatar_url} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display='none' }} />
                        : <>{guard.first_name[0]}{guard.last_name[0]}</>}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{guard.first_name} {guard.last_name}</div>
                      <div className="text-gray-400 text-xs truncate">{guard.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                      onClick={() => { setEditing(guard); setShowForm(true) }}>
                      <Edit size={15} />
                    </button>
                    <button className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                      onClick={() => handleDelete(guard.id)}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 items-center">
                  <StatusBadge status={guard.status} />
                  <StatusBadge status={guard.employment_type} />
                  <span className="text-xs font-medium text-gray-600">£{guard.hourly_rate}/hr</span>
                  {hasCertExpiringSoon(guard) && (
                    <span className="flex items-center gap-1 text-xs text-yellow-600">
                      <AlertTriangle size={12} /> Cert expiring
                    </span>
                  )}
                </div>

                {guard.skills && guard.skills.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {guard.skills.slice(0, 3).map(s => (
                      <span key={s} className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded">{s}</span>
                    ))}
                    {guard.skills.length > 3 && (
                      <span className="text-xs text-gray-400 self-center">+{guard.skills.length - 3}</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

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
