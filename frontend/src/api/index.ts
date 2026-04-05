import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api`
    : '/api'
})

// Attach admin token to every request
api.interceptors.request.use(config => {
  const token = localStorage.getItem('admin_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Auto logout on 401
api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('admin_token')
      localStorage.removeItem('admin_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export const guardsApi = {
  list:   ()              => api.get('/guards').then(r => r.data),
  get:    (id: number)    => api.get(`/guards/${id}`).then(r => r.data),
  create: (data: any)     => api.post('/guards', data).then(r => r.data),
  update: (id: number, data: any) => api.put(`/guards/${id}`, data).then(r => r.data),
  delete: (id: number)    => api.delete(`/guards/${id}`).then(r => r.data),
}

export const clientsApi = {
  list:   ()              => api.get('/clients').then(r => r.data),
  get:    (id: number)    => api.get(`/clients/${id}`).then(r => r.data),
  create: (data: any)     => api.post('/clients', data).then(r => r.data),
  update: (id: number, data: any) => api.put(`/clients/${id}`, data).then(r => r.data),
  delete: (id: number)    => api.delete(`/clients/${id}`).then(r => r.data),
}

export const sitesApi = {
  list:   ()              => api.get('/sites').then(r => r.data),
  get:    (id: number)    => api.get(`/sites/${id}`).then(r => r.data),
  create: (data: any)     => api.post('/sites', data).then(r => r.data),
  update: (id: number, data: any) => api.put(`/sites/${id}`, data).then(r => r.data),
  delete: (id: number)    => api.delete(`/sites/${id}`).then(r => r.data),
}

export const shiftsApi = {
  list:   (params?: any)  => api.get('/shifts', { params }).then(r => r.data),
  create: (data: any)     => api.post('/shifts', data).then(r => r.data),
  update: (id: number, data: any) => api.put(`/shifts/${id}`, data).then(r => r.data),
  delete: (id: number)    => api.delete(`/shifts/${id}`).then(r => r.data),
}

export const timesheetsApi = {
  list:        (params?: any)      => api.get('/timesheets', { params }).then(r => r.data),
  get:         (id: number)        => api.get(`/timesheets/${id}`).then(r => r.data),
  create:      (data: any)         => api.post('/timesheets', data).then(r => r.data),
  update:      (id: number, data: any) => api.put(`/timesheets/${id}`, data).then(r => r.data),
  bulkApprove: (ids: number[])     => api.post('/timesheets/bulk-approve', { ids }).then(r => r.data),
}

export const payrollApi = {
  list:     (params?: any)               => api.get('/payroll', { params }).then(r => r.data),
  generate: (period_start: string, period_end: string) =>
    api.post('/payroll/generate', { period_start, period_end }).then(r => r.data),
  update:   (id: number, data: any)      => api.put(`/payroll/${id}`, data).then(r => r.data),
}

export const dashboardApi = {
  metrics:   () => api.get('/dashboard/metrics').then(r => r.data),
  financial: () => api.get('/dashboard/financial').then(r => r.data),
}

export const incidentsApi = {
  list:       (params?: any)    => api.get('/incidents', { params }).then(r => r.data),
  get:        (id: number)      => api.get(`/incidents/${id}`).then(r => r.data),
  create:     (data: any)       => api.post('/incidents', data).then(r => r.data),
  resolve:    (id: number)      => api.put(`/incidents/${id}/resolve`, {}).then(r => r.data),
  generateAI: (id: number)      => api.post(`/ai/incident/${id}`).then(r => r.data),
}

export const complianceApi = {
  sia:   ()              => api.get('/compliance/sia').then(r => r.data),
  audit: (siteId: number) => api.get(`/compliance/audit/${siteId}`).then(r => r.data),
}

export const adminAuthApi = {
  login: (email: string, password: string) =>
    api.post('/admin/auth/login', { email, password }).then(r => r.data),
  me: () => api.get('/admin/auth/me').then(r => r.data),
  forgotPassword: (email: string) =>
    api.post('/admin/auth/forgot-password', { email }).then(r => r.data),
  resetPassword: (token: string, new_password: string) =>
    api.post('/admin/auth/reset-password', { token, new_password }).then(r => r.data),
}

export const portalApi = {
  generate:    (client_id: number, label?: string) =>
    api.post('/portal/generate', { client_id, label }).then(r => r.data),
  listTokens:  (clientId: number) =>
    api.get(`/portal/tokens/${clientId}`).then(r => r.data),
  revokeToken: (tokenId: number) =>
    api.delete(`/portal/tokens/${tokenId}`).then(r => r.data),
  getData:     (token: string) =>
    api.get(`/portal/${token}`).then(r => r.data),
}
