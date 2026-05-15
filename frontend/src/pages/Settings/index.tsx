import { useState, useEffect, useRef } from 'react'
import {
  Shield, Clock, DollarSign, Lock, CheckCircle, AlertCircle, Loader,
  Copy, Eye, EyeOff, Trash2, Download, Archive, MessageCircle,
  Users, CreditCard, LifeBuoy, AlertOctagon,
} from 'lucide-react'
import { loadSettings, saveSettings, AppSettings } from '../../hooks/useSettings'
import PrivacyDialog from '../../components/PrivacyDialog'
import DeleteTenantModal from '../../components/DeleteTenantModal'
import { adminAuthApi, tenantApi } from '../../api'
import { useAuthStore, type RoleType } from '../../store/authStore'
import { useTenantStore } from '../../store/tenantStore'
import { canAccessSettings } from '../../utils/permissions'
import SettingsUsers from './Users'

type Tab = 'account' | 'team' | 'billing' | 'support' | 'danger'
type TwoFaStep = 'idle' | 'setup' | 'confirm' | 'backup' | 'disabling' | 'regen'

const TABS: { id: Tab; label: string; icon: React.ElementType; danger?: boolean }[] = [
  { id: 'account',  label: 'Account',    icon: Shield },
  { id: 'team',     label: 'Team',       icon: Users },
  { id: 'billing',  label: 'Billing',    icon: CreditCard },
  { id: 'support',  label: 'Support',    icon: LifeBuoy },
  { id: 'danger',   label: 'Danger Zone',icon: AlertOctagon, danger: true },
]

function D({ dirty }: { dirty: boolean }) {
  return dirty ? <span className="text-red-500 ml-0.5 font-normal">*</span> : null
}

