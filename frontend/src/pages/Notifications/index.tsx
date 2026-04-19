import { useState, useEffect } from 'react'
import { Bell, Send, Users, User, CheckCircle, AlertTriangle, Clock, Loader, Radio } from 'lucide-react'
import { notificationsApi } from '../../api'
import { format } from 'date-fns'

type Urgency = 'normal' | 'high' | 'critical'

const URGENCY_STYLES: Record<Urgency, string> = {
  normal:   'bg-blue-500/10 text-blue-400 border-blue-500/30',
  high:     'bg-orange-500/10 text-orange-400 border-orange-500/30',
  critical: 'bg-red-500/10 text-red-400 border-red-500/30',
}

export default function Notifications() {
  const [subs,    setSubs]    = useState<any[]>([])
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Form state
  const [mode,     setMode]     = useState<'broadcast' | 'individual'>('broadcast')
  const [guardId,  setGuardId]  = useState<number | ''>('')
  const [title,    setTitle]    = useState('')
  const [body,     setBody]     = useState('')
  const [url,      setUrl]      = useState('/')
  const [urgency,  setUrgency]  = useState<Urgency>('normal')
  const [sending,  setSending]  = useState(false)
  const [result,   setResult]   = useState<{ success: boolean; recipients: number } | null>(null)
  const [error,    setError]    = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const [s, h] = await Promise.all([notificationsApi.subscriptions(), notificationsApi.history()])
      setSubs(s); setHistory(h)
    } catch { /* keep stale */ }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const subscribedGuards = subs.filter(s => s.subscription_count > 0)
  const totalSubscribed  = subscribedGuards.length

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setResult(null)
    if (!title.trim() || !body.trim()) { setError('Title and message are required'); return }
    if (mode === 'individual' && !guardId) { setError('Select a guard'); return }
    setSending(true)
    try {
      const r = await notificationsApi.send({
        ...(mode === 'individual' ? { guard_id: guardId as number } : {}),
        title, body, url: url || '/', urgency,
      })
      setResult(r)
      setTitle(''); setBody(''); setUrl('/'); setUrgency('normal'); setGuardId('')
      load()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send notification')
    } finally { setSending(false) }
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Bell size={22} /> Notifications</h1>
        <p className="text-gray-500 text-sm mt-1">Send push notifications to guards on their devices</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-blue-400">{totalSubscribed}</div>
          <div className="text-xs text-gray-500 mt-0.5">Guards subscribed</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-gray-300">{subs.length - totalSubscribed}</div>
          <div className="text-xs text-gray-500 mt-0.5">Not subscribed</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-purple-400">{history.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">Sent (last 50)</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Send form */}
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold flex items-center gap-2"><Send size={15} /> Send Notification</h2>

          {/* Mode toggle */}
          <div className="flex rounded-lg bg-gray-800 p-1 gap-1">
            <button onClick={() => setMode('broadcast')}
              className={`flex-1 flex items-center justify-center gap-2 text-sm py-2 rounded-md font-medium transition-colors ${mode === 'broadcast' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
              <Radio size={14} /> Broadcast
            </button>
            <button onClick={() => setMode('individual')}
              className={`flex-1 flex items-center justify-center gap-2 text-sm py-2 rounded-md font-medium transition-colors ${mode === 'individual' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
              <User size={14} /> Individual
            </button>
          </div>

          <form onSubmit={handleSend} className="space-y-3">
            {mode === 'individual' && (
              <div>
                <label className="label">Guard</label>
                <select className="input" value={guardId} onChange={e => setGuardId(e.target.value ? Number(e.target.value) : '')}>
                  <option value="">— Select a guard —</option>
                  {subscribedGuards.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
                {subscribedGuards.length === 0 && (
                  <p className="text-xs text-orange-400 mt-1">No guards have push notifications enabled yet.</p>
                )}
              </div>
            )}

            <div>
              <label className="label">Title</label>
              <input className="input" value={title} onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Shift Update" maxLength={80} />
            </div>

            <div>
              <label className="label">Message</label>
              <textarea className="input resize-none" rows={3} value={body}
                onChange={e => setBody(e.target.value)} placeholder="Notification body…" maxLength={200} />
              <p className="text-xs text-gray-600 text-right mt-0.5">{body.length}/200</p>
            </div>

            <div>
              <label className="label">Link (optional)</label>
              <input className="input" value={url} onChange={e => setUrl(e.target.value)}
                placeholder="/ or /schedule" />
            </div>

            <div>
              <label className="label">Urgency</label>
              <div className="flex gap-2">
                {(['normal', 'high', 'critical'] as Urgency[]).map(u => (
                  <button key={u} type="button" onClick={() => setUrgency(u)}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-lg border capitalize transition-colors ${urgency === u ? URGENCY_STYLES[u] : 'border-gray-700 text-gray-500 hover:border-gray-500'}`}>
                    {u}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-3 py-2 text-sm flex items-center gap-2">
                <AlertTriangle size={14} /> {error}
              </div>
            )}

            {result && (
              <div className="bg-green-500/10 border border-green-500/30 text-green-400 rounded-lg px-3 py-2 text-sm flex items-center gap-2">
                <CheckCircle size={14} /> Sent to {result.recipients} guard{result.recipients !== 1 ? 's' : ''}
              </div>
            )}

            <button type="submit" disabled={sending || (mode === 'broadcast' && totalSubscribed === 0)}
              className="w-full btn-primary flex items-center justify-center gap-2">
              {sending ? <><Loader size={15} className="animate-spin" /> Sending…</> : <><Send size={15} /> Send{mode === 'broadcast' ? ` to all (${totalSubscribed})` : ''}</>}
            </button>
          </form>
        </div>

        {/* Subscriptions list */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
            <Users size={15} className="text-gray-400" />
            <h2 className="font-semibold text-sm">Guard Subscriptions</h2>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-10 text-gray-500 text-sm gap-2">
              <Loader size={14} className="animate-spin" /> Loading…
            </div>
          ) : (
            <div className="divide-y divide-gray-800 max-h-96 overflow-y-auto">
              {subs.length === 0 ? (
                <div className="py-10 text-center text-gray-500 text-sm">No guards found</div>
              ) : subs.map(g => (
                <div key={g.id} className="flex items-center justify-between px-4 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-gray-200">{g.name}</p>
                    <p className="text-xs text-gray-500">{g.email}</p>
                  </div>
                  {g.subscription_count > 0 ? (
                    <span className="text-xs text-green-400 flex items-center gap-1">
                      <CheckCircle size={12} /> {g.subscription_count} device{g.subscription_count > 1 ? 's' : ''}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-600">Not subscribed</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* History */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
          <Clock size={15} className="text-gray-400" />
          <h2 className="font-semibold text-sm">Recent Notifications</h2>
        </div>
        {history.length === 0 ? (
          <div className="py-10 text-center text-gray-500 text-sm">No notifications sent yet</div>
        ) : (
          <div className="divide-y divide-gray-800">
            {history.map(h => (
              <div key={h.id} className="flex items-start justify-between px-4 py-3 gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-200">{h.extra?.title || '—'}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded border capitalize ${URGENCY_STYLES[(h.extra?.urgency as Urgency) || 'normal']}`}>
                      {h.extra?.urgency || 'normal'}
                    </span>
                    {h.action === 'push_broadcast'
                      ? <span className="text-xs text-blue-400 flex items-center gap-1"><Radio size={10} /> Broadcast</span>
                      : <span className="text-xs text-gray-500 flex items-center gap-1"><User size={10} /> {h.guard_name || 'Unknown'}</span>
                    }
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">by {h.sent_by || 'Admin'}</p>
                </div>
                <span className="text-xs text-gray-600 shrink-0">
                  {format(new Date(h.created_at), 'd MMM HH:mm')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
