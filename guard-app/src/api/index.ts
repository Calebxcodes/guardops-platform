import axios from 'axios'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api' })

// Attach auth token to every request
api.interceptors.request.use(config => {
  const token = localStorage.getItem('guard_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Auto logout on 401
api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('guard_token')
      localStorage.removeItem('guard_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export const authApi = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }).then(r => r.data),
  me: () => api.get('/auth/me').then(r => r.data),
  changePassword: (current_password: string, new_password: string) =>
    api.post('/auth/change-password', { current_password, new_password }).then(r => r.data),
}

export const shiftsApi = {
  today: () => api.get('/guard/shifts/today').then(r => r.data),
  upcoming: () => api.get('/guard/shifts/upcoming').then(r => r.data),
  history: () => api.get('/guard/shifts/history').then(r => r.data),
  clockIn: (data: { shift_id: number; lat?: number; lng?: number; accuracy?: number; notes?: string }) =>
    api.post('/guard/shifts/clock-in', data).then(r => r.data),
  clockOut: (data: { shift_id: number; lat?: number; lng?: number; accuracy?: number; notes?: string }) =>
    api.post('/guard/shifts/clock-out', data).then(r => r.data),
  clockEvents: (shiftId: number) => api.get(`/guard/shifts/${shiftId}/clock-events`).then(r => r.data),
}

export const timesheetsApi = {
  list: () => api.get('/guard/timesheets').then(r => r.data),
  get: (id: number) => api.get(`/guard/timesheets/${id}`).then(r => r.data),
  submit: (id: number, data: any) => api.put(`/guard/timesheets/${id}/submit`, data).then(r => r.data),
  manual: (data: any) => api.post('/guard/timesheets/manual', data).then(r => r.data),
}

export const messagesApi = {
  list: () => api.get('/guard/messages').then(r => r.data),
  send: (body: string) => api.post('/guard/messages', { body }).then(r => r.data),
  emergency: (message: string, lat?: number, lng?: number) =>
    api.post('/guard/messages/emergency', { message, lat, lng }).then(r => r.data),
  unread: () => api.get('/guard/messages/unread').then(r => r.data),
  markRead: (id: number) => api.put(`/guard/messages/${id}/read`, {}).then(r => r.data),
}

export const profileApi = {
  get: () => api.get('/guard/profile').then(r => r.data),
  update: (data: any) => api.put('/guard/profile', data).then(r => r.data),
  payHistory: () => api.get('/guard/profile/pay-history').then(r => r.data),
  incidents: () => api.get('/guard/profile/incidents').then(r => r.data),
  reportIncident: (data: any) => api.post('/guard/profile/incidents', data).then(r => r.data),
}
