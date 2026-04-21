import { useEffect, useState, FormEvent } from 'react'
import {
  getUsers, createUser, updateUserRole, deleteUser,
  type MasterAdmin,
} from '../../api/masterAdminApi'
import { useAuthStore } from '../../store/authStore'
import { Trash2, Plus } from 'lucide-react'

const ROLES = ['viewer', 'editor', 'super_admin']

export default function Users() {
  const [users, setUsers] = useState<MasterAdmin[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'viewer' })
  const [saving, setSaving] = useState(false)
  const { role: myRole } = useAuthStore()
  const myAdminId = useAuthStore(s => s.token ? JSON.parse(atob(s.token.split('.')[1])).adminId : 0)

  async function load() {
    setLoading(true)
    const data = await getUsers()
    setUsers(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try { await createUser(form); setShowCreate(false); setForm({ name: '', email: '', password: '', role: 'viewer' }); await load() }
    catch (err: any) { alert(err.response?.data?.error ?? 'Failed') }
    finally { setSaving(false) }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this admin user?')) return
    try { await deleteUser(id); await load() }
    catch (err: any) { alert(err.response?.data?.error ?? 'Failed') }
  }

  async function handleRoleChange(id: number, role: string) {
    try { await updateUserRole(id, role); await load() }
    catch (err: any) { alert(err.response?.data?.error ?? 'Failed') }
  }

  const canEdit = myRole === 'super_admin'

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Admins</h1>
          <p className="text-gray-500 text-sm">Master admin accounts</p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            New Admin
          </button>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <form onSubmit={handleCreate} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-lg font-bold text-white">Create Admin</h2>
            {['name', 'email', 'password'].map(field => (
              <div key={field}>
                <label className="block text-sm text-gray-400 mb-1 capitalize">{field}</label>
                <input
                  type={field === 'password' ? 'password' : field === 'email' ? 'email' : 'text'}
                  value={form[field as keyof typeof form]}
                  onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                  required
                  minLength={field === 'password' ? 12 : 1}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-sm"
                />
              </div>
            ))}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Role</label>
              <select
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-sm"
              >
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setShowCreate(false)} className="flex-1 py-2 rounded-lg border border-gray-700 text-gray-400 hover:text-white text-sm">Cancel</button>
              <button type="submit" disabled={saving} className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50">
                {saving ? 'Creating…' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-gray-500">Loading…</div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800 text-xs uppercase tracking-wide">
                <th className="text-left px-5 py-3">Name</th>
                <th className="text-left px-5 py-3">Email</th>
                <th className="text-left px-5 py-3">Role</th>
                {canEdit && <th className="text-right px-5 py-3">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                  <td className="px-5 py-3 font-medium text-white">{u.name}</td>
                  <td className="px-5 py-3 text-gray-400">{u.email}</td>
                  <td className="px-5 py-3">
                    {canEdit && u.id !== myAdminId ? (
                      <select
                        value={u.role}
                        onChange={e => handleRoleChange(u.id, e.target.value)}
                        className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none"
                      >
                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    ) : (
                      <span className="text-xs bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded">{u.role}</span>
                    )}
                  </td>
                  {canEdit && (
                    <td className="px-5 py-3 text-right">
                      {u.id !== myAdminId && (
                        <button
                          onClick={() => handleDelete(u.id)}
                          className="p-1.5 rounded hover:bg-red-900/40 text-red-400"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
