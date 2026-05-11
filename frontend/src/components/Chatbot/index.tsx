import { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send, ThumbsUp, ThumbsDown, Headphones } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { chatbotService, type ChatMessage } from '../../services/chatbotService'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  feedback?: 'helpful' | 'unhelpful' | null
}

export function Chatbot() {
  const { token } = useAuthStore()
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [msgCount, setMsgCount] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Check if chatbot is enabled for this tenant
  useEffect(() => {
    if (!token) return
    const apiBase = import.meta.env.VITE_API_URL
      ? `${import.meta.env.VITE_API_URL}/api`
      : '/api'
    fetch(`${apiBase}/feature-flags`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(flags => setEnabled(flags.chatbot_enabled === true))
      .catch(() => setEnabled(false))
  }, [token])

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isOpen])

  useEffect(() => {
    if (isOpen) inputRef.current?.focus()
  }, [isOpen])

  if (!enabled) return null

  const handleOpen = () => {
    if (messages.length === 0) {
      setMessages([{
        id: 'greeting',
        role: 'assistant',
        content: "Hi! I'm **Strondis Assistant**. How can I help?\n\nTry asking about: **Shifts** · **Payroll** · **Guards** · **Timesheets**",
        feedback: null,
      }])
    }
    setIsOpen(true)
  }

  const handleClose = () => setIsOpen(false)

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || loading) return

    if (msgCount >= 100) {
      setError('Daily message limit reached (100). Please try again tomorrow.')
      return
    }

    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: text, feedback: null }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    setError('')
    setMsgCount(c => c + 1)

    const history: ChatMessage[] = messages.map(m => ({ role: m.role, content: m.content }))

    try {
      const response = await chatbotService.sendMessage(text, history)
      const botMsg: Message = {
        id: `b-${Date.now()}`,
        role: 'assistant',
        content: response.content,
        feedback: null,
      }
      setMessages(prev => [...prev, botMsg])
    } catch {
      setError('Failed to get response. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleFeedback = (messageId: string, feedback: 'helpful' | 'unhelpful') => {
    chatbotService.logFeedback(messageId, feedback)
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, feedback } : m))
  }

  const handleEscalate = async () => {
    // Try Crisp first, then fallback to support ticket
    const w = window as any
    if (w.$crisp) {
      w.$crisp.push(['do', 'chat:open'])
      return
    }
    try {
      const history: ChatMessage[] = messages.map(m => ({ role: m.role, content: m.content }))
      await chatbotService.escalate(history)
      setMessages(prev => [...prev, {
        id: `esc-${Date.now()}`,
        role: 'assistant',
        content: 'A support ticket has been created. Our team will respond within 24 hours. You can also email **support@strondis.com**.',
        feedback: null,
      }])
    } catch {
      setError('Failed to create support ticket. Please email support@strondis.com.')
    }
  }

  // Simple markdown renderer: bold (**text**) and line breaks
  function renderContent(content: string) {
    const parts = content.split(/(\*\*[^*]+\*\*)/g)
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>
      }
      return <span key={i}>{part}</span>
    })
  }

  if (!isOpen) {
    return (
      <button
        onClick={handleOpen}
        className="fixed bottom-6 right-6 bg-blue-600 text-white p-3.5 rounded-full shadow-lg hover:bg-blue-700 active:scale-95 transition-all z-40"
        aria-label="Open Strondis Assistant"
        title="Strondis Assistant"
      >
        <MessageCircle size={22} />
      </button>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 w-96 h-[580px] bg-white rounded-2xl shadow-2xl flex flex-col z-50 border border-gray-200">
      {/* Header */}
      <div className="bg-blue-600 text-white px-4 py-3 rounded-t-2xl flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <MessageCircle size={18} />
          <span className="font-semibold text-sm">Strondis Assistant</span>
        </div>
        <button onClick={handleClose} className="hover:bg-blue-700 p-1 rounded-lg transition-colors" aria-label="Close">
          <X size={18} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map(msg => (
          <div key={msg.id} className="space-y-1">
            <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : 'bg-gray-100 text-gray-900 rounded-bl-sm'
              }`}>
                {msg.content.split('\n').map((line, i) => (
                  <p key={i} className={i > 0 ? 'mt-1' : ''}>{renderContent(line)}</p>
                ))}
              </div>
            </div>

            {/* Feedback buttons — assistant messages only */}
            {msg.role === 'assistant' && msg.id !== 'greeting' && (
              <div className="flex items-center gap-2 pl-1">
                {msg.feedback ? (
                  <span className="text-xs text-gray-400">
                    {msg.feedback === 'helpful' ? '👍 Helpful' : '👎 Not helpful'}
                  </span>
                ) : (
                  <>
                    <button
                      onClick={() => handleFeedback(msg.id, 'helpful')}
                      className="text-gray-400 hover:text-green-600 transition-colors p-0.5"
                      title="Helpful"
                    >
                      <ThumbsUp size={13} />
                    </button>
                    <button
                      onClick={() => handleFeedback(msg.id, 'unhelpful')}
                      className="text-gray-400 hover:text-red-500 transition-colors p-0.5"
                      title="Not helpful"
                    >
                      <ThumbsDown size={13} />
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div className="flex items-center gap-1.5 pl-1">
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
          </div>
        )}

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-gray-100 px-4 py-3 space-y-2">
        <form onSubmit={handleSend} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask me anything..."
            disabled={loading}
            className="flex-1 text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            aria-label="Send"
          >
            <Send size={16} />
          </button>
        </form>
        <button
          type="button"
          onClick={handleEscalate}
          className="w-full flex items-center justify-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 transition-colors py-0.5"
        >
          <Headphones size={12} />
          Talk to Support
        </button>
      </div>
    </div>
  )
}

export default Chatbot
