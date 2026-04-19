import { useState, useEffect } from 'react'
import { Shield, Clock, DollarSign, Lock, CheckCircle, AlertCircle, Loader, Copy, Eye, EyeOff } from 'lucide-react'
import { loadSettings, saveSettings, AppSettings } from '../../hooks/useSettings'
import PrivacyDialog from '../../components/PrivacyDialog'
import { adminAuthApi } from '../../api'

type TwoFaStep = 'idle' | 'setup' | 'confirm' | 'backup' | 'disabling' | 'regen'

export default function Settings() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings)
  const [saved, setSaved] = useState(false)
  const [showPrivacy, setShowPrivacy] = useState(false)

  // 2FA state
  const [twoFaEnabled,   setTwoFaEnabled]   = useState<boolean | null>(null)
  const [twoFaStep,      setTwoFaStep]      = useState<TwoFaStep>('idle')
  const [twoFaSecret,    setTwoFaSecret]    = useState('')
  const [twoFaQr,        setTwoFaQr]        = useState('')
  const [twoFaCode,      setTwoFaCode]      = useState('')
  const [twoFaPassword,  setTwoFaPassword]  = useState('')
  const [showTwoFaPass,  setShowTwoFaPass]  = useState(false)
  const [backupCodes,    setBackupCodes]    = useState<string[]>([])
  const [twoFaError,     setTwoFaError]     = useState('')
  const [twoFaLoading,   setTwoFaLoading]   = useState(false)

  useEffect(() => {
    adminAuthApi.twoFaStatus()
      .then(r => setTwoFaEnabled(r.enabled))
      .catch(() => setTwoFaEnabled(false))
  }, [])

  const resetTwoFa = () => {
    setTwoFaStep('idle'); setTwoFaCode(''); setTwoFaPassword('')
    setTwoFaSecret(''); setTwoFaQr(''); setTwoFaError(''); setBackupCodes([])
  }

  const startSetup = async () => {
    setTwoFaError('')
    setTwoFaLoading(true)
    try {
      const { secret, qr_code } = await adminAuthApi.twoFaSetup()
      setTwoFaSecret(secret); setTwoFaQr(qr_code); setTwoFaStep('setup')
    } catch (e: any) { setTwoFaError(e.response?.data?.error || 'Setup failed') }
    finally { setTwoFaLoading(false) }
  }

  const confirmSetup = async () => {
    setTwoFaError('')
    setTwoFaLoading(true)
    try {
      const { backup_codes } = await adminAuthApi.twoFaConfirm(twoFaCode)
      setBackupCodes(backup_codes); setTwoFaEnabled(true); setTwoFaStep('backup')
    } catch (e: any) { setTwoFaError(e.response?.data?.error || 'Invalid code'); setTwoFaCode('') }
    finally { setTwoFaLoading(false) }
  }

  const disableTwoFa = async () => {
    setTwoFaError('')
    setTwoFaLoading(true)
    try {
      await adminAuthApi.twoFaDisable(twoFaPassword, twoFaCode)
      setTwoFaEnabled(false); resetTwoFa()
    } catch (e: any) { setTwoFaError(e.response?.data?.error || 'Failed to disable 2FA') }
    finally { setTwoFaLoading(false) }
  }

  const regenCodes = async () => {
    setTwoFaError('')
    setTwoFaLoading(true)
    try {
      const { backup_codes } = await adminAuthApi.twoFaRegenerateCodes(twoFaCode)
      setBackupCodes(backup_codes); setTwoFaStep('backup')
    } catch (e: any) { setTwoFaError(e.response?.data?.error || 'Invalid code'); setTwoFaCode('') }
    finally { setTwoFaLoading(false) }
  }

  const set = (key: keyof AppSettings, value: any) =>
    setSettings(s => ({ ...s, [key]: value }))

  const handleSave = () => {
    saveSettings(settings)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Configure your Strondis Ops instance</p>
      </div>

      {/* Company Settings */}
      <div className="card p-5 space-y-4">
        <h2 className="font-semibold flex items-center gap-2"><Shield size={16} className="text-blue-500" /> Company</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Company Name</label>
            <input className="input" value={settings.company_name} onChange={e => set('company_name', e.target.value)} />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={settings.email} onChange={e => set('email', e.target.value)} />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" value={settings.phone} onChange={e => set('phone', e.target.value)} />
          </div>
          <div>
            <label className="label">Timezone</label>
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
            <label className="label">Currency</label>
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

      {/* Payroll Config */}
      <div className="card p-5 space-y-4">
        <h2 className="font-semibold flex items-center gap-2"><DollarSign size={16} className="text-green-500" /> Payroll</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Pay Frequency</label>
            <select className="input" value={settings.pay_frequency} onChange={e => set('pay_frequency', e.target.value)}>
              <option value="weekly">Weekly</option>
              <option value="bi-weekly">Bi-Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div>
            <label className="label">Overtime Threshold (hours/week)</label>
            <input className="input" type="number" value={settings.overtime_threshold} onChange={e => set('overtime_threshold', parseInt(e.target.value))} />
          </div>
          <div>
            <label className="label">Overtime Multiplier</label>
            <input className="input" type="number" step="0.1" value={settings.overtime_multiplier} onChange={e => set('overtime_multiplier', parseFloat(e.target.value))} />
          </div>
          <div>
            <label className="label">Default Tax / Deduction Rate (%)</label>
            <input className="input" type="number" step="0.1" min="0" max="100" value={settings.tax_rate} onChange={e => set('tax_rate', parseFloat(e.target.value))} />
          </div>
        </div>
      </div>

      {/* Scheduling Rules */}
      <div className="card p-5 space-y-4">
        <h2 className="font-semibold flex items-center gap-2"><Clock size={16} className="text-yellow-500" /> Scheduling Rules</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Max Hours per Day</label>
            <input className="input" type="number" value={settings.max_hours_day} onChange={e => set('max_hours_day', parseInt(e.target.value))} />
          </div>
          <div>
            <label className="label">Max Hours per Week</label>
            <input className="input" type="number" value={settings.max_hours_week} onChange={e => set('max_hours_week', parseInt(e.target.value))} />
          </div>
          <div>
            <label className="label">Min Break Between Shifts (hours)</label>
            <input className="input" type="number" value={settings.min_break_hours} onChange={e => set('min_break_hours', parseInt(e.target.value))} />
          </div>
          <div>
            <label className="label">Max Consecutive Work Days</label>
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

        {/* Setup step 1: QR code */}
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

        {/* Setup step 2: backup codes */}
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

        {/* Disable 2FA */}
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

        {/* Regenerate backup codes */}
        {twoFaStep === 'regen' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-400">Enter your current authenticator code to generate new backup codes. Old codes will be invalidated.</p>
            <div>
              <label className="label">Authenticator code</label>
              <input className="input text-center text-xl tracking-widest" maxLength={6} value={twoFaCode}
                onChange={e => setTwoFaCode(e.target.value.replace(/\D/g, ''))} placeholder="000000" />
            </div>
            <div className="flex gap-2">
              <button onClick={regenCodes} disabled={twoFaLoading || twoFaCode.length !== 6}
                className="btn-primary text-sm">
                {twoFaLoading ? <Loader size={14} className="animate-spin" /> : 'Generate new codes'}
              </button>
              <button onClick={resetTwoFa} className="btn border border-gray-600 text-gray-400 px-3 py-2 rounded-lg text-sm">Cancel</button>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button onClick={() => setShowPrivacy(true)} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1.5 transition-colors">
          <Shield size={14} /> Privacy & Data Policy
        </button>
        <button onClick={handleSave} className="btn-primary">
          {saved ? '✓ Saved' : 'Save Settings'}
        </button>
      </div>

      {showPrivacy && <PrivacyDialog onClose={() => setShowPrivacy(false)} />}
    </div>
  )
}
