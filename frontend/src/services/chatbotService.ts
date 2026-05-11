import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api`
    : '/api',
})

api.interceptors.request.use(config => {
  const token = localStorage.getItem('admin_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatbotResponse {
  content: string
  outOfScope: boolean
}

export interface KBItem {
  id: number
  title: string
  content: string
  category: string
}

class ChatbotService {
  async sendMessage(message: string, history: ChatMessage[]): Promise<ChatbotResponse> {
    const { data } = await api.post('/chatbot/message', {
      message,
      history: history.slice(-50).map(m => ({ role: m.role, content: m.content })),
    })
    return { content: data.content, outOfScope: data.outOfScope ?? false }
  }

  async logFeedback(messageId: string, feedback: 'helpful' | 'unhelpful'): Promise<void> {
    try {
      await api.post('/chatbot/feedback', { messageId, feedback })
    } catch { /* non-critical */ }
  }

  async escalate(messages: ChatMessage[]): Promise<void> {
    await api.post('/chatbot/escalate', {
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    })
  }

  async getKBItems(): Promise<KBItem[]> {
    const { data } = await api.get('/chatbot/kb')
    return data.items ?? []
  }

  async updateKBItem(id: number, updates: Partial<Pick<KBItem, 'title' | 'content'>>): Promise<void> {
    await api.put(`/chatbot/kb/${id}`, updates)
  }

  async addKBItem(item: Omit<KBItem, 'id'>): Promise<number> {
    const { data } = await api.post('/chatbot/kb', item)
    return data.id
  }

  async deleteKBItem(id: number): Promise<void> {
    await api.delete(`/chatbot/kb/${id}`)
  }
}

export const chatbotService = new ChatbotService()
