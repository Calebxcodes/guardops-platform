import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  token: string | null
  role: string | null
  name: string | null
  setAuth: (token: string, role: string, name: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      role: null,
      name: null,
      setAuth: (token, role, name) => set({ token, role, name }),
      logout: () => set({ token: null, role: null, name: null }),
    }),
    { name: 'master-admin-auth' }
  )
)
