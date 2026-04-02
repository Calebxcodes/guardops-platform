import { create } from 'zustand'
import { GuardUser } from '../types'

interface AuthState {
  token: string | null
  guard: GuardUser | null
  setAuth: (token: string, guard: GuardUser) => void
  clearAuth: () => void
  updateGuard: (guard: Partial<GuardUser>) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('guard_token'),
  guard: (() => {
    try { return JSON.parse(localStorage.getItem('guard_user') || 'null') } catch { return null }
  })(),
  setAuth: (token, guard) => {
    localStorage.setItem('guard_token', token)
    localStorage.setItem('guard_user', JSON.stringify(guard))
    set({ token, guard })
  },
  clearAuth: () => {
    localStorage.removeItem('guard_token')
    localStorage.removeItem('guard_user')
    set({ token: null, guard: null })
  },
  updateGuard: (partial) => set(state => {
    const updated = { ...state.guard!, ...partial }
    localStorage.setItem('guard_user', JSON.stringify(updated))
    return { guard: updated }
  }),
}))
