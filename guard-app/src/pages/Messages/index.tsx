import { useEffect, useState, useRef } from 'react'
import { Send, AlertTriangle, ShieldAlert } from 'lucide-react'
import { messagesApi } from '../../api'
import { useAuthStore } from '../../store/authStore'
import { Message } from '../../types'
import { format } from 'date-fns'
import BottomSheet from '../../components/ui/BottomSheet'

export default function Messages() {
  const guard = useAuthStore(s => s.guard)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [showEmergency, setShowEmergency] = useState(false)
  const [emergencyMsg, setEmergencyMsg] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const load = () => messagesApi.list().then(data => { setMessages(data); setLoading(false) })

  useEffect(() => { load(); const iv = setInterval(load, 15000); return () => clearInterval(iv) }, [])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const send = async () => {
    if (!input.trim()) return
    setSending(true)
    try {
      await messagesApi.send(input.trim())
      setInput('')
      load()
    } finally { setSending(false) }
  }

  const sendEmergency = async () => {
    let lat: number | undefined, lng: number | undefined
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })
      )
      lat = pos.coords.latitude; lng = pos.coords.longitude
    } catch {}
    await messagesApi.emergency(emergencyMsg, lat, lng)
    setShowEmergency(false)
    setEmergencyMsg('')
    load()
  }

  const isFromMe = (msg: Message) => msg.from_guard_id === guard?.id

  return (
    <div className="flex flex-col h-screen bg-surface">
      {/* Header */}
      <div className="px-4 pt-14 pb-3 border-b border-white/5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Messages</h1>
          <p className="text-white/30 text-xs">Manager & Supervisor</p>
        </div>
        <button
          onClick={() => setShowEmergency(true)}
          className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-xl text-sm font-semibold"
        >
          <ShieldAlert size={16} /> SOS
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-32">
        {loading ? (
          <p className="text-white/20 text-center py-8">Loading...</p>
        ) : messages.length === 0 ? (
          <p className="text-white/20 text-center py-12">No messages yet</p>
        ) : messages.map(msg => (
          <div key={msg.id} className={`flex ${isFromMe(msg) ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
              msg.is_emergency ? 'bg-red-600/20 border border-red-500/30' :
              isFromMe(msg) ? 'bg-brand-600' : 'bg-surface-card border border-white/5'
            }`}>
              {!isFromMe(msg) && (
                <p className="text-white/40 text-xs mb-1">Manager</p>
              )}
              {msg.is_emergency && (
                <div className="flex items-center gap-1 text-red-400 text-xs mb-1">
                  <AlertTriangle size={12} /> Emergency Alert
                </div>
              )}
              <p className="text-white text-sm leading-relaxed">{msg.body}</p>
              <p className="text-white/30 text-xs mt-1 text-right">
                {format(new Date(msg.created_at), 'h:mm a')}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="fixed bottom-16 left-0 right-0 max-w-lg mx-auto px-4 pb-3 bg-surface border-t border-white/5 pt-3">
        <div className="flex items-center gap-2">
          <input
            className="flex-1 bg-surface-card border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-brand-500 text-sm"
            placeholder="Message manager..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
          />
          <button
            onClick={send}
            disabled={!input.trim() || sending}
            className="w-11 h-11 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 rounded-xl flex items-center justify-center shrink-0"
          >
            <Send size={18} />
          </button>
        </div>
      </div>

      {/* Emergency sheet */}
      {showEmergency && (
        <BottomSheet title="🚨 Emergency Alert" onClose={() => setShowEmergency(false)}>
          <div className="space-y-4">
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
              <ShieldAlert size={32} className="text-red-400 mx-auto mb-2" />
              <p className="text-red-300 font-semibold">Send Emergency Alert</p>
              <p className="text-white/40 text-sm mt-1">Your manager will be notified immediately with your location</p>
            </div>
            <div>
              <label className="block text-white/40 text-xs mb-1.5">Describe the emergency (optional)</label>
              <textarea
                rows={3}
                className="w-full bg-surface rounded-xl px-3 py-2.5 text-white text-sm border border-white/10 focus:outline-none focus:border-red-500 resize-none"
                placeholder="Need immediate assistance at..."
                value={emergencyMsg}
                onChange={e => setEmergencyMsg(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowEmergency(false)} className="flex-1 py-3.5 rounded-xl border border-white/10 text-white/60 font-medium">Cancel</button>
              <button onClick={sendEmergency} className="flex-1 py-3.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold">
                🚨 Send Alert
              </button>
            </div>
          </div>
        </BottomSheet>
      )}
    </div>
  )
}
