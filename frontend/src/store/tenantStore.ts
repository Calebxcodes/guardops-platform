import { create } from 'zustand'

export interface TenantInfo {
  id: number
  name: string
  slug: string
}

interface TenantState {
  tenant: TenantInfo | null
  setTenant: (t: TenantInfo | null) => void
}

export const useTenantStore = create<TenantState>(set => ({
  tenant: null,
  setTenant: tenant => set({ tenant }),
}))
