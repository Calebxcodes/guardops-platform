import { useEffect, useRef, useState } from 'react'
import { guardsApi, messagesApi } from '../../api'
import { Send, Megaphone, ShieldAlert, RefreshCw, X, ArrowLeft, Search } from 'lucide-react'
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
  const [guards, setGuards]               = useState<Guard[]>([])
  const [messages, setMessages]           = useState<Message[]>([])
  const [selected, setSelected]           = useState<Guard | null>(null)
  const [input, setInput]                 = useState('')
  const [sending, setSending]             = useState(false)
  const [sendError, setSendError]         = useState('')
  const [showBroadcast, setShowBroadcast] = useState(false)
  const [broadcastText, setBroadcastText] = useState('')
  const [broadcastSent, setBroadcastSent] = useState(false)
  const [search, setSearch]               = useState('')
  // On mobile: 'list' shows the sidebar, 'thread' shows the conversation
  const [mobileView, setMobileView]       = useState<'list' | 'thread'>('list')
  const bottomRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLInputElement>(null)

  const loadMessages = () => messagesApi.list().then(setMessages)

  useEffect(() => {
    guardsApi.list().then(setGuards)
    loadMessages()

    let es: EventSource | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let destroyed = false

    const connect = async () => {
      if (destroyed) return
      try {
        const { token } = await messagesApi.streamToken()
        if (destroyed) return
        const base = import.meta.env.VITE_API_URL ?? ''
        es = new EventSource(`${base}/api/messages/stream?token=${token}`)
        es.addEventListener('message', (e: MessageEvent) => {
          const msg: Message = JSON.parse(e.data)
          setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
        })
        es.onerror = () => {
          es?.close()
          es = null
          if (!destroyed) reconnectTimer = setTimeout(connect, 5000)
        }
      } catch {
        if (!destroyed) reconnectTimer = setTimeout(connect, 5000)
      }
    }

    connect()
    return () => {
      destroyed = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      es?.close()
    }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [selected, messages])

  // Focus input when thread opens on mobile
  useEffect(() => {
    if (mobileView === 'thread' && selected) {
      setTimeout(() => inputRef.current?.focus(), 150)
    }
  }, [mobileView, selected])

  const selectGuard = (g: Guard) => {
    setSelected(g)
    setMobileView('thread')
  }

  const goBack = () => {
    setMobileView('list')
  }

  const threadFor = (guardId: number) =>
    messages
      .filter(m => m.from_guard_id === guardId || m.to_guard_id === guardId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  const latestByGuard: Record<number, Message> = {}
  for (const m of messages) {
    const gid = m.from_guard_id != null ? m.from_guard_id : m.to_guard_id
    if (!latestByGuard[gid] || new Date(m.created_at) > new Date(latestByGuard[gid].created_at)) {
      latestByGuard[gid] = m
    }
  }

  const unreadByGuard: Record<number, number> = {}
  for (const m of messages) {
    if (m.from_guard_id != null && !m.read_at) {
      unreadByGuard[m.from_guard_id] = (unreadByGuard[m.from_guard_id] || 0) + 1
    }
  }

  const sortedGuards = [...guards]
    .sort((a, b) => {
      const la = latestByGuard[a.id]?.created_at
      const lb = latestByGuard[b.id]?.created_at
      if (la && lb) return new Date(lb).getTime() - new Date(la).getTime()
      if (la) return -1
      if (lb) return 1
      return 0
    })
    .filter(g =>
      !search.trim() ||
      `${g.first_name} ${g.last_name}`.toLowerCase().includes(search.toLowerCase())
    )

  const send = async () => {
    if (!input.trim() || !selected || sending) return
    setSendError('')
    setSending(true)
    try {
      await messagesApi.send(selected.id, input.trim())
      setInput('')
      await loadMessages()
    } catch (err: any) {
      setSendError(err.response?.data?.error || 'Failed to send — please try again')
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

  // ─── Sidebar (guard list) ──────────────────────────────────────────────────
  const Sidebar = (
    <div className={`
      flex flex-col bg-white
      /* mobile: full screen when on list view */
      absolute inset-0 z-10 transition-transform duration-300
      sm:relative sm:inset-auto sm:z-auto sm:translate-x-0
      sm:w-72 sm:shrink-0 sm:border-r sm:border-gray-200
      ${mobileView === 'list' ? 'translate-x-0' : '-translate-x-full sm:translate-x-0'}
    `}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-white shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-bold text-gray-900 text-base">Messages</h2>
            <p className="text-xs text-gray-400 mt-0.5">{guards.length} officers</p>
          </div>
          <div className="flex gap-1">
            <button
              onClick={loadMessages}
              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw size={15} />
            </button>
            <button
              onClick={() => setShowBroadcast(true)}
              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Broadcast to all"
            >
              <Megaphone size={15} />
            </button>
          </div>
        </div>
        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search officers…"
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
          />
        </div>
      </div>

      {/* Guard list */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
        {sortedGuards.length === 0 && (
          <div className="px-4 py-10 text-center text-gray-400 text-sm">
            {search ? 'No officers match your search' : 'No officers found'}
          </div>
        )}
        {sortedGuards.map(g => {
          const latest = latestByGuard[g.id]
          const unread = unreadByGuard[g.id] || 0
          const isActive = selected?.id === g.id
          return (
            <button
              key={g.id}
              onClick={() => selectGuard(g)}
              className={`w-full text-left px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors ${isActive ? 'bg-blue-50 border-l-4 border-blue-600' : 'border-l-4 border-transparent'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold shrink-0">
                    {g.first_name[0]}{g.last_name[0]}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">{g.first_name} {g.last_name}</div>
                    {latest ? (
                      <div className={`text-xs truncate mt-0.5 ${unread > 0 ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
                        {latest.from_guard_id == null ? 'You: ' : ''}{latest.body}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-300 mt-0.5">No messages yet</div>
                    )}
                  </div>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1.5">
                  {latest && (
                    <div className="text-xs text-gray-300 whitespace-nowrap">
                      {format(new Date(latest.created_at), 'HH:mm')}
                    </div>
                  )}
                  {unread > 0 && (
                    <span className="bg-blue-600 text-white text-xs font-bold rounded-full min-w-[20px] h-5 px-1 flex items-center justify-center">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )

  // ─── Thread panel ──────────────────────────────────────────────────────────
  const Thread = (
    <div className={`
      flex flex-col min-w-0 bg-gray-50
      /* mobile: full screen when on thread view */
      absolute inset-0 z-10 transition-transform duration-300
      sm:relative sm:inset-auto sm:z-auto sm:translate-x-0 sm:flex-1
      ${mobileView === 'thread' ? 'translate-x-0' : 'translate-x-full sm:translate-x-0'}
    `}>
      {!selected ? (
        <div className="flex-1 flex items-center justify-center h-full">
          <div className="text-center text-gray-400 px-6">
            <Send size={40} className="mx-auto mb-4 opacity-20" />
            <div className="font-medium text-gray-500">Select an officer to view messages</div>
            <div className="text-sm mt-1 text-gray-400">or use <strong>Broadcast</strong> to message all officers</div>
          </div>
        </div>
      ) : (
        <>
          {/* Thread header */}
          <div className="px-4 py-3 bg-white border-b border-gray-200 flex items-center gap-3 shrink-0">
            {/* Back button — visible on mobile only */}
            <button
              onClick={goBack}
              className="sm:hidden p-1.5 -ml-1 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold shrink-0">
              {selected.first_name[0]}{selected.last_name[0]}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-gray-900 truncate">{selected.first_name} {selected.last_name}</div>
              <div className="text-xs text-gray-400 truncate">{selected.email}</div>
            </div>
            <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
              selected.status === 'on-duty'  ? 'bg-green-100 text-green-700' :
              selected.status === 'off-duty' ? 'bg-gray-100 text-gray-600' :
              'bg-yellow-100 text-yellow-700'
            }`}>{selected.status}</span>
          </div>

          {/* Messages scroll area */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {thread.length === 0 && (
              <div className="text-center py-16 text-gray-400 text-sm">
                No messages yet — send the first message below
              </div>
            )}
            {thread.map(msg => {
              const fromAdmin = msg.from_guard_id == null
              return (
                <div key={msg.id} className={`flex ${fromAdmin ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] sm:max-w-[75%] rounded-2xl px-4 py-2.5 ${
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
                    <p className={`text-sm leading-relaxed break-words ${fromAdmin ? 'text-white' : 'text-gray-800'}`}>
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

          {/* Error bar */}
          {sendError && (
            <div className="px-4 py-2 bg-red-50 border-t border-red-200 text-red-600 text-xs shrink-0">{sendError}</div>
          )}

          {/* Input bar */}
          <div className="px-3 py-3 bg-white border-t border-gray-200 flex items-center gap-2 shrink-0 safe-area-pb">
            <input
              ref={inputRef}
              className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-0"
              placeholder={`Message ${selected.first_name}…`}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
            />
            <button
              onClick={send}
              disabled={!input.trim() || sending}
              className="w-11 h-11 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 rounded-xl flex items-center justify-center shrink-0 transition-colors"
            >
              <Send size={16} className="text-white" />
            </button>
          </div>
        </>
      )}
    </div>
  )

  return (
    <div className="relative flex h-full overflow-hidden">
      {Sidebar}
      {Thread}

      {/* ── Broadcast modal ──────────────────────────────────────────── */}
      {showBroadcast && (
        <div
          className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          onClick={() => setShowBroadcast(false)}
        >
          <div
            className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-5 sm:p-6 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Megaphone size={18} className="text-blue-600" /> Broadcast Message
              </h3>
              <button onClick={() => setShowBroadcast(false)} className="text-gray-400 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100 transition-colors">
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
                className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={broadcast}
                disabled={!broadcastText.trim() || sending || broadcastSent}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
              >
                {broadcastSent ? '✓ Sent!' : sending ? 'Sending…' : 'Send to All'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
