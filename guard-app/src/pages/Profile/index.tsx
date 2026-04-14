import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Lock, LogOut, ChevronRight, AlertTriangle, Settings, ScanFace, CheckCircle2, Trash2 } from 'lucide-react'
import { profileApi, authApi } from '../../api'
import { useAuthStore } from '../../store/authStore'
import Card from '../../components/ui/Card'
import StatusBadge from '../../components/ui/StatusBadge'
import { differenceInDays, parseISO, format } from 'date-fns'
import BottomSheet from '../../components/ui/BottomSheet'
import FaceCapture from '../../components/FaceCapture'
import InstallPromptButton from '../../components/InstallPromptButton'
import PrivacyDialog from '../../components/PrivacyDialog'

export default function Profile() {
  const navigate = useNavigate()
  const { guard, clearAuth, updateGuard } = useAuthStore()
  const [payHistory, setPayHistory] = useState<any[]>([])
  const [showEditSheet, setShowEditSheet] = useState(false)
  const [showPassSheet, setShowPassSheet] = useState(false)
  const [showFaceSheet, setShowFaceSheet] = useState(false)
  const [faceEnrolling, setFaceEnrolling] = useState(false)
  const [editForm, setEditForm] = useState({ first_name: guard?.first_name || '', last_name: guard?.last_name || '', phone: guard?.phone || '', address: guard?.address || '' })
  const [passForm, setPassForm] = useState({ current: '', next: '', confirm: '' })
  const [passError, setPassError] = useState('')
  const [passDone, setPassDone] = useState(false)
  const [showCertSheet, setShowCertSheet] = useState(false)
  const [certEdits, setCertEdits] = useState<{ name: string; expiry: string; licence_number: string }[]>([])
  const [certSaving, setCertSaving] = useState(false)
  const [showPrivacy, setShowPrivacy] = useState(false)

  useEffect(() => {
    profileApi.payHistory().then(setPayHistory)
    // Refresh guard data from DB so cert changes made by admin are reflected
    profileApi.get().then(fresh => {
      if (fresh?.certifications) updateGuard({ certifications: fresh.certifications })
    }).catch(() => {})
  }, [])

  const handleLogout = () => { clearAuth(); navigate('/login', { replace: true }) }

  const saveProfile = async () => {
    await profileApi.update(editForm)
    updateGuard(editForm)
    setShowEditSheet(false)
  }

  const changePassword = async () => {
    setPassError('')
    if (passForm.next !== passForm.confirm) { setPassError('Passwords do not match'); return }
    if (passForm.next.length < 10) { setPassError('Password must be at least 10 characters'); return }
    try {
      await authApi.changePassword(passForm.current, passForm.next)
      setPassDone(true)
      setTimeout(() => { setShowPassSheet(false); setPassDone(false); setPassForm({ current: '', next: '', confirm: '' }) }, 1500)
    } catch (e: any) {
      setPassError(e.response?.data?.error || 'Failed to change password')
    }
  }

  const handleFaceEnrolled = async (descriptor: number[]) => {
    await profileApi.saveFaceDescriptor(descriptor)
    updateGuard({ has_face_id: true })
    setFaceEnrolling(false)
    setShowFaceSheet(false)
  }

  const handleFaceRemove = async () => {
    if (!confirm('Remove Face ID? You will need to re-enrol before face verification is required on clock-in.')) return
    await profileApi.deleteFaceDescriptor()
    updateGuard({ has_face_id: false })
    setShowFaceSheet(false)
  }

  const expiringCerts = guard?.certifications?.filter(c => c.expiry && differenceInDays(parseISO(c.expiry), new Date()) <= 60) || []

  const openCertSheet = () => {
    setCertEdits((guard?.certifications || []).map(c => ({
      name: c.name,
      expiry: c.expiry || '',
      licence_number: c.licence_number || '',
    })))
    setShowCertSheet(true)
  }

  const saveCerts = async () => {
    setCertSaving(true)
    try {
      await profileApi.updateCertifications(certEdits)
      updateGuard({ certifications: certEdits })
      setShowCertSheet(false)
    } finally {
      setCertSaving(false)
    }
  }

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
          <p className="text-sm font-semibold text-white">£{guard?.hourly_rate}</p>
          <p className="text-white/30 text-xs">/hr</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-sm font-semibold text-white capitalize leading-tight">{guard?.employment_type?.replace('-', ' ')}</p>
          <p className="text-white/30 text-xs">Contract</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-sm font-semibold text-white">{guard?.certifications?.length || 0}</p>
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
          <div className="flex items-center justify-between mb-3">
            <p className="text-white/40 text-xs uppercase tracking-wider">Certifications</p>
            <button onClick={openCertSheet} className="text-brand-400 text-xs font-medium hover:text-brand-300">Edit licence numbers</button>
          </div>
          <div className="space-y-3">
            {guard!.certifications.map((c, i) => {
              const daysLeft = c.expiry ? differenceInDays(parseISO(c.expiry), new Date()) : null
              const color = daysLeft === null ? 'text-white/30' : daysLeft <= 30 ? 'text-red-400' : daysLeft <= 60 ? 'text-yellow-400' : 'text-green-400'
              return (
                <div key={i} className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <Shield size={14} className={`mt-0.5 shrink-0 ${color}`} />
                    <div className="min-w-0">
                      <p className="text-white/70 text-sm truncate">{c.name}</p>
                      {c.licence_number && (
                        <p className="text-white/40 text-xs font-mono mt-0.5">{c.licence_number}</p>
                      )}
                    </div>
                  </div>
                  <span className={`text-xs shrink-0 ${color}`}>
                    {c.expiry ? format(parseISO(c.expiry), 'MMM yyyy') : 'No expiry'}
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
                  <p className="text-green-400 font-semibold">£{r.net_pay.toFixed(2)}</p>
                  <StatusBadge status={r.status} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Face ID card */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${guard?.has_face_id ? 'bg-green-900/40 border border-green-700/30' : 'bg-white/5 border border-white/10'}`}>
              <ScanFace size={20} className={guard?.has_face_id ? 'text-green-400' : 'text-white/30'} />
            </div>
            <div>
              <p className="text-white font-medium text-sm">Face ID</p>
              <p className={`text-xs mt-0.5 ${guard?.has_face_id ? 'text-green-400' : 'text-white/30'}`}>
                {guard?.has_face_id ? 'Enrolled — used for clock-in verification' : 'Not enrolled'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowFaceSheet(true)}
            className="text-brand-400 text-sm font-medium hover:text-brand-300 transition-colors"
          >
            {guard?.has_face_id ? 'Manage' : 'Set up'}
          </button>
        </div>
      </Card>

      {/* Menu items */}
      <Card>
        {[
          { icon: Lock, label: 'Change Password', action: () => setShowPassSheet(true) },
          { icon: Shield, label: 'Privacy & Data', action: () => setShowPrivacy(true) },
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

      <InstallPromptButton />

      <button
        onClick={handleLogout}
        className="w-full py-4 border border-red-500/20 text-red-400 font-semibold rounded-2xl flex items-center justify-center gap-2 hover:bg-red-500/10 transition-colors"
      >
        <LogOut size={18} /> Sign Out
      </button>

      {showPrivacy && <PrivacyDialog onClose={() => setShowPrivacy(false)} />}

      {/* Cert licence number edit sheet */}
      {showCertSheet && (
        <BottomSheet title="SIA Licence Numbers" onClose={() => setShowCertSheet(false)}>
          <div className="space-y-4">
            <p className="text-white/40 text-xs">Enter your SIA licence number for each certification. This is visible to your manager.</p>
            {certEdits.map((c, i) => (
              <div key={i}>
                <label className="block text-white/50 text-xs mb-1.5">{c.name}</label>
                <input
                  className="w-full bg-surface rounded-xl px-3 py-2.5 text-white text-sm font-mono border border-white/10 focus:outline-none focus:border-brand-500 placeholder-white/20"
                  inputMode="numeric"
                  placeholder="Digits only, e.g. 1234567890123456"
                  value={c.licence_number}
                  onChange={e => setCertEdits(prev => prev.map((x, idx) => idx === i ? { ...x, licence_number: e.target.value.replace(/\D/g, '') } : x))}
                />
              </div>
            ))}
            <button
              onClick={saveCerts}
              disabled={certSaving}
              className="w-full py-4 bg-brand-600 disabled:opacity-50 text-white font-semibold rounded-xl"
            >
              {certSaving ? 'Saving…' : 'Save Licence Numbers'}
            </button>
          </div>
        </BottomSheet>
      )}

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

      {/* Face ID sheet */}
      {showFaceSheet && (
        <BottomSheet title="Face ID" onClose={() => { setShowFaceSheet(false); setFaceEnrolling(false) }}>
          {faceEnrolling ? (
            <FaceCapture
              mode="enroll"
              onSuccess={handleFaceEnrolled}
              onCancel={() => setFaceEnrolling(false)}
            />
          ) : (
            <div className="space-y-4">
              <div className={`flex items-center gap-3 p-4 rounded-xl ${guard?.has_face_id ? 'bg-green-900/20 border border-green-700/20' : 'bg-white/5 border border-white/10'}`}>
                {guard?.has_face_id
                  ? <CheckCircle2 size={24} className="text-green-400 shrink-0" />
                  : <ScanFace size={24} className="text-white/30 shrink-0" />}
                <div>
                  <p className="text-white text-sm font-medium">
                    {guard?.has_face_id ? 'Face ID is enrolled' : 'Face ID not set up'}
                  </p>
                  <p className="text-white/40 text-xs mt-0.5">
                    {guard?.has_face_id
                      ? 'Your face will be verified each time you clock in or out.'
                      : 'Enrol your face to enable biometric clock-in verification.'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setFaceEnrolling(true)}
                className="w-full py-4 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
              >
                <ScanFace size={18} />
                {guard?.has_face_id ? 'Re-enrol Face ID' : 'Enrol Face ID'}
              </button>

              {guard?.has_face_id && (
                <button
                  onClick={handleFaceRemove}
                  className="w-full py-4 border border-red-500/20 text-red-400 font-medium rounded-xl flex items-center justify-center gap-2 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 size={16} /> Remove Face ID
                </button>
              )}
            </div>
          )}
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
