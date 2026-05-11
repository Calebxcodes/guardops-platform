import { create } from 'zustand'

export type RoleType = 'owner' | 'manager' | 'scheduler' | 'payroll_manager' | 'viewer'

export interface Admin {
  id: number
  name: string
  email: string
  role: RoleType
  tenantId?: number | null
}

interface AuthState {
  token: string | null
  admin: Admin | null
  setAuth: (token: string, admin: Admin) => void
  logout: () => void
}

const stored = localStorage.getItem('admin_token')
const storedAdmin = localStorage.getItem('admin_user')

export const useAuthStore = create<AuthState>((set) => ({
  token: stored || null,
  admin: storedAdmin ? JSON.parse(storedAdmin) : null,

  setAuth: (token, admin) => {
    localStorage.setItem('admin_token', token)
    localStorage.setItem('admin_user', JSON.stringify(admin))
    set({ token, admin })
  },

  logout: () => {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_user')
    set({ token: null, admin: null })
  },
}))
