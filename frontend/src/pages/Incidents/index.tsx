import { useEffect, useState } from 'react'
import { Incident } from '../../types'
import { incidentsApi, sitesApi, guardsApi } from '../../api'
import StatusBadge from '../../components/StatusBadge'
import Modal from '../../components/Modal'
import { Plus, CheckCircle, Zap, Download, Camera, Copy, AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'

const INCIDENT_TYPES = [
  'Altercation', 'Theft Attempt', 'Trespasser', 'Fake ID',
  'Suspicious Activity', 'Medical Emergency', 'Drugs Concern',
  'Property Damage', 'Client Complaint', 'Equipment Fault', 'Other',
]

export default function Incidents() {
  const [incidents, setIncidents]   = useState<Incident[]>([])
  const [total,     setTotal]       = useState(0)
  const [page,      setPage]        = useState(1)
  const PAGE_SIZE = 25
  const [sites, setSites]           = useState<any[]>([])
  const [guards, setGuards]         = useState<any[]>([])
  const [showForm, setShowForm]     = useState(false)
  const [selected, setSelected]     = useState<any>(null)
  const [aiReport, setAiReport]     = useState<string | null>(null)
  const [aiLoading, setAiLoading]   = useState(false)
  const [copied, setCopied]         = useState(false)
  const [form, setForm] = useState({
    site_id: '', guard_id: '', type: '', severity: 'minor',
    description: '', bodycam: false,
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const load = (p = page) =>
    incidentsApi.list({ page: p, limit: PAGE_SIZE }).then(r => {
      setIncidents(r.data); setTotal(r.total); setPage(p)
    })

  useEffect(() => {
    load(1)
    sitesApi.list().then(setSites)
    guardsApi.list().then(setGuards)
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    await incidentsApi.create(form)
    setShowForm(false)
    setForm({ site_id: '', guard_id: '', type: '', severity: 'minor', description: '', bodycam: false })
    load(1)
  }

  const resolve = async (id: number) => {
    if (!confirm('Mark this incident as resolved?')) return
    await incidentsApi.resolve(id)
    load(page)
    if (selected?.id === id) setSelected((prev: any) => prev ? { ...prev, resolved: 1 } : null)
  }

  const generateAI = async (inc: any) => {
    setAiLoading(true)
    setAiReport(null)
    try {
      const data = await incidentsApi.generateAI(inc.id)
      setAiReport(data.report)
    } catch {
      setAiReport('Error generating report. Please try again.')
    } finally {
      setAiLoading(false)
    }
  }

  const copyReport = () => {
    if (!aiReport) return
    navigator.clipboard.writeText(aiReport)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const downloadReport = (inc: any) => {
    if (!aiReport) return
    const blob = new Blob([aiReport], { type: 'text/plain' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `incident-report-${inc.id}-${format(new Date(inc.created_at), 'yyyy-MM-dd')}.txt`
    a.click()
  }

  const openIncidents = incidents.filter(i => !i.resolved).length
  const totalPages = Math.ceil(total / PAGE_SIZE)

  const sevColor: Record<string, string> = {
    minor:    'bg-yellow-100 text-yellow-700',
    major:    'bg-orange-100 text-orange-700',
    critical: 'bg-red-100 text-red-700',
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Incidents</h1>
          <p className="text-gray-500 text-sm mt-0.5">{openIncidents} open · {total} total</p>
        </div>
        <button className="btn-primary flex items-center gap-1.5 text-sm" onClick={() => setShowForm(true)}>
          <Plus size={15} /><span className="hidden sm:inline">Report Incident</span><span className="sm:hidden">Report</span>
        </button>
      </div>

      {/* Open incidents alert */}
      {openIncidents > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="text-orange-500 shrink-0" size={18} />
          <span className="text-orange-800 text-sm font-medium">
            {openIncidents} incident{openIncidents !== 1 ? 's' : ''} require attention — generate AI reports and send to clients
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6" style={{ minHeight: 400 }}>
        {/* Incident list */}
        <div className="lg:col-span-2 card overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
            <span className="font-semibold text-sm text-gray-600">All Incidents</span>
            <div className="flex gap-1">
              {['all', 'open', 'resolved'].map(f => (
                <button key={f} className="text-xs px-2 py-1 rounded text-gray-500 hover:bg-gray-200 capitalize">{f}</button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y min-h-0">
            {incidents.length === 0 && (
              <div className="p-8 text-center text-gray-400 text-sm">No incidents recorded</div>
            )}
            {incidents.map(inc => (
              <button
                key={inc.id}
                onClick={() => { setSelected(inc); setAiReport(inc.ai_report || null) }}
                className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${selected?.id === inc.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''}`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="font-semibold text-sm text-gray-900 truncate">{inc.type}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${sevColor[inc.severity] || sevColor.minor}`}>
                    {inc.severity}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mb-1.5 truncate">{inc.site_name}</div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{format(new Date(inc.created_at), 'dd MMM, HH:mm')}</span>
                  {(inc as any).bodycam === 1 && (
                    <span className="text-xs text-blue-500 flex items-center gap-0.5"><Camera size={10} />Bodycam</span>
                  )}
                  {inc.resolved ? (
                    <span className="text-xs text-green-600 flex items-center gap-0.5 ml-auto"><CheckCircle size={10} />Resolved</span>
                  ) : (
                    <span className="text-xs text-orange-500 ml-auto">Open</span>
                  )}
                </div>
              </button>
            ))}
          </div>
          {totalPages > 1 && (
            <div className="px-4 py-2 border-t flex items-center justify-between text-xs text-gray-500">
              <span>Page {page} of {totalPages}</span>
              <div className="flex gap-1">
                <button
                  disabled={page <= 1}
                  onClick={() => load(page - 1)}
                  className="px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-30"
                >Prev</button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => load(page + 1)}
                  className="px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-30"
                >Next</button>
              </div>
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div className="lg:col-span-3">
          {!selected ? (
            <div className="card p-10 text-center text-gray-400 h-full flex flex-col items-center justify-center">
              <AlertTriangle size={36} className="mb-3 opacity-20" />
              <div className="font-medium">Select an incident to view details</div>
              <div className="text-sm mt-1">or report a new one using the button above</div>
            </div>
          ) : (
            <div className="card overflow-hidden flex flex-col h-full">
              {/* Header */}
              <div className="px-5 py-4 border-b">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{selected.type}</h2>
                    <div className="text-sm text-gray-500 mt-0.5">
                      {selected.site_name} · {selected.first_name} {selected.last_name}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {format(new Date(selected.created_at), 'EEEE d MMMM yyyy, HH:mm')}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${sevColor[selected.severity] || sevColor.minor}`}>
                      {selected.severity}
                    </span>
                    {selected.resolved ? (
                      <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-green-100 text-green-700 flex items-center gap-1">
                        <CheckCircle size={11} />Resolved
                      </span>
                    ) : (
                      <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-orange-100 text-orange-700">Open</span>
                    )}
                    {(selected as any).bodycam === 1 && (
                      <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-blue-100 text-blue-700 flex items-center gap-1">
                        <Camera size={11} />Bodycam Secured
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* Description */}
                {selected.description && (
                  <div>
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Officer Account</div>
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-700 leading-relaxed">
                      {selected.description}
                    </div>
                  </div>
                )}

                {/* AI Report Section */}
                <div className="border border-blue-200 rounded-xl overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap size={16} className="text-blue-200" />
                      <span className="font-semibold text-white text-sm">AI Incident Report Generator</span>
                    </div>
                    <span className="text-xs text-blue-200">BS 7499 Compliant</span>
                  </div>

                  <div className="p-4">
                    {!aiReport && !aiLoading && (
                      <div className="text-center py-4">
                        <p className="text-sm text-gray-500 mb-4">
                          Generate a professional, client-ready incident report instantly using AI.
                          The report follows BS 7499 standards and can be sent directly to your client.
                        </p>
                        <button
                          onClick={() => generateAI(selected)}
                          className="btn-primary flex items-center gap-2 mx-auto"
                        >
                          <Zap size={15} /> Generate Report
                        </button>
                      </div>
                    )}

                    {aiLoading && (
                      <div className="py-6 text-center">
                        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                        <p className="text-sm text-gray-500">Analysing incident data and generating report...</p>
                        <p className="text-xs text-gray-400 mt-1">Usually takes 5–10 seconds</p>
                      </div>
                    )}

                    {aiReport && !aiLoading && (
                      <div>
                        <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed bg-gray-50 border border-gray-200 rounded-lg p-4 max-h-72 overflow-y-auto">
                          {aiReport}
                        </pre>
                        <div className="flex gap-2 mt-3 flex-wrap">
                          <button
                            onClick={copyReport}
                            className="btn-secondary flex items-center gap-1.5 text-sm"
                          >
                            {copied ? <><CheckCircle size={14} className="text-green-500" />Copied!</> : <><Copy size={14} />Copy Report</>}
                          </button>
                          <button
                            onClick={() => downloadReport(selected)}
                            className="btn-secondary flex items-center gap-1.5 text-sm"
                          >
                            <Download size={14} />Download .txt
                          </button>
                          <button
                            onClick={() => generateAI(selected)}
                            className="btn-secondary flex items-center gap-1.5 text-sm"
                          >
                            <Zap size={14} />Regenerate
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                {!selected.resolved && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => resolve(selected.id)}
                      className="btn-primary flex items-center gap-2 text-sm"
                    >
                      <CheckCircle size={15} /> Mark Resolved
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New incident form */}
      {showForm && (
        <Modal title="Report New Incident" onClose={() => setShowForm(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Site *</label>
                <select className="input" required value={form.site_id} onChange={e => set('site_id', e.target.value)}>
                  <option value="">Select site</option>
                  {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Officer Involved</label>
                <select className="input" value={form.guard_id} onChange={e => set('guard_id', e.target.value)}>
                  <option value="">None / Unknown</option>
                  {guards.map(g => <option key={g.id} value={g.id}>{g.first_name} {g.last_name}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="label">Incident Type *</label>
              <div className="grid grid-cols-3 gap-2">
                {INCIDENT_TYPES.map(t => (
                  <button
                    key={t} type="button"
                    onClick={() => set('type', t)}
                    className={`text-left px-3 py-2 rounded-lg text-xs border transition-colors ${
                      form.type === t
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-gray-200 text-gray-600 hover:border-blue-300'
                    }`}
                  >{t}</button>
                ))}
              </div>
              {!INCIDENT_TYPES.includes(form.type) && form.type && (
                <input className="input mt-2" value={form.type} onChange={e => set('type', e.target.value)} placeholder="Custom type..." />
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Severity</label>
                <div className="flex gap-2">
                  {[
                    { v: 'minor',    label: 'Low',      cls: 'border-yellow-400 text-yellow-700 bg-yellow-50' },
                    { v: 'major',    label: 'Medium',   cls: 'border-orange-400 text-orange-700 bg-orange-50' },
                    { v: 'critical', label: 'Critical', cls: 'border-red-500 text-red-700 bg-red-50' },
                  ].map(({ v, label, cls }) => (
                    <button
                      key={v} type="button"
                      onClick={() => set('severity', v)}
                      className={`flex-1 py-2 text-xs font-semibold rounded-lg border-2 transition-opacity ${cls} ${form.severity === v ? 'opacity-100' : 'opacity-30'}`}
                    >{label}</button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3 pt-6">
                <input
                  type="checkbox"
                  id="bodycam"
                  checked={form.bodycam}
                  onChange={e => set('bodycam', e.target.checked)}
                  className="w-4 h-4 accent-blue-600"
                />
                <label htmlFor="bodycam" className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                  <Camera size={14} className="text-blue-500" /> Body cam footage secured
                </label>
              </div>
            </div>

            <div>
              <label className="label">Description</label>
              <textarea
                className="input" rows={4}
                value={form.description}
                onChange={e => set('description', e.target.value)}
                placeholder="Describe what happened, when, actions taken, people involved..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={!form.type || !form.site_id} className="btn-primary disabled:opacity-40">
                Submit Report
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
