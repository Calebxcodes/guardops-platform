import { useState } from 'react'
import { Shield, Clock, DollarSign, Bell } from 'lucide-react'

export default function Settings() {
  const [company, setCompany] = useState({ name: 'GuardOps Security', email: 'admin@guardops.com', phone: '555-0000', timezone: 'Europe/London', currency: 'GBP' })
  const [payroll, setPayroll] = useState({ frequency: 'bi-weekly', overtime_threshold: 40, overtime_multiplier: 1.5, tax_rate: 10 })
  const [scheduling, setScheduling] = useState({ max_hours_day: 12, max_hours_week: 60, min_break_hours: 8, max_consecutive_days: 6 })
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Configure your GuardOps instance</p>
      </div>

      {/* Company Settings */}
      <div className="card p-5 space-y-4">
        <h2 className="font-semibold flex items-center gap-2"><Shield size={16} className="text-blue-500" /> Company</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Company Name</label>
            <input className="input" value={company.name} onChange={e => setCompany(c => ({ ...c, name: e.target.value }))} />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={company.email} onChange={e => setCompany(c => ({ ...c, email: e.target.value }))} />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" value={company.phone} onChange={e => setCompany(c => ({ ...c, phone: e.target.value }))} />
          </div>
          <div>
            <label className="label">Timezone</label>
            <select className="input" value={company.timezone} onChange={e => setCompany(c => ({ ...c, timezone: e.target.value }))}>
              <option value="Europe/London">London (GMT/BST)</option>
              <option value="Europe/Manchester">Manchester (GMT/BST)</option>
              <option value="Europe/Edinburgh">Edinburgh (GMT/BST)</option>
              <option value="Europe/Dublin">Dublin (GMT/IST)</option>
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
            <select className="input" value={payroll.frequency} onChange={e => setPayroll(p => ({ ...p, frequency: e.target.value }))}>
              <option value="weekly">Weekly</option>
              <option value="bi-weekly">Bi-Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div>
            <label className="label">Overtime Threshold (hours/week)</label>
            <input className="input" type="number" value={payroll.overtime_threshold} onChange={e => setPayroll(p => ({ ...p, overtime_threshold: parseInt(e.target.value) }))} />
          </div>
          <div>
            <label className="label">Overtime Multiplier</label>
            <input className="input" type="number" step="0.1" value={payroll.overtime_multiplier} onChange={e => setPayroll(p => ({ ...p, overtime_multiplier: parseFloat(e.target.value) }))} />
          </div>
          <div>
            <label className="label">Default Tax Rate (%)</label>
            <input className="input" type="number" step="0.1" value={payroll.tax_rate} onChange={e => setPayroll(p => ({ ...p, tax_rate: parseFloat(e.target.value) }))} />
          </div>
        </div>
      </div>

      {/* Scheduling Rules */}
      <div className="card p-5 space-y-4">
        <h2 className="font-semibold flex items-center gap-2"><Clock size={16} className="text-yellow-500" /> Scheduling Rules</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Max Hours per Day</label>
            <input className="input" type="number" value={scheduling.max_hours_day} onChange={e => setScheduling(s => ({ ...s, max_hours_day: parseInt(e.target.value) }))} />
          </div>
          <div>
            <label className="label">Max Hours per Week</label>
            <input className="input" type="number" value={scheduling.max_hours_week} onChange={e => setScheduling(s => ({ ...s, max_hours_week: parseInt(e.target.value) }))} />
          </div>
          <div>
            <label className="label">Min Break Between Shifts (hours)</label>
            <input className="input" type="number" value={scheduling.min_break_hours} onChange={e => setScheduling(s => ({ ...s, min_break_hours: parseInt(e.target.value) }))} />
          </div>
          <div>
            <label className="label">Max Consecutive Work Days</label>
            <input className="input" type="number" value={scheduling.max_consecutive_days} onChange={e => setScheduling(s => ({ ...s, max_consecutive_days: parseInt(e.target.value) }))} />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} className="btn-primary">
          {saved ? 'Saved!' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}
