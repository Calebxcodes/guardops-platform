import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import TabBar from './TabBar'
import { useAuthStore } from '../../store/authStore'
import { useInactivityTimer } from '../../hooks/useInactivityTimer'
import { useOfflineSync } from '../../hooks/useOfflineSync'
import SessionTimeoutModal from '../SessionTimeoutModal'
import {
  WifiOff, RefreshCw, ChevronDown, ChevronUp,
  LogIn, LogOut, ClipboardCheck, MapPin, AlertTriangle, MessageSquare, LucideIcon
} from 'lucide-react'

const TYPE_META: Record<string, { icon: LucideIcon; color: string }> = {
  'clock-in':        { icon: LogIn,          color: 'text-green-400' },
  'clock-out':       { icon: LogOut,         color: 'text-red-400'   },
  'check':           { icon: ClipboardCheck, color: 'text-brand-400' },
  'checkpoint-scan': { icon: MapPin,         color: 'text-blue-400'  },
  'incident':        { icon: AlertTriangle,  color: 'text-orange-400'},
  'message':         { icon: MessageSquare,  color: 'text-purple-400'},
}

export default function AppShell() {
  const clearAuth = useAuthStore(s => s.clearAuth)
  const navigate  = useNavigate()
  const [expanded, setExpanded] = useState(false)

  const handleLogout = () => {
    clearAuth()
    navigate('/login', { replace: true })
  }

  const { showWarning, secondsLeft, stayLoggedIn } = useInactivityTimer({
    onLogout: handleLogout,
    enabled: true,
  })

  const { isOnline, pendingCount, pendingItems, syncing } = useOfflineSync()

  const showBanner = !isOnline || syncing || pendingCount > 0

  const bannerBg = !isOnline
    ? 'bg-red-900/90 backdrop-blur-sm'
    : syncing
      ? 'bg-yellow-800/90 backdrop-blur-sm'
      : 'bg-surface-elevated/90 backdrop-blur-sm border-b border-white/10'

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
      {showBanner && (
        <div className={`fixed top-0 inset-x-0 z-40 max-w-lg mx-auto ${bannerBg}`}>
          {/* Summary row */}
          <button
            className="w-full px-4 py-2 flex items-center gap-2 text-xs font-medium"
            onClick={() => pendingCount > 0 && setExpanded(v => !v)}
          >
            {!isOnline ? (
              <>
                <WifiOff size={13} className="shrink-0 text-red-300" />
                <span className="text-red-200">No connection — actions will sync when back online</span>
                {pendingCount > 0 && (
                  <span className="ml-auto bg-white/20 text-white rounded px-1.5 py-0.5 shrink-0">
                    {pendingCount} pending
                  </span>
                )}
              </>
            ) : syncing ? (
              <>
                <RefreshCw size={13} className="animate-spin shrink-0 text-yellow-300" />
                <span className="text-yellow-200">Syncing {pendingCount} queued action{pendingCount !== 1 ? 's' : ''}…</span>
              </>
            ) : (
              <>
                <RefreshCw size={13} className="shrink-0 text-white/60" />
                <span className="text-white/70">{pendingCount} action{pendingCount !== 1 ? 's' : ''} pending sync</span>
              </>
            )}
            {pendingCount > 0 && (
              <span className="ml-auto text-white/50 shrink-0">
                {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </span>
            )}
          </button>

          {/* Expanded queue list */}
          {expanded && pendingItems.length > 0 && (
            <div className="px-4 pb-3 pt-1 space-y-1.5 border-t border-white/10">
              {pendingItems.map(item => {
                const meta = TYPE_META[item.type] ?? { icon: RefreshCw, color: 'text-white/40' }
                const Icon = meta.icon
                return (
                  <div key={item.id} className="flex items-center gap-2.5 text-xs">
                    <Icon size={12} className={`${meta.color} shrink-0`} />
                    <span className="flex-1 text-white/70 truncate">{item.label}</span>
                    <span className="text-white/30 shrink-0 tabular-nums">
                      {new Date(item.enqueuedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )
              })}
            </div>
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
