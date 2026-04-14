import { useState } from 'react'
import { Shield, Clock, DollarSign } from 'lucide-react'
import { loadSettings, saveSettings, AppSettings } from '../../hooks/useSettings'
import PrivacyDialog from '../../components/PrivacyDialog'

export default function Settings() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings)
  const [saved, setSaved] = useState(false)
  const [showPrivacy, setShowPrivacy] = useState(false)

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
