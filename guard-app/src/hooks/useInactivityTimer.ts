import { useEffect, useRef, useState, useCallback } from 'react'

const INACTIVE_MS  = 30 * 60 * 1000  // 30 minutes before warning
const COUNTDOWN_S  = 60               // seconds to respond before logout
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'] as const

interface UseInactivityTimerOptions {
  onLogout: () => void
  enabled: boolean
}

export function useInactivityTimer({ onLogout, enabled }: UseInactivityTimerOptions) {
  const [showWarning, setShowWarning]   = useState(false)
  const [secondsLeft, setSecondsLeft]   = useState(COUNTDOWN_S)
  const inactiveTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearAll = useCallback(() => {
    if (inactiveTimer.current)  clearTimeout(inactiveTimer.current)
    if (countdownTimer.current) clearInterval(countdownTimer.current)
  }, [])

  const startCountdown = useCallback(() => {
    setShowWarning(true)
    setSecondsLeft(COUNTDOWN_S)
    countdownTimer.current = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) {
          clearInterval(countdownTimer.current!)
          setShowWarning(false)
          onLogout()
          return 0
        }
        return s - 1
      })
    }, 1000)
  }, [onLogout])

  const resetTimer = useCallback(() => {
    clearAll()
    setShowWarning(false)
    setSecondsLeft(COUNTDOWN_S)
    inactiveTimer.current = setTimeout(startCountdown, INACTIVE_MS)
  }, [clearAll, startCountdown])

  const stayLoggedIn = useCallback(() => {
    resetTimer()
  }, [resetTimer])

  useEffect(() => {
    if (!enabled) return
    const handler = () => {
      setShowWarning(showing => {
        if (!showing) resetTimer()
        return showing
      })
    }
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, handler, { passive: true }))
    resetTimer()
    return () => {
      clearAll()
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, handler))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  return { showWarning, secondsLeft, stayLoggedIn }
}
