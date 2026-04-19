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
  generate: (period_start: string, period_end: string, tax_rate?: number) =>
    api.post('/payroll/generate', { period_start, period_end, tax_rate }).then(r => r.data),
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
  ssoConfig: (): Promise<{ google: boolean; microsoft: boolean }> =>
    api.get('/admin/auth/sso-config').then(r => r.data),
  /** Initiate OAuth — navigates the browser (not a fetch call) */
  ssoRedirect: (provider: 'google' | 'microsoft') => {
    const base = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api'
    window.location.href = `${base}/admin/auth/${provider}`
  },
  twoFaValidate: (partial_token: string, code: string): Promise<{ token: string; admin: any }> =>
    api.post('/admin/auth/2fa/validate', { partial_token, code }).then(r => r.data),
  twoFaStatus: (): Promise<{ enabled: boolean }> =>
    api.get('/admin/auth/2fa/status').then(r => r.data),
  twoFaSetup: (): Promise<{ secret: string; qr_code: string }> =>
    api.post('/admin/auth/2fa/setup').then(r => r.data),
  twoFaConfirm: (code: string): Promise<{ backup_codes: string[] }> =>
    api.post('/admin/auth/2fa/confirm', { code }).then(r => r.data),
  twoFaDisable: (password: string, code: string): Promise<void> =>
    api.post('/admin/auth/2fa/disable', { password, code }).then(r => r.data),
  twoFaRegenerateCodes: (code: string): Promise<{ backup_codes: string[] }> =>
    api.post('/admin/auth/2fa/backup-codes/regenerate', { code }).then(r => r.data),
}

export const messagesApi = {
  list: () => api.get('/messages').then(r => r.data),
  send: (to_guard_id: number, body: string) =>
    api.post('/messages/send', { to_guard_id, body }).then(r => r.data),
  broadcast: (body: string) =>
    api.post('/messages/send', { body, is_broadcast: true }).then(r => r.data),
  streamToken: (): Promise<{ token: string }> =>
    api.post('/messages/stream-token').then(r => r.data),
}

export const checkpointsApi = {
  get: (siteId: number): Promise<{ id: number; name: string; instructions?: string; lat?: number; lng?: number; order_num: number }[]> =>
    api.get(`/sites/${siteId}/checkpoints`).then(r => r.data),
  update: (siteId: number, items: { name: string; instructions?: string }[]) =>
    api.put(`/sites/${siteId}/checkpoints`, items).then(r => r.data),
}

export const checklistApi = {
  get: (siteId: number): Promise<{ id: number; label: string; description?: string; sort_order: number }[]> =>
    api.get(`/sites/${siteId}/checklist`).then(r => r.data),
  update: (siteId: number, items: { label: string; description?: string }[]) =>
    api.put(`/sites/${siteId}/checklist`, items).then(r => r.data),
}

export const analyticsApi = {
  overview:  (p: { from: string; to: string }) => api.get('/analytics/overview',  { params: p }).then(r => r.data),
  revenue:   (p: { from: string; to: string }) => api.get('/analytics/revenue',   { params: p }).then(r => r.data),
  workforce: (p: { from: string; to: string }) => api.get('/analytics/workforce', { params: p }).then(r => r.data),
  sites:     (p: { from: string; to: string }) => api.get('/analytics/sites',     { params: p }).then(r => r.data),
  incidents: (p: { from: string; to: string }) => api.get('/analytics/incidents', { params: p }).then(r => r.data),
}

export const documentsApi = {
  list: (params?: { category?: string; site_id?: number }) =>
    api.get('/documents', { params }).then(r => r.data),
  upload: (formData: FormData) =>
    api.post('/documents', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data),
  update: (id: number, data: { name?: string; category?: string; site_id?: number | null; description?: string; is_guard_visible?: boolean }) =>
    api.patch(`/documents/${id}`, data).then(r => r.data),
  delete: (id: number) => api.delete(`/documents/${id}`).then(r => r.data),
  downloadUrl: (id: number) =>
    `${import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api'}/documents/${id}/download`,
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
