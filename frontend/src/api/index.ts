import axios from 'axios'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api' })

export const guardsApi = {
  list: () => api.get('/guards').then(r => r.data),
  get: (id: number) => api.get(`/guards/${id}`).then(r => r.data),
  create: (data: any) => api.post('/guards', data).then(r => r.data),
  update: (id: number, data: any) => api.put(`/guards/${id}`, data).then(r => r.data),
  delete: (id: number) => api.delete(`/guards/${id}`).then(r => r.data),
}

export const clientsApi = {
  list: () => api.get('/clients').then(r => r.data),
  get: (id: number) => api.get(`/clients/${id}`).then(r => r.data),
  create: (data: any) => api.post('/clients', data).then(r => r.data),
  update: (id: number, data: any) => api.put(`/clients/${id}`, data).then(r => r.data),
  delete: (id: number) => api.delete(`/clients/${id}`).then(r => r.data),
}

export const sitesApi = {
  list: () => api.get('/sites').then(r => r.data),
  get: (id: number) => api.get(`/sites/${id}`).then(r => r.data),
  create: (data: any) => api.post('/sites', data).then(r => r.data),
  update: (id: number, data: any) => api.put(`/sites/${id}`, data).then(r => r.data),
  delete: (id: number) => api.delete(`/sites/${id}`).then(r => r.data),
}

export const shiftsApi = {
  list: (params?: any) => api.get('/shifts', { params }).then(r => r.data),
  create: (data: any) => api.post('/shifts', data).then(r => r.data),
  update: (id: number, data: any) => api.put(`/shifts/${id}`, data).then(r => r.data),
  delete: (id: number) => api.delete(`/shifts/${id}`).then(r => r.data),
}

export const timesheetsApi = {
  list: (params?: any) => api.get('/timesheets', { params }).then(r => r.data),
  get: (id: number) => api.get(`/timesheets/${id}`).then(r => r.data),
  create: (data: any) => api.post('/timesheets', data).then(r => r.data),
  update: (id: number, data: any) => api.put(`/timesheets/${id}`, data).then(r => r.data),
  bulkApprove: (ids: number[]) => api.post('/timesheets/bulk-approve', { ids }).then(r => r.data),
}

export const payrollApi = {
  list: () => api.get('/payroll').then(r => r.data),
  generate: (period_start: string, period_end: string) => api.post('/payroll/generate', { period_start, period_end }).then(r => r.data),
  update: (id: number, data: any) => api.put(`/payroll/${id}`, data).then(r => r.data),
}

export const dashboardApi = {
  metrics: () => api.get('/dashboard/metrics').then(r => r.data),
  financial: () => api.get('/dashboard/financial').then(r => r.data),
}

export const incidentsApi = {
  list: () => api.get('/incidents').then(r => r.data),
  create: (data: any) => api.post('/incidents', data).then(r => r.data),
  resolve: (id: number) => api.put(`/incidents/${id}/resolve`, {}).then(r => r.data),
}
