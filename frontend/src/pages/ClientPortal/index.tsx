import { useEffect, useState } from 'react'
import { clientsApi } from '../../api'
import { Client } from '../../types'
import { Link, ExternalLink, Copy, Plus, Trash2, CheckCircle } from 'lucide-react'
import axios from 'axios'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api' })

export default function ClientPortal() {
  const [clients, setClients] = useState<Client[]>([])
  const [tokens, setTokens] = useState<Record<number, any[]>>({})
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    clientsApi.list().then(setClients)
  }, [])

  const loadTokens = async (clientId: number) => {
    const data = await api.get(`/portal/tokens/${clientId}`).then(r => r.data)
    setTokens(t => ({ ...t, [clientId]: data }))
  }

  const selectClient = (c: Client) => {
    setSelectedClient(c)
    loadTokens(c.id)
  }

  const generateToken = async (clientId: number) => {
    setGenerating(true)
    try {
      const data = await api.post('/portal/generate', { client_id: clientId, label: 'Client Portal' }).then(r => r.data)
      await loadTokens(clientId)
    } finally {
      setGenerating(false)
    }
  }

  const revokeToken = async (tokenId: number, clientId: number) => {
    if (!confirm('Revoke this portal link? The client will lose access immediately.')) return
    await api.delete(`/portal/tokens/${tokenId}`)
    await loadTokens(clientId)
  }

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/portal/${token}`
    navigator.clipboard.writeText(url)
    setCopied(token)
    setTimeout(() => setCopied(null), 2000)
  }

  const getPortalUrl = (token: string) => `${window.location.origin}/portal/${token}`

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Client Portal</h1>
        <p className="text-gray-500 text-sm mt-1">
          Give clients a live read-only view of their sites, officers, incidents, and patrol logs
        </p>
      </div>

      {/* How it works */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="font-semibold text-blue-800 mb-2 flex items-center gap-2"><Link size={16} /> How Client Portals Work</div>
        <div className="text-blue-700 text-sm space-y-1">
          <div>1. Select a client and generate a secure portal link</div>
          <div>2. Send the link to your client — no login required, just the link</div>
          <div>3. They see live shift coverage, incident reports, and patrol logs for their sites</div>
          <div>4. Revoke access anytime — the link instantly stops working</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Client list */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50 font-semibold text-sm text-gray-600">Select Client</div>
          <div className="divide-y">
            {clients.map(c => (
              <button
                key={c.id}
                onClick={() => selectClient(c)}
                className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${selectedClient?.id === c.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''}`}
              >
                <div className="font-medium text-sm text-gray-900">{c.name}</div>
                <div className="text-xs text-gray-400 mt-0.5">{c.contact_name} · {c.site_count || 0} sites</div>
              </button>
            ))}
          </div>
        </div>

        {/* Portal links */}
        <div className="lg:col-span-2">
          {!selectedClient ? (
            <div className="card p-8 text-center text-gray-400">
              <Link size={36} className="mx-auto mb-3 opacity-20" />
              <div>Select a client to manage their portal access</div>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b flex items-center justify-between">
                <div>
                  <div className="font-semibold text-gray-900">{selectedClient.name}</div>
                  <div className="text-xs text-gray-400">{selectedClient.contact_email}</div>
                </div>
                <button
                  onClick={() => generateToken(selectedClient.id)}
                  disabled={generating}
                  className="btn-primary flex items-center gap-2 text-sm"
                >
                  <Plus size={14} /> {generating ? 'Generating...' : 'Generate Link'}
                </button>
              </div>

              <div className="p-5 space-y-3">
                {(!tokens[selectedClient.id] || tokens[selectedClient.id].length === 0) ? (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    No portal links yet. Generate one to give this client access.
                  </div>
                ) : tokens[selectedClient.id].map((t: any) => (
                  <div key={t.id} className={`border rounded-xl p-4 ${t.active ? 'border-green-200 bg-green-50/30' : 'border-gray-200 bg-gray-50 opacity-60'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                            {t.active ? 'Active' : 'Revoked'}
                          </span>
                          <span className="text-xs text-gray-400">{t.label}</span>
                          <span className="text-xs text-gray-300">Created {new Date(t.created_at).toLocaleDateString('en-GB')}</span>
                        </div>
                        <div className="font-mono text-xs text-gray-500 bg-white border rounded px-2 py-1 truncate">
                          {getPortalUrl(t.token)}
                        </div>
                      </div>
                      {t.active && (
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => copyLink(t.token)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Copy link"
                          >
                            {copied === t.token ? <CheckCircle size={16} className="text-green-500" /> : <Copy size={16} />}
                          </button>
                          <a
                            href={getPortalUrl(t.token)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Preview portal"
                          >
                            <ExternalLink size={16} />
                          </a>
                          <button
                            onClick={() => revokeToken(t.id, selectedClient.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Revoke access"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Preview button if active token exists */}
              {tokens[selectedClient.id]?.find((t: any) => t.active) && (
                <div className="px-5 pb-5">
                  <a
                    href={getPortalUrl(tokens[selectedClient.id].find((t: any) => t.active)?.token)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary w-full flex items-center justify-center gap-2 text-sm"
                  >
                    <ExternalLink size={14} /> Preview Client Portal View
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
