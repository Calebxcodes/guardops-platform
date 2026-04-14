import { useEffect, useRef, useState } from 'react'
import { guardsApi, messagesApi } from '../../api'
import { Send, Megaphone, ShieldAlert, RefreshCw, X } from 'lucide-react'
import { format } from 'date-fns'

interface Message {
  id: number
  from_guard_id: number
  to_guard_id: number
  body: string
  is_emergency: number
  read_at: string | null
  created_at: string
  first_name?: string
  last_name?: string
  email?: string
}

interface Guard {
  id: number
  first_name: string
  last_name: string
  email: string
  status: string
}

export default function Messages() {
  const [guards, setGuards]           = useState<Guard[]>([])
  const [messages, setMessages]       = useState<Message[]>([])
  const [selected, setSelected]       = useState<Guard | null>(null)
  const [input, setInput]             = useState('')
  const [sending, setSending]         = useState(false)
  const [showBroadcast, setShowBroadcast] = useState(false)
  const [broadcastText, setBroadcastText] = useState('')
  const [broadcastSent, setBroadcastSent] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const loadMessages = () => messagesApi.list().then(setMessages)

  useEffect(() => {
    guardsApi.list().then(setGuards)
    loadMessages()
    const iv = setInterval(loadMessages, 15000)
    return () => clearInterval(iv)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [selected, messages])

  // Get all messages for a specific guard (thread)
  const threadFor = (guardId: number) =>
    messages
      .filter(m => m.from_guard_id === guardId || m.to_guard_id === guardId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  // Latest message per guard (for sidebar preview)
  const latestByGuard: Record<number, Message> = {}
  for (const m of messages) {
    const gid = m.from_guard_id !== 0 ? m.from_guard_id : m.to_guard_id
    if (!latestByGuard[gid] || new Date(m.created_at) > new Date(latestByGuard[gid].created_at)) {
      latestByGuard[gid] = m
    }
  }

  // Unread count per guard (messages FROM guard not yet read)
  const unreadByGuard: Record<number, number> = {}
  for (const m of messages) {
    if (m.from_guard_id !== 0 && !m.read_at) {
      unreadByGuard[m.from_guard_id] = (unreadByGuard[m.from_guard_id] || 0) + 1
    }
  }

  // Sort guards: those with messages first, then by latest message
  const sortedGuards = [...guards].sort((a, b) => {
    const la = latestByGuard[a.id]?.created_at
    const lb = latestByGuard[b.id]?.created_at
    if (la && lb) return new Date(lb).getTime() - new Date(la).getTime()
    if (la) return -1
    if (lb) return 1
    return 0
  })

  const send = async () => {
    if (!input.trim() || !selected || sending) return
    setSending(true)
    try {
      await messagesApi.send(selected.id, input.trim())
      setInput('')
      await loadMessages()
    } finally { setSending(false) }
  }

  const broadcast = async () => {
    if (!broadcastText.trim() || sending) return
    setSending(true)
    try {
      await messagesApi.broadcast(broadcastText.trim())
      setBroadcastSent(true)
      setBroadcastText('')
      setTimeout(() => { setBroadcastSent(false); setShowBroadcast(false) }, 1500)
      await loadMessages()
    } finally { setSending(false) }
  }

  const thread = selected ? threadFor(selected.id) : []

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Guard list sidebar ─────────────────────────────── */}
      <div className="w-64 xl:w-72 shrink-0 border-r bg-white flex flex-col">
        <div className="px-4 py-4 border-b flex items-center justify-between">
          <div>
            <h2 className="font-bold text-gray-900">Messages</h2>
            <p className="text-xs text-gray-400 mt-0.5">{guards.length} officers</p>
          </div>
          <div className="flex gap-1">
            <button
              onClick={loadMessages}
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              title="Refresh"
            >
              <RefreshCw size={14} />
            </button>
            <button
              onClick={() => setShowBroadcast(true)}
              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
              title="Broadcast to all"
            >
              <Megaphone size={14} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y">
          {sortedGuards.length === 0 && (
            <div className="px-4 py-8 text-center text-gray-400 text-sm">No officers found</div>
          )}
          {sortedGuards.map(g => {
            const latest = latestByGuard[g.id]
            const unread = unreadByGuard[g.id] || 0
            const isActive = selected?.id === g.id
            return (
              <button
                key={g.id}
                onClick={() => setSelected(g)}
                className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${isActive ? 'bg-blue-50 border-l-4 border-blue-600' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">
                      {g.first_name[0]}{g.last_name[0]}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{g.first_name} {g.last_name}</div>
                      {latest ? (
                        <div className={`text-xs truncate mt-0.5 ${unread > 0 ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
                          {latest.from_guard_id === 0 ? 'You: ' : ''}{latest.body}
                        </div>
                      ) : (
                        <div className="text-xs text-gray-300 mt-0.5">No messages yet</div>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    {latest && (
                      <div className="text-xs text-gray-300">
                        {format(new Date(latest.created_at), 'HH:mm')}
                      </div>
                    )}
                    {unread > 0 && (
                      <span className="bg-blue-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                        {unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Thread panel ───────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 bg-gray-50">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <Send size={36} className="mx-auto mb-3 opacity-20" />
              <div className="font-medium">Select an officer to view messages</div>
              <div className="text-sm mt-1">or use <strong>Broadcast</strong> to message all officers</div>
            </div>
          </div>
        ) : (
          <>
            {/* Thread header */}
            <div className="px-5 py-3.5 bg-white border-b flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold shrink-0">
                {selected.first_name[0]}{selected.last_name[0]}
              </div>
              <div>
                <div className="font-semibold text-gray-900">{selected.first_name} {selected.last_name}</div>
                <div className="text-xs text-gray-400">{selected.email}</div>
              </div>
              <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${
                selected.status === 'on-duty' ? 'bg-green-100 text-green-700' :
                selected.status === 'off-duty' ? 'bg-gray-100 text-gray-600' :
                'bg-yellow-100 text-yellow-700'
              }`}>{selected.status}</span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {thread.length === 0 && (
                <div className="text-center py-12 text-gray-400 text-sm">
                  No messages yet — send the first message below
                </div>
              )}
              {thread.map(msg => {
                const fromAdmin = msg.from_guard_id === 0
                return (
                  <div key={msg.id} className={`flex ${fromAdmin ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                      msg.is_emergency
                        ? 'bg-red-100 border border-red-300'
                        : fromAdmin
                          ? 'bg-blue-600 text-white'
                          : 'bg-white border border-gray-200 shadow-sm'
                    }`}>
                      {!fromAdmin && (
                        <p className="text-xs text-gray-400 mb-1">{selected.first_name}</p>
                      )}
                      {msg.is_emergency === 1 && (
                        <div className="flex items-center gap-1 text-red-600 text-xs mb-1 font-semibold">
                          <ShieldAlert size={12} /> Emergency Alert
                        </div>
                      )}
                      <p className={`text-sm leading-relaxed ${fromAdmin ? 'text-white' : 'text-gray-800'}`}>
                        {msg.body}
                      </p>
                      <p className={`text-xs mt-1 text-right ${fromAdmin ? 'text-white/50' : 'text-gray-400'}`}>
                        {format(new Date(msg.created_at), 'dd MMM, h:mm a')}
                      </p>
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="px-5 py-3 bg-white border-t flex items-center gap-3">
              <input
                className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={`Message ${selected.first_name}…`}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
              />
              <button
                onClick={send}
                disabled={!input.trim() || sending}
                className="w-10 h-10 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 rounded-xl flex items-center justify-center shrink-0 transition-colors"
              >
                <Send size={16} className="text-white" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Broadcast modal ─────────────────────────────────── */}
      {showBroadcast && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowBroadcast(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Megaphone size={18} className="text-blue-600" /> Broadcast Message
              </h3>
              <button onClick={() => setShowBroadcast(false)} className="text-gray-400 hover:text-gray-700 p-1">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              This message will be sent to <strong>all active officers</strong> and they will receive a push notification.
            </p>
            <textarea
              rows={4}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Type your broadcast message..."
              value={broadcastText}
              onChange={e => setBroadcastText(e.target.value)}
              autoFocus
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowBroadcast(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={broadcast}
                disabled={!broadcastText.trim() || sending || broadcastSent}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
              >
                {broadcastSent ? '✓ Sent!' : sending ? 'Sending…' : 'Send to All Officers'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
