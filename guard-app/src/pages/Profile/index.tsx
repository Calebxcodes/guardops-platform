import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Shield, DollarSign, Lock, LogOut, ChevronRight, AlertTriangle, CreditCard, Settings } from 'lucide-react'
import { profileApi, authApi } from '../../api'
import { useAuthStore } from '../../store/authStore'
import Card from '../../components/ui/Card'
import StatusBadge from '../../components/ui/StatusBadge'
import { differenceInDays, parseISO, format } from 'date-fns'
import BottomSheet from '../../components/ui/BottomSheet'

export default function Profile() {
  const navigate = useNavigate()
  const { guard, clearAuth, updateGuard } = useAuthStore()
  const [payHistory, setPayHistory] = useState<any[]>([])
  const [showEditSheet, setShowEditSheet] = useState(false)
  const [showPassSheet, setShowPassSheet] = useState(false)
  const [editForm, setEditForm] = useState({ first_name: guard?.first_name || '', last_name: guard?.last_name || '', phone: guard?.phone || '', address: guard?.address || '' })
  const [passForm, setPassForm] = useState({ current: '', next: '', confirm: '' })
  const [passError, setPassError] = useState('')
  const [passDone, setPassDone] = useState(false)

  useEffect(() => { profileApi.payHistory().then(setPayHistory) }, [])

  const handleLogout = () => { clearAuth(); navigate('/login', { replace: true }) }

  const saveProfile = async () => {
    await profileApi.update(editForm)
    updateGuard(editForm)
    setShowEditSheet(false)
  }

  const changePassword = async () => {
    setPassError('')
    if (passForm.next !== passForm.confirm) { setPassError('Passwords do not match'); return }
    if (passForm.next.length < 6) { setPassError('Password must be at least 6 characters'); return }
    try {
      await authApi.changePassword(passForm.current, passForm.next)
      setPassDone(true)
      setTimeout(() => { setShowPassSheet(false); setPassDone(false); setPassForm({ current: '', next: '', confirm: '' }) }, 1500)
    } catch (e: any) {
      setPassError(e.response?.data?.error || 'Failed to change password')
    }
  }

  const expiringCerts = guard?.certifications?.filter(c => differenceInDays(parseISO(c.expiry), new Date()) <= 60) || []

  return (
    <div className="min-h-screen bg-surface px-4 pt-14 pb-4 space-y-5">
      {/* Avatar & name */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-brand-900 border-2 border-brand-700 flex items-center justify-center text-brand-400 font-bold text-xl shrink-0">
          {guard?.first_name?.[0]}{guard?.last_name?.[0]}
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">{guard?.first_name} {guard?.last_name}</h1>
          <p className="text-white/40 text-sm">{guard?.email}</p>
          <div className="mt-1"><StatusBadge status={guard?.status || 'off-duty'} /></div>
        </div>
        <button onClick={() => setShowEditSheet(true)} className="ml-auto p-2 text-white/30 hover:text-white">
          <Settings size={20} />
        </button>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3 text-center">
          <p className="text-lg font-bold text-white">${guard?.hourly_rate}</p>
          <p className="text-white/30 text-xs">/hr</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-lg font-bold text-white capitalize">{guard?.employment_type?.replace('-', ' ')}</p>
          <p className="text-white/30 text-xs">Contract</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-lg font-bold text-white">{guard?.certifications?.length || 0}</p>
          <p className="text-white/30 text-xs">Certs</p>
        </Card>
      </div>

      {/* Cert warnings */}
      {expiringCerts.length > 0 && (
        <Card className="p-4 border-yellow-500/20">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-yellow-400" />
            <p className="text-yellow-400 font-medium text-sm">Certifications Expiring Soon</p>
          </div>
          <div className="space-y-2">
            {expiringCerts.map((c, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-white/70">{c.name}</span>
                <span className="text-yellow-400">{format(parseISO(c.expiry), 'MMM d, yyyy')}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Certifications */}
      {(guard?.certifications?.length || 0) > 0 && (
        <Card className="p-4">
          <p className="text-white/40 text-xs uppercase tracking-wider mb-3">Certifications</p>
          <div className="space-y-2">
            {guard!.certifications.map((c, i) => {
              const daysLeft = differenceInDays(parseISO(c.expiry), new Date())
              return (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield size={14} className={daysLeft <= 30 ? 'text-red-400' : daysLeft <= 60 ? 'text-yellow-400' : 'text-green-400'} />
                    <span className="text-white/70 text-sm">{c.name}</span>
                  </div>
                  <span className={`text-xs ${daysLeft <= 30 ? 'text-red-400' : daysLeft <= 60 ? 'text-yellow-400' : 'text-white/30'}`}>
                    {format(parseISO(c.expiry), 'MMM yyyy')}
                  </span>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Pay history */}
      {payHistory.length > 0 && (
        <Card className="p-4">
          <p className="text-white/40 text-xs uppercase tracking-wider mb-3">Recent Pay</p>
          <div className="space-y-2">
            {payHistory.map(r => (
              <div key={r.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="text-white/70">{format(new Date(r.period_start), 'MMM d')} – {format(new Date(r.period_end), 'MMM d')}</p>
                  <p className="text-white/30 text-xs">{r.regular_hours + r.overtime_hours}h total</p>
                </div>
                <div className="text-right">
                  <p className="text-green-400 font-semibold">${r.net_pay.toFixed(2)}</p>
                  <StatusBadge status={r.status} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Menu items */}
      <Card>
        {[
          { icon: Lock, label: 'Change Password', action: () => setShowPassSheet(true) },
          { icon: Shield, label: 'Privacy & Data', action: () => {} },
        ].map(({ icon: Icon, label, action }, i, arr) => (
          <button
            key={label}
            onClick={action}
            className={`w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 transition-colors ${i < arr.length - 1 ? 'border-b border-white/5' : ''}`}
          >
            <Icon size={18} className="text-white/40" />
            <span className="text-white/70 text-sm flex-1 text-left">{label}</span>
            <ChevronRight size={16} className="text-white/20" />
          </button>
        ))}
      </Card>

      <button
        onClick={handleLogout}
        className="w-full py-4 border border-red-500/20 text-red-400 font-semibold rounded-2xl flex items-center justify-center gap-2 hover:bg-red-500/10 transition-colors"
      >
        <LogOut size={18} /> Sign Out
      </button>

      {/* Edit profile sheet */}
      {showEditSheet && (
        <BottomSheet title="Edit Profile" onClose={() => setShowEditSheet(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'First Name', key: 'first_name' },
                { label: 'Last Name', key: 'last_name' },
              ].map(({ label, key }) => (
                <div key={key}>
                  <label className="block text-white/40 text-xs mb-1.5">{label}</label>
                  <input
                    className="w-full bg-surface rounded-xl px-3 py-2.5 text-white text-sm border border-white/10 focus:outline-none focus:border-brand-500"
                    value={(editForm as any)[key]}
                    onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div>
              <label className="block text-white/40 text-xs mb-1.5">Phone</label>
              <input className="w-full bg-surface rounded-xl px-3 py-2.5 text-white text-sm border border-white/10 focus:outline-none focus:border-brand-500" value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <label className="block text-white/40 text-xs mb-1.5">Address</label>
              <input className="w-full bg-surface rounded-xl px-3 py-2.5 text-white text-sm border border-white/10 focus:outline-none focus:border-brand-500" value={editForm.address} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} />
            </div>
            <button onClick={saveProfile} className="w-full py-4 bg-brand-600 text-white font-semibold rounded-xl">Save Changes</button>
          </div>
        </BottomSheet>
      )}

      {/* Change password sheet */}
      {showPassSheet && (
        <BottomSheet title="Change Password" onClose={() => { setShowPassSheet(false); setPassDone(false); setPassError('') }}>
          {passDone ? (
            <div className="text-center py-8">
              <Lock size={40} className="text-green-400 mx-auto mb-3" />
              <p className="text-white font-semibold">Password Updated!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {passError && <p className="text-red-400 text-sm">{passError}</p>}
              {[
                { label: 'Current Password', key: 'current' },
                { label: 'New Password', key: 'next' },
                { label: 'Confirm New Password', key: 'confirm' },
              ].map(({ label, key }) => (
                <div key={key}>
                  <label className="block text-white/40 text-xs mb-1.5">{label}</label>
                  <input
                    type="password"
                    className="w-full bg-surface rounded-xl px-3 py-2.5 text-white text-sm border border-white/10 focus:outline-none focus:border-brand-500"
                    value={(passForm as any)[key]}
                    onChange={e => setPassForm(f => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}
              <button onClick={changePassword} className="w-full py-4 bg-brand-600 text-white font-semibold rounded-xl">Update Password</button>
            </div>
          )}
        </BottomSheet>
      )}
    </div>
  )
}
