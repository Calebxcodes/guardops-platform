import { create } from 'zustand'
import { GuardShift } from '../types'

interface ShiftState {
  todayShift: GuardShift | null
  upcomingShifts: GuardShift[]
  isClockingIn: boolean
  setTodayShift: (s: GuardShift | null) => void
  setUpcomingShifts: (s: GuardShift[]) => void
  setIsClockingIn: (v: boolean) => void
}

export const useShiftStore = create<ShiftState>((set) => ({
  todayShift: null,
  upcomingShifts: [],
  isClockingIn: false,
  setTodayShift: s => set({ todayShift: s }),
  setUpcomingShifts: s => set({ upcomingShifts: s }),
  setIsClockingIn: v => set({ isClockingIn: v }),
}))
