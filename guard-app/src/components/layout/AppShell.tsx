import { Outlet, useNavigate } from 'react-router-dom'
import TabBar from './TabBar'
import { useAuthStore } from '../../store/authStore'
import { useInactivityTimer } from '../../hooks/useInactivityTimer'
import SessionTimeoutModal from '../SessionTimeoutModal'

export default function AppShell() {
  const clearAuth = useAuthStore(s => s.clearAuth)
  const navigate  = useNavigate()

  const handleLogout = () => {
    clearAuth()
    navigate('/login', { replace: true })
  }

  const { showWarning, secondsLeft, stayLoggedIn } = useInactivityTimer({
    onLogout: handleLogout,
    enabled: true,
  })

  return (
    <div className="min-h-screen bg-surface text-white flex flex-col max-w-lg mx-auto relative">
      {showWarning && (
        <SessionTimeoutModal
          secondsLeft={secondsLeft}
          onStay={stayLoggedIn}
          onLogout={handleLogout}
        />
      )}
      <main className="flex-1 pb-20 overflow-y-auto">
        <Outlet />
      </main>
      <TabBar />
    </div>
  )
}
