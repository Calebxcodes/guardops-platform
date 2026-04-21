import axios from 'axios'
import { useAuthStore } from '../store/authStore'

const BASE = import.meta.env.VITE_API_URL ?? ''

const http = axios.create({ baseURL: `${BASE}/api/master-admin` })

http.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

http.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ── Auth ──────────────────────────────────────────────────────────────────────
export const login = (email: string, password: string) =>
  http.post<{ token: string; role: string; name: string }>('/auth/login', { email, password }).then(r => r.data)

export const getMe = () =>
  http.get<{ id: number; name: string; email: string; role: string }>('/auth/me').then(r => r.data)

// ── Tenants ───────────────────────────────────────────────────────────────────
export interface Tenant {
  id: number
  slug: string
  name: string
  email: string
  status: string
  tier: string
  max_guards: number
  guard_count: number
  subscription_status: string | null
  trial_ends_at: number | null
  plan_code: string | null
  failed_payments: number
  created_at: number
}

export const getTenants = (params?: { status?: string; tier?: string; search?: string }) =>
  http.get<Tenant[]>('/tenants', { params }).then(r => r.data)

export const getTenant = (id: number) =>
  http.get<Tenant>(`/tenants/${id}`).then(r => r.data)

export const pauseTenant = (id: number, reason: string) =>
  http.post(`/tenants/${id}/pause`, { reason }).then(r => r.data)

export const resumeTenant = (id: number) =>
  http.post(`/tenants/${id}/resume`).then(r => r.data)

export const cancelTenant = (id: number, reason: string) =>
  http.post(`/tenants/${id}/cancel`, { reason }).then(r => r.data)

export const extendTrial = (id: number, days: number) =>
  http.post(`/tenants/${id}/extend-trial`, { days }).then(r => r.data)

// ── Payments ──────────────────────────────────────────────────────────────────
export interface Payment {
  id: number
  tenant_id: number
  tenant_name: string
  slug: string
  stripe_invoice_id: string
  amount_cents: number
  currency: string
  status: string
  retry_count: number
  attempted_at: number
  succeeded_at: number | null
  failed_at: number | null
}

export interface Subscription {
  id: number
  tenant_id: number
  tenant_name: string
  tenant_email: string
  slug: string
  plan_code: string
  price_monthly_cents: number
  status: string
  trial_ends_at: number | null
  stripe_subscription_id: string | null
}

export interface RevenueStats {
  total_collected_cents: number
  successful_payments: number
  failed_payments: number
  refunded_payments: number
  total_refunded_cents: number
}

export const getSubscriptions = () =>
  http.get<Subscription[]>('/subscriptions').then(r => r.data)

export const getPayments = (params?: { status?: string; tenant_id?: number }) =>
  http.get<Payment[]>('/payments', { params }).then(r => r.data)

export const getRevenue = () =>
  http.get<RevenueStats>('/revenue').then(r => r.data)

export const refundPayment = (id: number, amount_cents?: number) =>
  http.post(`/payments/${id}/refund`, { amount_cents }).then(r => r.data)

export const retryPayment = (id: number) =>
  http.post(`/payments/${id}/retry`).then(r => r.data)

// ── Users ─────────────────────────────────────────────────────────────────────
export interface MasterAdmin {
  id: number
  name: string
  email: string
  role: string
  created_at: number
}

export const getUsers = () =>
  http.get<MasterAdmin[]>('/users').then(r => r.data)

export const createUser = (data: { name: string; email: string; password: string; role: string }) =>
  http.post<MasterAdmin>('/users', data).then(r => r.data)

export const updateUserRole = (id: number, role: string) =>
  http.patch(`/users/${id}/role`, { role }).then(r => r.data)

export const deleteUser = (id: number) =>
  http.delete(`/users/${id}`).then(r => r.data)

// ── Audit logs ────────────────────────────────────────────────────────────────
export const getAuditLogs = (params?: { action?: string; target_type?: string; tenant_id?: number; limit?: number; offset?: number }) =>
  http.get<any[]>('/audit-logs', { params }).then(r => r.data)

// ── Feature flags ─────────────────────────────────────────────────────────────
export interface FeatureFlags {
  stripe_payments_enabled: boolean
  multi_tenancy_enabled: boolean
  onboarding_videos_enabled: boolean
  websocket_messaging_enabled: boolean
  geofencing_alerts_enabled: boolean
  api_v2_enabled: boolean
}

export const getGlobalFlags = () =>
  http.get<FeatureFlags>('/flags/global').then(r => r.data)

export const getAllTenantFlags = () =>
  http.get<{ tenant_id: number; tenant_name: string; slug: string; flags: FeatureFlags }[]>('/flags').then(r => r.data)

export const getTenantFlags = (tenantId: number) =>
  http.get<FeatureFlags>(`/flags/tenant/${tenantId}`).then(r => r.data)

export const setTenantFlag = (tenantId: number, flag: string, enabled: boolean) =>
  http.post(`/flags/tenant/${tenantId}/${flag}`, { enabled }).then(r => r.data)

export const setGlobalFlag = (flag: string, enabled: boolean) =>
  http.post(`/flags/global/${flag}`, { enabled }).then(r => r.data)
