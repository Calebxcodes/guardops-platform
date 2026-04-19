import { Outlet, useNavigate } from 'react-router-dom'
import TabBar from './TabBar'
import { useAuthStore } from '../../store/authStore'
import { useInactivityTimer } from '../../hooks/useInactivityTimer'
import { useOfflineSync } from '../../hooks/useOfflineSync'
import SessionTimeoutModal from '../SessionTimeoutModal'
import { WifiOff, RefreshCw } from 'lucide-react'

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

  const { isOnline, pendingCount, syncing } = useOfflineSync()

  return (
    <div className="min-h-screen bg-surface text-white flex flex-col max-w-lg mx-auto relative">
      {showWarning && (
        <SessionTimeoutModal
          secondsLeft={secondsLeft}
          onStay={stayLoggedIn}
          onLogout={handleLogout}
        />
      )}

      {/* Offline / sync banner */}
      {(!isOnline || syncing || pendingCount > 0) && (
        <div className={`fixed top-0 inset-x-0 z-40 max-w-lg mx-auto px-4 py-2 flex items-center gap-2 text-xs font-medium ${
          !isOnline ? 'bg-red-800/90' : syncing ? 'bg-yellow-700/90' : 'bg-green-800/90'
        }`}>
          {!isOnline ? (
            <>
              <WifiOff size={13} />
              <span>No connection — actions will sync when back online</span>
              {pendingCount > 0 && <span className="ml-auto bg-white/20 rounded px-1.5 py-0.5">{pendingCount} pending</span>}
            </>
          ) : syncing ? (
            <>
              <RefreshCw size={13} className="animate-spin" />
              <span>Syncing {pendingCount} queued action{pendingCount !== 1 ? 's' : ''}…</span>
            </>
          ) : (
            <>
              <RefreshCw size={13} />
              <span>{pendingCount} action{pendingCount !== 1 ? 's' : ''} pending sync</span>
            </>
          )}
        </div>
      )}

      <main className="flex-1 pb-20 overflow-y-auto">
        <Outlet />
      </main>
      <TabBar />
    </div>
  )
}
