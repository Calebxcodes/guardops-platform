import { useEffect, useState } from 'react'
import { clientsApi, portalApi } from '../../api'
import { Client } from '../../types'
import { Link, ExternalLink, Copy, Plus, Trash2, CheckCircle, RefreshCw } from 'lucide-react'

export default function ClientPortal() {
  const [clients, setClients]         = useState<Client[]>([])
  const [tokens, setTokens]           = useState<Record<number, any[]>>({})
  const [selectedClient, setSelected] = useState<Client | null>(null)
  const [generating, setGenerating]   = useState(false)
  const [copied, setCopied]           = useState<string | null>(null)
  const [error, setError]             = useState<string | null>(null)

  useEffect(() => { clientsApi.list().then(setClients) }, [])

  const loadTokens = async (clientId: number) => {
    try {
      const data = await portalApi.listTokens(clientId)
      setTokens(t => ({ ...t, [clientId]: data }))
    } catch {
      setError('Failed to load portal links. Try refreshing.')
    }
  }

  const selectClient = (c: Client) => {
    setSelected(c)
    setError(null)
    loadTokens(c.id)
  }

  const generateToken = async (clientId: number) => {
    setGenerating(true)
    setError(null)
    try {
      await portalApi.generate(clientId, 'Client Portal')
      await loadTokens(clientId)
    } catch {
      setError('Failed to generate portal link.')
    } finally {
      setGenerating(false)
    }
  }

  const revokeToken = async (tokenId: number, clientId: number) => {
    if (!confirm('Revoke this portal link? The client will lose access immediately.')) return
    try {
      await portalApi.revokeToken(tokenId)
      await loadTokens(clientId)
    } catch {
      setError('Failed to revoke token.')
    }
  }

  const copyLink = (token: string) => {
    const url = getPortalUrl(token)
    navigator.clipboard.writeText(url)
    setCopied(token)
    setTimeout(() => setCopied(null), 2000)
  }

  const getPortalUrl = (token: string) => `${window.location.origin}/portal/${token}`

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Client Portal</h1>
        <p className="text-gray-500 text-sm mt-1">
          Give clients a live read-only view of their sites, officers, incidents and patrol logs
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm flex items-center justify-between">
          {error}
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-700 ml-4">✕</button>
        </div>
      )}

      {/* How it works */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
          <Link size={16} /> How Client Portals Work
        </div>
        <div className="text-blue-700 text-sm space-y-1">
          <div>1. Select a client and generate a secure portal link</div>
          <div>2. Send the link to your client — no login required, the link is the key</div>
          <div>3. They see live shift coverage, incident reports, and patrol logs for their sites only</div>
          <div>4. Revoke access at any time — the link stops working instantly</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Client list */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50 font-semibold text-sm text-gray-600">
            Select Client
          </div>
          <div className="divide-y max-h-[520px] overflow-y-auto">
            {clients.length === 0 && (
              <div className="px-4 py-6 text-center text-gray-400 text-sm">No clients found</div>
            )}
            {clients.map(c => (
              <button
                key={c.id}
                onClick={() => selectClient(c)}
                className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                  selectedClient?.id === c.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                }`}
              >
                <div className="font-medium text-sm text-gray-900">{c.name}</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {c.contact_name}
                  {(tokens[c.id]?.filter(t => t.active).length ?? 0) > 0 && (
                    <span className="ml-2 text-green-600">● portal active</span>
                  )}
                </div>
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
              {/* Card header */}
              <div className="px-5 py-4 border-b flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-gray-900 truncate">{selectedClient.name}</div>
                  <div className="text-xs text-gray-400 truncate">{selectedClient.contact_email}</div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => loadTokens(selectedClient.id)}
                    className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Refresh"
                  >
                    <RefreshCw size={15} />
                  </button>
                  <button
                    onClick={() => generateToken(selectedClient.id)}
                    disabled={generating}
                    className="btn-primary flex items-center gap-2 text-sm"
                  >
                    <Plus size={14} />
                    {generating ? 'Generating…' : 'Generate Link'}
                  </button>
                </div>
              </div>

              {/* Token list */}
              <div className="p-5 space-y-3 min-h-[120px]">
                {!tokens[selectedClient.id] ? (
                  <div className="text-center py-6 text-gray-400 text-sm">Loading…</div>
                ) : tokens[selectedClient.id].length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    No portal links yet — click <strong>Generate Link</strong> to create one.
                  </div>
                ) : (
                  tokens[selectedClient.id].map((t: any) => (
                    <TokenRow
                      key={t.id}
                      t={t}
                      url={getPortalUrl(t.token)}
                      copied={copied}
                      onCopy={() => copyLink(t.token)}
                      onRevoke={() => revokeToken(t.id, selectedClient.id)}
                    />
                  ))
                )}
              </div>

              {/* Preview link for most recent active token */}
              {tokens[selectedClient.id]?.find(t => t.active) && (
                <div className="px-5 pb-5">
                  <a
                    href={getPortalUrl(tokens[selectedClient.id].find(t => t.active)?.token)}
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

function TokenRow({
  t, url, copied, onCopy, onRevoke,
}: {
  t: any
  url: string
  copied: string | null
  onCopy: () => void
  onRevoke: () => void
}) {
  return (
    <div className={`border rounded-xl p-4 ${
      t.active ? 'border-green-200 bg-green-50/30' : 'border-gray-200 bg-gray-50 opacity-60'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              t.active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'
            }`}>
              {t.active ? 'Active' : 'Revoked'}
            </span>
            <span className="text-xs text-gray-500">{t.label}</span>
            <span className="text-xs text-gray-400">
              Created {new Date(t.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>
          <div className="font-mono text-xs text-gray-500 bg-white border rounded px-2.5 py-1.5 truncate select-all">
            {url}
          </div>
        </div>

        {t.active && (
          <div className="flex gap-1 shrink-0">
            <button
              onClick={onCopy}
              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Copy link"
            >
              {copied === t.token
                ? <CheckCircle size={16} className="text-green-500" />
                : <Copy size={16} />}
            </button>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Preview portal"
            >
              <ExternalLink size={16} />
            </a>
            <button
              onClick={onRevoke}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Revoke access"
            >
              <Trash2 size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
