import { useState, useEffect } from 'react'
import { adminUsersApi } from '../../api'
import { useAuthStore, type RoleType } from '../../store/authStore'
import { canPerform, ROLE_LABELS, ROLES } from '../../utils/permissions'
import { UserPlus, RotateCcw, Trash2, ChevronDown, Loader, CheckCircle, AlertCircle, MessageCircle, Plus, Pencil, X } from 'lucide-react'
import { chatbotService, type KBItem } from '../../services/chatbotService'

const ROLE_BADGE: Record<string, string> = {
  owner:           'bg-purple-100 text-purple-700',
  manager:         'bg-blue-100 text-blue-700',
  scheduler:       'bg-yellow-100 text-yellow-700',
  payroll_manager: 'bg-green-100 text-green-700',
  viewer:          'bg-gray-100 text-gray-600',
}

export default function SettingsUsers() {
  const { admin } = useAuthStore()
  const role = (admin?.role || 'owner') as RoleType
  const canInvite     = canPerform(role, 'users', 'invite')
  const canChangeRole = canPerform(role, 'users', 'changeRole')
  const canRemove     = canPerform(role, 'users', 'delete')

  const [users, setUsers]           = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')

  // Invite form
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName,  setInviteName]  = useState('')
  const [inviteRole,  setInviteRole]  = useState<RoleType>('viewer')
  const [inviting,    setInviting]    = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteDone,  setInviteDone]  = useState(false)

  // Per-user action states
  const [removingId,   setRemovingId]   = useState<number | null>(null)
  const [resendingId,  setResendingId]  = useState<number | null>(null)
  const [roleChanging, setRoleChanging] = useState<number | null>(null)

  // KB editor (owner only)
  const [kbItems,    setKbItems]    = useState<KBItem[]>([])
  const [kbLoading,  setKbLoading]  = useState(false)
  const [kbExpanded, setKbExpanded] = useState(false)
  const [kbEditing,  setKbEditing]  = useState<number | null>(null)
  const [kbEditVal,  setKbEditVal]  = useState({ title: '', content: '' })
  const [kbNewMode,  setKbNewMode]  = useState(false)
  const [kbNewVal,   setKbNewVal]   = useState({ title: '', content: '', category: '' })

  const loadKb = () => {
    setKbLoading(true)
    chatbotService.getKBItems()
      .then(items => setKbItems(items))
      .catch(() => {})
      .finally(() => setKbLoading(false))
  }

  useEffect(() => { if (role === 'owner' && kbExpanded) loadKb() }, [kbExpanded]) // eslint-disable-line react-hooks/exhaustive-deps

  const load = () => {
    setLoading(true)
    adminUsersApi.list()
      .then(r => setUsers(r.users))
      .catch(() => setError('Failed to load team members'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviteError('')
    setInviting(true)
    try {
      await adminUsersApi.invite({ email: inviteEmail, name: inviteName || undefined, role: inviteRole })
      setInviteDone(true)
      setInviteEmail('')
      setInviteName('')
      setInviteRole('viewer')
      load()
    } catch (err: any) {
      setInviteError(err.response?.data?.message || 'Failed to send invitation')
    } finally {
      setInviting(false)
    }
  }

  const handleRoleChange = async (userId: number, newRole: string) => {
    setRoleChanging(userId)
    try {
      await adminUsersApi.changeRole(userId, newRole)
      load()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to change role')
    } finally {
      setRoleChanging(null)
    }
  }

  const handleResend = async (userId: number) => {
    setResendingId(userId)
    try {
      await adminUsersApi.resendInvite(userId)
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to resend invitation')
    } finally {
      setResendingId(null)
    }
  }

  const handleRemove = async (userId: number, name: string) => {
    if (!confirm(`Remove ${name} from your team?`)) return
    setRemovingId(userId)
    try {
      await adminUsersApi.remove(userId)
      load()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to remove user')
    } finally {
      setRemovingId(null)
    }
  }

  const allowedInviteRoles = ROLES.filter(r => r !== 'owner') as RoleType[]

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Team Members</h1>
          <p className="text-gray-500 text-sm mt-1">Manage who has access to Strondis Ops</p>
        </div>
        {canInvite && (
          <button
            onClick={() => { setShowInvite(v => !v); setInviteDone(false); setInviteError('') }}
            className="btn-primary flex items-center gap-1.5 text-sm"
          >
            <UserPlus size={15} />
            Invite User
          </button>
        )}
      </div>

      {/* Invite form */}
      {showInvite && canInvite && (
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-sm">Invite a team member</h2>
          {inviteDone ? (
            <div className="flex items-center gap-2 text-green-600 text-sm">
              <CheckCircle size={16} />
              Invitation sent! They'll receive an email with a link to set their password.
            </div>
          ) : (
            <form onSubmit={handleInvite} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Email *</label>
                  <input
                    className="input"
                    type="email"
                    required
                    placeholder="colleague@example.com"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    disabled={inviting}
                  />
                </div>
                <div>
                  <label className="label">Name (optional)</label>
                  <input
                    className="input"
                    placeholder="Jane Smith"
                    value={inviteName}
                    onChange={e => setInviteName(e.target.value)}
                    disabled={inviting}
                  />
                </div>
              </div>
              <div>
                <label className="label">Role</label>
                <select
                  className="input"
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value as RoleType)}
                  disabled={inviting}
                >
                  {allowedInviteRoles.map(r => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </div>
              {inviteError && (
                <div className="flex items-center gap-2 text-red-600 text-sm">
                  <AlertCircle size={14} /> {inviteError}
                </div>
              )}
              <div className="flex gap-2">
                <button type="submit" disabled={inviting || !inviteEmail} className="btn-primary flex items-center gap-1.5 text-sm">
                  {inviting ? <Loader size={13} className="animate-spin" /> : <UserPlus size={13} />}
                  Send Invite
                </button>
                <button type="button" onClick={() => setShowInvite(false)} className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Users list */}
      {/* KB editor — owner only */}
      {role === 'owner' && (
        <div className="card p-5 space-y-4">
          <button
            onClick={() => setKbExpanded(v => !v)}
            className="w-full flex items-center justify-between"
          >
            <h2 className="font-semibold flex items-center gap-2">
              <MessageCircle size={16} className="text-blue-500" />
              Chatbot Knowledge Base
            </h2>
            <span className="text-xs text-gray-500">{kbExpanded ? 'Collapse' : 'Expand'}</span>
          </button>
          {kbExpanded && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">Add custom FAQ items specific to your company. These are added to the global knowledge base.</p>
              {kbLoading ? (
                <div className="text-sm text-gray-400 flex items-center gap-2"><Loader size={13} className="animate-spin" /> Loading…</div>
              ) : kbItems.length === 0 && !kbNewMode ? (
                <p className="text-sm text-gray-400">No custom KB items yet.</p>
              ) : (
                <div className="space-y-2">
                  {kbItems.map(item => (
                    <div key={item.id} className="border border-gray-200 rounded-lg p-3 space-y-2">
                      {kbEditing === item.id ? (
                        <>
                          <input
                            className="input text-sm w-full"
                            value={kbEditVal.title}
                            onChange={e => setKbEditVal(v => ({ ...v, title: e.target.value }))}
                            placeholder="Question / title"
                          />
                          <textarea
                            className="input text-sm w-full resize-none"
                            rows={2}
                            value={kbEditVal.content}
                            onChange={e => setKbEditVal(v => ({ ...v, content: e.target.value }))}
                            placeholder="Answer / content"
                          />
                          <div className="flex gap-2">
                            <button
                              className="btn-primary text-xs px-3 py-1.5"
                              onClick={async () => {
                                await chatbotService.updateKBItem(item.id, kbEditVal)
                                setKbEditing(null)
                                loadKb()
                              }}
                            >Save</button>
                            <button className="btn text-xs border border-gray-200 px-3 py-1.5" onClick={() => setKbEditing(null)}>Cancel</button>
                          </div>
                        </>
                      ) : (
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium">{item.title}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{item.content}</p>
                            <span className="text-xs text-blue-500">{item.category}</span>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button
                              onClick={() => { setKbEditing(item.id); setKbEditVal({ title: item.title, content: item.content }) }}
                              className="p-1.5 text-gray-400 hover:text-blue-600 rounded transition-colors"
                            ><Pencil size={13} /></button>
                            <button
                              onClick={async () => { await chatbotService.deleteKBItem(item.id); loadKb() }}
                              className="p-1.5 text-gray-400 hover:text-red-500 rounded transition-colors"
                            ><Trash2 size={13} /></button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {kbNewMode ? (
                <div className="border border-blue-200 rounded-lg p-3 space-y-2 bg-blue-50/30">
                  <input className="input text-sm w-full" value={kbNewVal.title} onChange={e => setKbNewVal(v => ({ ...v, title: e.target.value }))} placeholder="Question / title" />
                  <textarea className="input text-sm w-full resize-none" rows={2} value={kbNewVal.content} onChange={e => setKbNewVal(v => ({ ...v, content: e.target.value }))} placeholder="Answer / content" />
                  <input className="input text-sm w-full" value={kbNewVal.category} onChange={e => setKbNewVal(v => ({ ...v, category: e.target.value }))} placeholder="Category (e.g. Shifts, Payroll)" />
                  <div className="flex gap-2">
                    <button
                      className="btn-primary text-xs px-3 py-1.5"
                      disabled={!kbNewVal.title.trim() || !kbNewVal.content.trim()}
                      onClick={async () => {
                        await chatbotService.addKBItem({ title: kbNewVal.title, content: kbNewVal.content, category: kbNewVal.category || 'Custom' })
                        setKbNewMode(false)
                        setKbNewVal({ title: '', content: '', category: '' })
                        loadKb()
                      }}
                    >Add Item</button>
                    <button className="btn text-xs border border-gray-200 px-3 py-1.5" onClick={() => { setKbNewMode(false); setKbNewVal({ title: '', content: '', category: '' }) }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setKbNewMode(true)} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 transition-colors">
                  <Plus size={14} /> Add KB Item
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="card p-8 text-center text-gray-400 text-sm">Loading...</div>
      ) : error ? (
        <div className="card p-8 text-center text-red-500 text-sm">{error}</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Member</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 w-28"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map(u => {
                const isSelf = u.id === admin?.id
                const pending = !u.invitation_accepted && u.invitation_token
                return (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium">{u.name || '—'}</div>
                      <div className="text-xs text-gray-400">{u.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      {canChangeRole && !isSelf ? (
                        <div className="relative inline-flex items-center">
                          <select
                            value={u.role}
                            onChange={e => handleRoleChange(u.id, e.target.value)}
                            disabled={roleChanging === u.id}
                            className="appearance-none text-xs font-medium px-2 py-1 pr-6 rounded-full border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-50"
                          >
                            {ROLES.filter(r => r !== 'owner').map(r => (
                              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                            ))}
                            {u.role === 'owner' && <option value="owner">Owner</option>}
                          </select>
                          <ChevronDown size={11} className="absolute right-1.5 text-gray-400 pointer-events-none" />
                          {roleChanging === u.id && <Loader size={12} className="animate-spin ml-1.5 text-gray-400" />}
                        </div>
                      ) : (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_BADGE[u.role] || 'bg-gray-100 text-gray-600'}`}>
                          {ROLE_LABELS[u.role as RoleType] || u.role}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {pending ? (
                        <span className="text-xs text-amber-600 font-medium">Pending</span>
                      ) : (
                        <span className="text-xs text-green-600 font-medium">Active</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {pending && canInvite && (
                          <button
                            onClick={() => handleResend(u.id)}
                            disabled={resendingId === u.id}
                            title="Resend invite"
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          >
                            {resendingId === u.id ? <Loader size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                          </button>
                        )}
                        {canRemove && !isSelf && (
                          <button
                            onClick={() => handleRemove(u.id, u.name || u.email)}
                            disabled={removingId === u.id}
                            title="Remove user"
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            {removingId === u.id ? <Loader size={14} className="animate-spin" /> : <Trash2 size={14} />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
