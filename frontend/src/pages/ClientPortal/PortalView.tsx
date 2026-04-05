import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { format } from 'date-fns'
import { Shield, CheckCircle, AlertTriangle, Clock, MapPin, Users, FileText } from 'lucide-react'
import axios from 'axios'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api' })

export default function PortalView() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [selectedIncident, setSelectedIncident] = useState<any>(null)

  useEffect(() => {
    if (!token) return
    api.get(`/portal/${token}`)
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || 'Unable to load portal'))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <div className="text-gray-500">Loading your security portal...</div>
      </div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-gray-900 mb-2">Portal Unavailable</h1>
        <p className="text-gray-500">{error}</p>
        <p className="text-gray-400 text-sm mt-3">Contact your security provider if you believe this is an error.</p>
      </div>
    </div>
  )

  const { client, summary, sites, active_shifts, incidents, patrols } = data

  const openIncidents = incidents.filter((i: any) => !i.resolved)
  const resolvedIncidents = incidents.filter((i: any) => i.resolved)

  const severityConfig: Record<string, any> = {
    minor:    { label: 'Low',      color: 'text-yellow-600', bg: 'bg-yellow-50',  border: 'border-yellow-200' },
    major:    { label: 'Medium',   color: 'text-orange-600', bg: 'bg-orange-50',  border: 'border-orange-200' },
    critical: { label: 'Critical', color: 'text-red-600',    bg: 'bg-red-50',     border: 'border-red-200'    },
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gray-900 text-white">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
              <Shield size={20} />
            </div>
            <div>
              <div className="font-bold text-lg leading-none">SecureEdge</div>
              <div className="text-gray-400 text-xs">Client Security Portal</div>
            </div>
          </div>
          <div className="text-right">
            <div className="font-semibold text-sm">{client.name}</div>
            <div className="text-gray-400 text-xs">Live as of {format(new Date(), 'dd MMM yyyy, HH:mm')}</div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5"><MapPin size={11} /> Sites</div>
            <div className="text-3xl font-bold text-gray-900">{summary.covered_sites}/{summary.total_sites}</div>
            <div className="text-sm text-gray-500 mt-1">
              {summary.covered_sites === summary.total_sites ? (
                <span className="text-green-600 font-medium flex items-center gap-1"><CheckCircle size={13} /> All sites covered</span>
              ) : (
                <span className="text-yellow-600 font-medium">{summary.total_sites - summary.covered_sites} site(s) need attention</span>
              )}
            </div>
          </div>
          <div className={`bg-white border rounded-xl p-5 ${summary.open_incidents > 0 ? 'border-orange-200' : 'border-gray-200'}`}>
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5"><AlertTriangle size={11} /> Open Incidents</div>
            <div className={`text-3xl font-bold ${summary.open_incidents > 0 ? 'text-orange-600' : 'text-gray-900'}`}>{summary.open_incidents}</div>
            <div className="text-sm text-gray-500 mt-1">
              {summary.open_incidents === 0 ? <span className="text-green-600 font-medium flex items-center gap-1"><CheckCircle size={13} /> All clear</span> : 'Under investigation'}
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5"><Users size={11} /> Officers On Shift</div>
            <div className="text-3xl font-bold text-gray-900">
              {active_shifts.filter((s: any) => s.status === 'active').length}
            </div>
            <div className="text-sm text-gray-500 mt-1">active right now</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-200">
          {[
            { key: 'overview', label: 'Overview' },
            { key: 'shifts', label: `Shifts (${active_shifts.length})` },
            { key: 'incidents', label: `Incidents (${incidents.length})` },
            { key: 'patrols', label: `Patrol Log (${patrols.length})` },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === t.key
                  ? 'text-blue-600 border-blue-600'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {sites.map((site: any) => (
              <div key={site.id} className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-semibold text-gray-900">{site.name}</div>
                    <div className="text-sm text-gray-500 flex items-center gap-1 mt-0.5"><MapPin size={12} />{site.address}</div>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    site.active_guards >= site.guards_required
                      ? 'bg-green-100 text-green-700'
                      : site.active_guards > 0
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-red-100 text-red-700'
                  }`}>
                    {site.active_guards >= site.guards_required ? '✓ Fully Covered' :
                     site.active_guards > 0 ? '⚠ Partially Covered' : '✗ No Cover'}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-gray-500">
                    <strong className="text-gray-900">{site.active_guards}</strong> of {site.guards_required} required officers on site
                  </span>
                  {incidents.filter((i: any) => i.site_name === site.name && !i.resolved).length > 0 && (
                    <span className="text-orange-600 font-medium">
                      {incidents.filter((i: any) => i.site_name === site.name && !i.resolved).length} open incident(s)
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Shifts */}
        {activeTab === 'shifts' && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Site</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Officer</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Time</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {active_shifts.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No shifts data available</td></tr>
                )}
                {active_shifts.map((s: any) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{s.site_name}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {s.first_name ? `${s.first_name} ${s.last_name}` : <span className="text-gray-400">Unassigned</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs font-mono">
                      {format(new Date(s.start_time), 'dd MMM, HH:mm')} – {format(new Date(s.end_time), 'HH:mm')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        s.status === 'active' ? 'bg-green-100 text-green-700' :
                        s.status === 'assigned' ? 'bg-blue-100 text-blue-700' :
                        s.status === 'completed' ? 'bg-gray-100 text-gray-600' :
                        'bg-red-100 text-red-700'
                      }`}>{s.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Incidents */}
        {activeTab === 'incidents' && (
          <div className="space-y-3">
            {openIncidents.length > 0 && (
              <div>
                <div className="text-sm font-semibold text-gray-600 mb-2">Open Incidents</div>
                {openIncidents.map((inc: any) => (
                  <IncidentCard key={inc.id} inc={inc} severityConfig={severityConfig} onClick={() => setSelectedIncident(inc)} />
                ))}
              </div>
            )}
            {resolvedIncidents.length > 0 && (
              <div>
                <div className="text-sm font-semibold text-gray-600 mb-2 mt-4">Resolved (Last 30 Days)</div>
                {resolvedIncidents.map((inc: any) => (
                  <IncidentCard key={inc.id} inc={inc} severityConfig={severityConfig} onClick={() => setSelectedIncident(inc)} />
                ))}
              </div>
            )}
            {incidents.length === 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
                <CheckCircle className="text-green-400 mx-auto mb-3" size={36} />
                <div className="text-gray-500">No incidents recorded in the last 30 days</div>
              </div>
            )}
          </div>
        )}

        {/* Patrol Log */}
        {activeTab === 'patrols' && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {patrols.length === 0 ? (
              <div className="p-8 text-center text-gray-400">No patrol activity recorded in the last 24 hours</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Time</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Checkpoint</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Site</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Officer</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {patrols.map((p: any, i: number) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{format(new Date(p.created_at), 'HH:mm')}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{p.checkpoint_name}</td>
                      <td className="px-4 py-3 text-gray-600">{p.site_name}</td>
                      <td className="px-4 py-3 text-gray-600">{p.first_name} {p.last_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Incident detail modal */}
      {selectedIncident && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setSelectedIncident(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">{selectedIncident.type}</h3>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${severityConfig[selectedIncident.severity]?.bg} ${severityConfig[selectedIncident.severity]?.color} border ${severityConfig[selectedIncident.severity]?.border}`}>
                {severityConfig[selectedIncident.severity]?.label}
              </span>
            </div>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-400 mb-1">Site</div>
                  <div className="font-medium text-gray-900">{selectedIncident.site_name}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-400 mb-1">Reported By</div>
                  <div className="font-medium text-gray-900">{selectedIncident.first_name} {selectedIncident.last_name}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-400 mb-1">Date & Time</div>
                  <div className="font-medium text-gray-900">{format(new Date(selectedIncident.created_at), 'dd MMM yyyy, HH:mm')}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-400 mb-1">Status</div>
                  <div className={`font-medium ${selectedIncident.resolved ? 'text-green-600' : 'text-orange-600'}`}>
                    {selectedIncident.resolved ? '✓ Resolved' : 'Under investigation'}
                  </div>
                </div>
              </div>
              {selectedIncident.description && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-400 mb-1">Description</div>
                  <div className="text-gray-700 leading-relaxed">{selectedIncident.description}</div>
                </div>
              )}
              {selectedIncident.ai_report && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                  <div className="text-xs text-blue-500 mb-2 font-medium flex items-center gap-1"><FileText size={11} /> Official Incident Report</div>
                  <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">{selectedIncident.ai_report}</pre>
                </div>
              )}
              {selectedIncident.bodycam && (
                <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-2 text-xs text-gray-600">
                  <div className="w-2 h-2 bg-blue-500 rounded-full" /> Body camera footage secured and archived
                </div>
              )}
            </div>
            <button onClick={() => setSelectedIncident(null)} className="mt-5 w-full py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">Close</button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center py-8 text-xs text-gray-400 border-t border-gray-200 mt-8">
        Powered by <strong>SecureEdge</strong> · Secure client portal · Data refreshes on each page load
      </div>
    </div>
  )
}

function IncidentCard({ inc, severityConfig, onClick }: any) {
  const cfg = severityConfig[inc.severity] || severityConfig.minor
  return (
    <div
      onClick={onClick}
      className={`bg-white border rounded-xl p-4 mb-2 cursor-pointer hover:shadow-md transition-shadow ${cfg.border}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-gray-900">{inc.type}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.color} border ${cfg.border}`}>{cfg.label}</span>
            {inc.resolved && <span className="text-xs text-green-600 font-medium flex items-center gap-0.5"><CheckCircle size={11} /> Resolved</span>}
          </div>
          <div className="text-sm text-gray-500">{inc.site_name} · {format(new Date(inc.created_at), 'dd MMM, HH:mm')}</div>
          {inc.description && <div className="text-xs text-gray-400 mt-1 line-clamp-2">{inc.description}</div>}
        </div>
        <div className="text-gray-300 text-xs">View →</div>
      </div>
    </div>
  )
}
