import { useEffect, useState } from 'react'
import { Plus, AlertTriangle, CheckCircle, ChevronRight } from 'lucide-react'
import { profileApi } from '../../api'
import { Incident } from '../../types'
import { format } from 'date-fns'
import StatusBadge from '../../components/ui/StatusBadge'
import Card from '../../components/ui/Card'
import BottomSheet from '../../components/ui/BottomSheet'
import { useShiftStore } from '../../store/shiftStore'

const TYPES = ['Security Breach', 'Trespasser', 'Theft', 'Equipment Damage', 'Accident/Injury', 'Property Damage', 'Suspicious Activity', 'Client Complaint', 'Medical Emergency', 'Other']

export default function Incidents() {
  const todayShift = useShiftStore(s => s.todayShift)
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ type: '', severity: 'minor', description: '' })
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const load = () => profileApi.incidents().then(d => { setIncidents(d); setLoading(false) })
  useEffect(() => { load() }, [])

  const submit = async () => {
    if (!form.type) return
    setSubmitting(true)
    try {
      await profileApi.reportIncident({
        ...form,
        site_id: todayShift?.site_id,
        shift_id: todayShift?.id,
      })
      setDone(true)
      setTimeout(() => { setShowForm(false); setDone(false); setForm({ type: '', severity: 'minor', description: '' }); load() }, 1500)
    } finally { setSubmitting(false) }
  }

  const sevColor = { minor: 'text-yellow-400', major: 'text-orange-400', critical: 'text-red-400' }

  return (
    <div className="min-h-screen bg-surface px-4 pt-14 pb-4 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Incidents</h1>
        <button onClick={() => setShowForm(true)} className="w-9 h-9 bg-red-600 rounded-xl flex items-center justify-center">
          <Plus size={20} />
        </button>
      </div>

      {/* Report button */}
      <button
        onClick={() => setShowForm(true)}
        className="w-full bg-red-600/10 border border-red-500/20 hover:bg-red-600/20 text-red-400 font-semibold py-4 rounded-2xl flex items-center justify-center gap-2 transition-colors"
      >
        <AlertTriangle size={18} /> Report an Incident
      </button>

      {loading ? (
        <p className="text-white/20 text-center py-8">Loading...</p>
      ) : incidents.length === 0 ? (
        <Card className="p-8 text-center">
          <CheckCircle size={36} className="text-green-400/30 mx-auto mb-2" />
          <p className="text-white/30">No incidents reported</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {incidents.map(inc => (
            <Card key={inc.id} className="px-4 py-3.5 flex items-start gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-white/5`}>
                <AlertTriangle size={18} className={sevColor[inc.severity]} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-white text-sm">{inc.type}</p>
                  <StatusBadge status={inc.severity} />
                </div>
                <p className="text-white/40 text-xs mt-0.5">
                  {inc.site_name && `${inc.site_name} · `}
                  {format(new Date(inc.created_at), 'MMM d, h:mm a')}
                </p>
                {inc.description && <p className="text-white/50 text-xs mt-1 line-clamp-2">{inc.description}</p>}
                <div className="mt-1.5">
                  {inc.resolved ? (
                    <span className="text-green-400 text-xs flex items-center gap-1"><CheckCircle size={11} /> Resolved</span>
                  ) : (
                    <span className="text-yellow-400 text-xs">Under review</span>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showForm && (
        <BottomSheet title="Report Incident" onClose={() => { setShowForm(false); setDone(false) }}>
          {done ? (
            <div className="text-center py-8">
              <CheckCircle size={48} className="text-green-400 mx-auto mb-3" />
              <p className="text-white font-semibold">Report Submitted</p>
              <p className="text-white/40 text-sm mt-1">Your manager has been notified</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-white/40 text-xs mb-2">Incident Type *</label>
                <div className="grid grid-cols-2 gap-2">
                  {TYPES.map(t => (
                    <button
                      key={t}
                      onClick={() => set('type', t)}
                      className={`text-left px-3 py-2.5 rounded-xl text-sm border transition-colors ${
                        form.type === t
                          ? 'border-brand-500 bg-brand-900/30 text-white'
                          : 'border-white/10 text-white/50 hover:border-white/20'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-white/40 text-xs mb-2">Severity</label>
                <div className="flex gap-2">
                  {[
                    { v: 'minor', label: 'Low', cls: 'border-yellow-500/40 text-yellow-400 bg-yellow-500/10' },
                    { v: 'major', label: 'Medium', cls: 'border-orange-500/40 text-orange-400 bg-orange-500/10' },
                    { v: 'critical', label: 'Critical', cls: 'border-red-500/40 text-red-400 bg-red-500/10' },
                  ].map(({ v, label, cls }) => (
                    <button
                      key={v}
                      onClick={() => set('severity', v)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-opacity ${cls} ${form.severity === v ? 'opacity-100' : 'opacity-40'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-white/40 text-xs mb-1.5">Description</label>
                <textarea
                  rows={4}
                  className="w-full bg-surface rounded-xl px-3 py-2.5 text-white text-sm border border-white/10 focus:outline-none focus:border-brand-500 resize-none"
                  placeholder="Describe what happened, when, and any actions taken..."
                  value={form.description}
                  onChange={e => set('description', e.target.value)}
                />
              </div>

              {todayShift && (
                <p className="text-white/30 text-xs">Linked to: {todayShift.site_name}</p>
              )}

              <button
                onClick={submit}
                disabled={!form.type || submitting}
                className="w-full py-4 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-bold rounded-xl"
              >
                {submitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          )}
        </BottomSheet>
      )}
    </div>
  )
}