export default function Settings() {
  const { admin, token } = useAuthStore()
  const tenant = useTenantStore(s => s.tenant)
  const role = (admin?.role || 'owner') as RoleType

  const [activeTab, setActiveTab] = useState<Tab>('account')

  // Feature flags
  const [chatbotEnabled,  setChatbotEnabled]  = useState(false)
  const [chatbotToggling, setChatbotToggling] = useState(false)

  // Settings with dirty tracking
  const [settings, setSettings] = useState<AppSettings>(loadSettings)
  const savedRef = useRef<AppSettings>(loadSettings())
  const [saved, setSaved] = useState(false)

  const isDirty = (key: keyof AppSettings) => settings[key] !== savedRef.current[key]
  const anyDirty = (Object.keys(settings) as (keyof AppSettings)[]).some(k => settings[k] !== savedRef.current[k])

  // Dialogs
  const [showPrivacy,    setShowPrivacy]    = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  // Export
  const [exportExpanded, setExportExpanded] = useState(false)
  const [exportPassword, setExportPassword] = useState('')
  const [exportLoading,  setExportLoading]  = useState(false)
  const [exportError,    setExportError]    = useState('')

  // Archive
  const [archiveExpanded, setArchiveExpanded] = useState(false)
  const [archivePassword, setArchivePassword] = useState('')
  const [archiveLoading,  setArchiveLoading]  = useState(false)
  const [archiveError,    setArchiveError]    = useState('')
  const [archiveDone,     setArchiveDone]     = useState(false)

  // 2FA
  const [twoFaEnabled,  setTwoFaEnabled]  = useState<boolean | null>(null)
  const [twoFaStep,     setTwoFaStep]     = useState<TwoFaStep>('idle')
  const [twoFaSecret,   setTwoFaSecret]   = useState('')
  const [twoFaQr,       setTwoFaQr]       = useState('')
  const [twoFaCode,     setTwoFaCode]     = useState('')
  const [twoFaPassword, setTwoFaPassword] = useState('')
  const [showTwoFaPass, setShowTwoFaPass] = useState(false)
  const [backupCodes,   setBackupCodes]   = useState<string[]>([])
  const [twoFaError,    setTwoFaError]    = useState('')
  const [twoFaLoading,  setTwoFaLoading]  = useState(false)

  useEffect(() => {
    adminAuthApi.twoFaStatus()
      .then(r => setTwoFaEnabled(r.enabled))
      .catch(() => setTwoFaEnabled(false))
  }, [])

  useEffect(() => {
    if (!token) return
    const apiBase = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api'
    fetch(`${apiBase}/feature-flags`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(flags => setChatbotEnabled(flags.chatbot_enabled === true))
      .catch(() => {})
  }, [token])

  const handleToggleChatbot = async (checked: boolean) => {
    setChatbotToggling(true)
    try {
      const apiBase = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api'
      await fetch(`${apiBase}/feature-flags`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ flag: 'chatbot_enabled', enabled: checked }),
      })
      setChatbotEnabled(checked)
    } catch { /* ignore */ }
    finally { setChatbotToggling(false) }
  }

  const resetTwoFa = () => {
    setTwoFaStep('idle'); setTwoFaCode(''); setTwoFaPassword('')
    setTwoFaSecret(''); setTwoFaQr(''); setTwoFaError(''); setBackupCodes([])
  }

  const startSetup = async () => {
    setTwoFaError(''); setTwoFaLoading(true)
    try {
      const { secret, qr_code } = await adminAuthApi.twoFaSetup()
      setTwoFaSecret(secret); setTwoFaQr(qr_code); setTwoFaStep('setup')
    } catch (e: any) { setTwoFaError(e.response?.data?.error || 'Setup failed') }
    finally { setTwoFaLoading(false) }
  }

  const confirmSetup = async () => {
    setTwoFaError(''); setTwoFaLoading(true)
    try {
      const { backup_codes } = await adminAuthApi.twoFaConfirm(twoFaCode)
      setBackupCodes(backup_codes); setTwoFaEnabled(true); setTwoFaStep('backup')
    } catch (e: any) { setTwoFaError(e.response?.data?.error || 'Invalid code'); setTwoFaCode('') }
    finally { setTwoFaLoading(false) }
  }

  const disableTwoFa = async () => {
    setTwoFaError(''); setTwoFaLoading(true)
    try {
      await adminAuthApi.twoFaDisable(twoFaPassword, twoFaCode)
      setTwoFaEnabled(false); resetTwoFa()
    } catch (e: any) { setTwoFaError(e.response?.data?.error || 'Failed to disable 2FA') }
    finally { setTwoFaLoading(false) }
  }

  const regenCodes = async () => {
    setTwoFaError(''); setTwoFaLoading(true)
    try {
      const { backup_codes } = await adminAuthApi.twoFaRegenerateCodes(twoFaCode)
      setBackupCodes(backup_codes); setTwoFaStep('backup')
    } catch (e: any) { setTwoFaError(e.response?.data?.error || 'Invalid code'); setTwoFaCode('') }
    finally { setTwoFaLoading(false) }
  }

  const handleExport = async () => {
    setExportError(''); setExportLoading(true)
    try {
      const result = await tenantApi.export(exportPassword)
      const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `export-${result.exportedAt.slice(0, 10)}.json`; a.click()
      URL.revokeObjectURL(url)
      setExportExpanded(false); setExportPassword('')
    } catch (e: any) { setExportError(e.response?.data?.message || 'Export failed') }
    finally { setExportLoading(false) }
  }

  const handleArchive = async () => {
    setArchiveError(''); setArchiveLoading(true)
    try {
      await tenantApi.archive(archivePassword)
      setArchiveDone(true)
    } catch (e: any) { setArchiveError(e.response?.data?.message || 'Archive failed') }
    finally { setArchiveLoading(false) }
  }

  const set = (key: keyof AppSettings, value: any) =>
    setSettings(s => ({ ...s, [key]: value }))

  const handleSave = () => {
    saveSettings(settings)
    savedRef.current = { ...settings }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Configure your Strondis Ops instance</p>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
        {TABS.map(tab => {
          if (tab.id === 'danger' && !canAccessSettings(role, 'dangerZone')) return null
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
                activeTab === tab.id
                  ? tab.danger
                    ? 'border-red-500 text-red-600'
                    : 'border-blue-600 text-blue-600'
                  : tab.danger
                    ? 'border-transparent text-red-400 hover:text-red-600 hover:border-red-300'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* ── ACCOUNT TAB ─────────────────────────────────────────── */}
      {activeTab === 'account' && (
        <div className="space-y-6">

          {/* Company Profile — read-only */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold flex items-center gap-2 text-gray-700">
                <Lock size={15} className="text-gray-400" /> Company Profile
              </h2>
              <span className="text-xs text-gray-400">Cannot be changed</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label flex items-center gap-1">
                  Company Name <Lock size={10} className="text-gray-400" />
                </label>
                <div className="input bg-gray-50 text-gray-500 cursor-not-allowed select-text">
                  {tenant?.name || '—'}
                </div>
              </div>
              <div>
                <label className="label flex items-center gap-1">
                  Company Slug <Lock size={10} className="text-gray-400" />
                </label>
                <div className="input bg-gray-50 text-gray-500 cursor-not-allowed font-mono text-sm select-text">
                  {tenant?.slug || '—'}
                </div>
              </div>
            </div>
          </div>

          {/* Editable company settings */}
          {canAccessSettings(role, 'company') && (
          <div className="card p-5 space-y-4">
            <h2 className="font-semibold flex items-center gap-2"><Shield size={16} className="text-blue-500" /> Company Settings</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Email <D dirty={isDirty('email')} /></label>
                <input className="input" type="email" value={settings.email} onChange={e => set('email', e.target.value)} />
              </div>
              <div>
                <label className="label">Phone <D dirty={isDirty('phone')} /></label>
                <input className="input" value={settings.phone} onChange={e => set('phone', e.target.value)} />
              </div>
              <div>
                <label className="label">Timezone <D dirty={isDirty('timezone')} /></label>
                <select className="input" value={settings.timezone} onChange={e => set('timezone', e.target.value)}>
                  <option value="Europe/London">London (GMT/BST)</option>
                  <option value="Europe/Dublin">Dublin (GMT/IST)</option>
                  <option value="Europe/Paris">Paris (CET/CEST)</option>
                  <option value="America/New_York">New York (ET)</option>
                  <option value="America/Chicago">Chicago (CT)</option>
                  <option value="America/Los_Angeles">Los Angeles (PT)</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
              <div>
                <label className="label">Currency <D dirty={isDirty('currency')} /></label>
                <select className="input" value={settings.currency} onChange={e => {
                  const symbols: Record<string, string> = { GBP: '£', USD: '$', EUR: '€', CAD: 'CA$', AUD: 'A$' }
                  set('currency', e.target.value)
                  set('currency_symbol', symbols[e.target.value] ?? e.target.value)
                }}>
                  <option value="GBP">GBP (£)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="CAD">CAD (CA$)</option>
                  <option value="AUD">AUD (A$)</option>
                </select>
              </div>
            </div>
          </div>
          )}

          {/* Payroll */}
          <div className="card p-5 space-y-4">
            <h2 className="font-semibold flex items-center gap-2"><DollarSign size={16} className="text-green-500" /> Payroll</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Pay Frequency <D dirty={isDirty('pay_frequency')} /></label>
                <select className="input" value={settings.pay_frequency} onChange={e => set('pay_frequency', e.target.value)}>
                  <option value="weekly">Weekly</option>
                  <option value="bi-weekly">Bi-Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label className="label">Overtime Threshold (hours/week) <D dirty={isDirty('overtime_threshold')} /></label>
                <input className="input" type="number" value={settings.overtime_threshold} onChange={e => set('overtime_threshold', parseInt(e.target.value))} />
              </div>
              <div>
                <label className="label">Overtime Multiplier <D dirty={isDirty('overtime_multiplier')} /></label>
                <input className="input" type="number" step="0.1" value={settings.overtime_multiplier} onChange={e => set('overtime_multiplier', parseFloat(e.target.value))} />
              </div>
              <div>
                <label className="label">Default Tax / Deduction Rate (%) <D dirty={isDirty('tax_rate')} /></label>
                <input className="input" type="number" step="0.1" min="0" max="100" value={settings.tax_rate} onChange={e => set('tax_rate', parseFloat(e.target.value))} />
              </div>
            </div>
          </div>

          {/* Scheduling Rules */}
          <div className="card p-5 space-y-4">
            <h2 className="font-semibold flex items-center gap-2"><Clock size={16} className="text-yellow-500" /> Scheduling Rules</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Max Hours per Day <D dirty={isDirty('max_hours_day')} /></label>
                <input className="input" type="number" value={settings.max_hours_day} onChange={e => set('max_hours_day', parseInt(e.target.value))} />
              </div>
              <div>
                <label className="label">Max Hours per Week <D dirty={isDirty('max_hours_week')} /></label>
                <input className="input" type="number" value={settings.max_hours_week} onChange={e => set('max_hours_week', parseInt(e.target.value))} />
              </div>
              <div>
                <label className="label">Min Break Between Shifts (hours) <D dirty={isDirty('min_break_hours')} /></label>
                <input className="input" type="number" value={settings.min_break_hours} onChange={e => set('min_break_hours', parseInt(e.target.value))} />
              </div>
              <div>
                <label className="label">Max Consecutive Work Days <D dirty={isDirty('max_consecutive_days')} /></label>
                <input className="input" type="number" value={settings.max_consecutive_days} onChange={e => set('max_consecutive_days', parseInt(e.target.value))} />
              </div>
            </div>
          </div>

          {/* Two-Factor Authentication */}
          <div className="card p-5 space-y-4">
            <h2 className="font-semibold flex items-center gap-2"><Lock size={16} className="text-purple-500" /> Two-Factor Authentication</h2>

            {twoFaEnabled === null && (
              <div className="flex items-center gap-2 text-gray-500 text-sm"><Loader size={14} className="animate-spin" /> Loading…</div>
            )}

            {twoFaEnabled === false && twoFaStep === 'idle' && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Protect your account with a time-based one-time password (TOTP) authenticator.</p>
                  <p className="text-xs text-gray-600 mt-1">Works with Google Authenticator, Authy, 1Password, and more.</p>
                </div>
                <button onClick={startSetup} disabled={twoFaLoading} className="btn-primary ml-4 whitespace-nowrap">
                  {twoFaLoading ? <Loader size={14} className="animate-spin" /> : 'Enable 2FA'}
                </button>
              </div>
            )}

            {twoFaEnabled && twoFaStep === 'idle' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-green-400 text-sm font-medium">
                  <CheckCircle size={16} /> Two-factor authentication is active
                </div>
                <div className="flex gap-3">
                  <button onClick={() => { setTwoFaStep('disabling'); setTwoFaError('') }}
                    className="btn text-sm border border-red-500/40 text-red-400 hover:bg-red-500/10 px-3 py-1.5 rounded-lg transition-colors">
                    Disable 2FA
                  </button>
                  <button onClick={() => { setTwoFaStep('regen'); setTwoFaError('') }}
                    className="btn text-sm border border-gray-600 text-gray-400 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition-colors">
                    Regenerate backup codes
                  </button>
                </div>
              </div>
            )}

            {twoFaError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-3 py-2 flex items-center gap-2 text-sm">
                <AlertCircle size={14} /> {twoFaError}
              </div>
            )}

            {twoFaStep === 'setup' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-400">Scan this QR code with your authenticator app, then enter the 6-digit code below.</p>
                {twoFaQr && <img src={twoFaQr} alt="2FA QR code" className="w-44 h-44 rounded-lg bg-white p-1" />}
                <div>
                  <p className="text-xs text-gray-600 mb-1">Or enter the secret manually:</p>
                  <div className="flex items-center gap-2">
                    <code className="bg-gray-900 text-gray-300 rounded px-2 py-1 text-xs tracking-widest select-all">{twoFaSecret}</code>
                    <button onClick={() => navigator.clipboard.writeText(twoFaSecret)} title="Copy" className="text-gray-500 hover:text-gray-300">
                      <Copy size={14} />
                    </button>
                  </div>
                </div>
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <label className="label">6-digit code</label>
                    <input className="input text-center text-xl tracking-widest" maxLength={6} value={twoFaCode}
                      onChange={e => setTwoFaCode(e.target.value.replace(/\D/g, ''))} placeholder="000000" />
                  </div>
                  <button onClick={confirmSetup} disabled={twoFaLoading || twoFaCode.length !== 6} className="btn-primary">
                    {twoFaLoading ? <Loader size={14} className="animate-spin" /> : 'Verify & Enable'}
                  </button>
                  <button onClick={resetTwoFa} className="btn border border-gray-600 text-gray-400 px-3 py-2 rounded-lg">Cancel</button>
                </div>
              </div>
            )}

            {twoFaStep === 'backup' && (
              <div className="space-y-3">
                <p className="text-sm text-green-400 font-medium flex items-center gap-2"><CheckCircle size={14} /> 2FA enabled successfully!</p>
                <p className="text-sm text-gray-400">Save these backup codes in a safe place. Each can be used once if you lose your device.</p>
                <div className="bg-gray-900 rounded-lg p-3 grid grid-cols-2 gap-1.5">
                  {backupCodes.map(c => (
                    <code key={c} className="text-xs text-gray-300 tracking-widest">{c}</code>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => navigator.clipboard.writeText(backupCodes.join('\n'))}
                    className="btn text-sm border border-gray-600 text-gray-400 hover:bg-gray-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors">
                    <Copy size={13} /> Copy all
                  </button>
                  <button onClick={resetTwoFa} className="btn-primary text-sm">Done</button>
                </div>
              </div>
            )}

            {twoFaStep === 'disabling' && (
              <div className="space-y-3">
                <p className="text-sm text-gray-400">Enter your password and current authenticator code to disable 2FA.</p>
                <div>
                  <label className="label">Password</label>
                  <div className="relative">
                    <input className="input pr-10" type={showTwoFaPass ? 'text' : 'password'} value={twoFaPassword}
                      onChange={e => setTwoFaPassword(e.target.value)} placeholder="Your account password" />
                    <button type="button" onClick={() => setShowTwoFaPass(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                      {showTwoFaPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="label">Authenticator code</label>
                  <input className="input text-center text-xl tracking-widest" maxLength={6} value={twoFaCode}
                    onChange={e => setTwoFaCode(e.target.value.replace(/\D/g, ''))} placeholder="000000" />
                </div>
                <div className="flex gap-2">
                  <button onClick={disableTwoFa} disabled={twoFaLoading || !twoFaPassword || twoFaCode.length !== 6}
                    className="btn border border-red-500/60 text-red-400 hover:bg-red-500/10 px-4 py-2 rounded-lg text-sm transition-colors">
                    {twoFaLoading ? <Loader size={14} className="animate-spin" /> : 'Disable 2FA'}
                  </button>
                  <button onClick={resetTwoFa} className="btn border border-gray-600 text-gray-400 px-3 py-2 rounded-lg text-sm">Cancel</button>
                </div>
              </div>
            )}

            {twoFaStep === 'regen' && (
              <div className="space-y-3">
                <p className="text-sm text-gray-400">Enter your current authenticator code to generate new backup codes. Old codes will be invalidated.</p>
                <div>
                  <label className="label">Authenticator code</label>
                  <input className="input text-center text-xl tracking-widest" maxLength={6} value={twoFaCode}
                    onChange={e => setTwoFaCode(e.target.value.replace(/\D/g, ''))} placeholder="000000" />
                </div>
                <div className="flex gap-2">
                  <button onClick={regenCodes} disabled={twoFaLoading || twoFaCode.length !== 6} className="btn-primary text-sm">
                    {twoFaLoading ? <Loader size={14} className="animate-spin" /> : 'Generate new codes'}
                  </button>
                  <button onClick={resetTwoFa} className="btn border border-gray-600 text-gray-400 px-3 py-2 rounded-lg text-sm">Cancel</button>
                </div>
              </div>
            )}
          </div>

          {/* Features — owner only */}
          {role === 'owner' && (
          <div className="card p-5 space-y-4">
            <h2 className="font-semibold flex items-center gap-2"><MessageCircle size={16} className="text-blue-500" /> Features</h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">AI Chatbot</p>
                <p className="text-xs text-gray-500 mt-0.5">Enable Strondis Assistant for your team (bottom-right button)</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={chatbotEnabled}
                  onChange={e => handleToggleChatbot(e.target.checked)}
                  disabled={chatbotToggling}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
              </label>
            </div>
          </div>
          )}

          {/* Save row */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <button onClick={() => setShowPrivacy(true)} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1.5 transition-colors">
              <Shield size={14} /> Privacy &amp; Data Policy
            </button>
            <div className="flex items-center gap-3">
              {anyDirty && <span className="text-xs text-red-500"><span>*</span> Unsaved changes</span>}
              <button onClick={handleSave} disabled={!anyDirty} className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed">
                {saved ? '✓ Saved' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TEAM TAB ─────────────────────────────────────────────── */}
      {activeTab === 'team' && <SettingsUsers />}

      {/* ── BILLING TAB ──────────────────────────────────────────── */}
      {activeTab === 'billing' && (
        <div className="space-y-4">
          <div className="card p-6 space-y-4">
            <h2 className="font-semibold flex items-center gap-2"><CreditCard size={16} className="text-blue-500" /> Billing &amp; Subscription</h2>
            <p className="text-sm text-gray-500">Manage your subscription and payment details.</p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm font-medium text-blue-700">Your 30-day free trial is active</p>
              <p className="text-xs text-blue-600 mt-1">Billing management is coming soon. Contact support for plan changes.</p>
            </div>
            <a href="mailto:support@strondis.com" className="btn-primary inline-flex items-center gap-2 text-sm">
              Contact Billing Support
            </a>
          </div>
        </div>
      )}

      {/* ── SUPPORT TAB ──────────────────────────────────────────── */}
      {activeTab === 'support' && (
        <div className="space-y-4">
          <div className="card p-6 space-y-4">
            <h2 className="font-semibold flex items-center gap-2"><LifeBuoy size={16} className="text-blue-500" /> Support &amp; Help</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="border border-gray-200 rounded-xl p-4 space-y-2">
                <p className="text-sm font-medium">Email Support</p>
                <p className="text-xs text-gray-500">Get help from our team within 24 hours</p>
                <a href="mailto:support@strondis.com" className="text-blue-500 hover:text-blue-600 text-sm">
                  support@strondis.com
                </a>
              </div>
              <div className="border border-gray-200 rounded-xl p-4 space-y-2">
                <p className="text-sm font-medium">Documentation</p>
                <p className="text-xs text-gray-500">Guides, tutorials and API reference</p>
                <a href="https://docs.strondis.com" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-600 text-sm">
                  docs.strondis.com ↗
                </a>
              </div>
              <div className="border border-gray-200 rounded-xl p-4 space-y-2">
                <p className="text-sm font-medium">Status Page</p>
                <p className="text-xs text-gray-500">Check system uptime and incidents</p>
                <a href="https://status.strondis.com" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-600 text-sm">
                  status.strondis.com ↗
                </a>
              </div>
              <div className="border border-gray-200 rounded-xl p-4 space-y-2">
                <p className="text-sm font-medium">AI Assistant</p>
                <p className="text-xs text-gray-500">Get instant answers in the app</p>
                <p className="text-xs text-gray-400">Enable the AI Chatbot in Account → Features</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── DANGER ZONE TAB ──────────────────────────────────────── */}
      {activeTab === 'danger' && canAccessSettings(role, 'dangerZone') && (
        <div className="rounded-xl border border-red-200 bg-red-50/50 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Trash2 size={15} className="text-red-500" />
            <h2 className="text-sm font-semibold text-red-700 uppercase tracking-wide">
              Data &amp; Account Management
            </h2>
          </div>

          {/* Export */}
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-900">Export Company Data</p>
                <p className="text-xs text-gray-500 mt-0.5">Download all your guards, shifts, clients, and records as a JSON file.</p>
              </div>
              <button
                onClick={() => { setExportExpanded(v => !v); setExportError('') }}
                className="shrink-0 flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Download size={14} /> Export Data
              </button>
            </div>
            {exportExpanded && (
              <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-2">
                <p className="text-xs text-gray-600">Enter your password to confirm the export:</p>
                <input type="password" className="input text-sm w-full" placeholder="Your password"
                  value={exportPassword} onChange={e => setExportPassword(e.target.value)} disabled={exportLoading} />
                {exportError && <p className="text-xs text-red-600">{exportError}</p>}
                <div className="flex gap-2">
                  <button onClick={() => { setExportExpanded(false); setExportPassword(''); setExportError('') }}
                    className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50" disabled={exportLoading}>
                    Cancel
                  </button>
                  <button onClick={handleExport} disabled={!exportPassword || exportLoading}
                    className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
                    {exportLoading ? <Loader size={13} className="animate-spin" /> : <Download size={13} />} Download JSON
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-red-100" />

          {/* Archive */}
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-900">Archive Account</p>
                <p className="text-xs text-gray-500 mt-0.5">Pause your account. Data is retained and recoverable within 30 days.</p>
              </div>
              <button
                onClick={() => { setArchiveExpanded(v => !v); setArchiveError(''); setArchiveDone(false) }}
                className="shrink-0 flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
              >
                <Archive size={14} /> Archive Account
              </button>
            </div>
            {archiveExpanded && (
              <div className="bg-white border border-amber-200 rounded-lg p-3 space-y-2">
                {archiveDone ? (
                  <p className="text-sm text-green-700 font-medium flex items-center gap-1.5">
                    <CheckCircle size={14} /> Account archived. Contact support to restore within 30 days.
                  </p>
                ) : (
                  <>
                    <p className="text-xs text-amber-700">Your account will be paused. Guards will lose access. Enter your password to confirm:</p>
                    <input type="password" className="input text-sm w-full" placeholder="Your password"
                      value={archivePassword} onChange={e => setArchivePassword(e.target.value)} disabled={archiveLoading} />
                    {archiveError && <p className="text-xs text-red-600">{archiveError}</p>}
                    <div className="flex gap-2">
                      <button onClick={() => { setArchiveExpanded(false); setArchivePassword(''); setArchiveError('') }}
                        className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50" disabled={archiveLoading}>
                        Cancel
                      </button>
                      <button onClick={handleArchive} disabled={!archivePassword || archiveLoading}
                        className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50">
                        {archiveLoading ? <Loader size={13} className="animate-spin" /> : <Archive size={13} />} Archive Account
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-red-100" />

          {/* Delete */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-900">Delete Company Account</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Permanently deletes your company account and all associated data. Shift history and payroll are retained for compliance.
              </p>
            </div>
            <button onClick={() => setShowDeleteModal(true)} className="shrink-0 btn-danger flex items-center gap-2 text-sm">
              <Trash2 size={14} /> Delete Company Account
            </button>
          </div>
        </div>
      )}

      {showPrivacy && <PrivacyDialog onClose={() => setShowPrivacy(false)} />}

      <DeleteTenantModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={async (password) => { await tenantApi.permanentDelete(password) }}
      />
    </div>
  )
}
