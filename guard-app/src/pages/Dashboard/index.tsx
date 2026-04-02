import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, formatDistanceToNow, isPast, isFuture, differenceInMinutes } from 'date-fns'
import {
  MapPin, Clock, ChevronRight, Bell, AlertTriangle,
  LogIn, LogOut, FileText, MessageCircle, Navigation
} from 'lucide-react'
import { shiftsApi } from '../../api'
import { useAuthStore } from '../../store/authStore'
import { useShiftStore } from '../../store/shiftStore'
import { GuardShift } from '../../types'
import StatusBadge from '../../components/ui/StatusBadge'
import Card from '../../components/ui/Card'
import ClockInModal from './ClockInModal'

export default function Dashboard() {
  const navigate = useNavigate()
  const guard = useAuthStore(s => s.guard)
  const { todayShift, setTodayShift, upcomingShifts, setUpcomingShifts } = useShiftStore()
  const [loading, setLoading] = useState(true)
  const [showClockIn, setShowClockIn] = useState(false)
  const [clockAction, setClockAction] = useState<'in' | 'out'>('in')
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const load = async () => {
      const [today, upcoming] = await Promise.all([shiftsApi.today(), shiftsApi.upcoming()])
      setTodayShift(today)
      setUpcomingShifts(upcoming.slice(0, 5))
      setLoading(false)
    }
    load()
    const ticker = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(ticker)
  }, [])

  const getHour = () => now.getHours()
  const greeting = getHour() < 12 ? 'Good morning' : getHour() < 17 ? 'Good afternoon' : 'Good evening'

  const shiftStarted = todayShift && isPast(new Date(todayShift.start_time))
  const shiftEnded = todayShift && isPast(new Date(todayShift.end_time))
  const minutesUntilShift = todayShift && isFuture(new Date(todayShift.start_time))
    ? differenceInMinutes(new Date(todayShift.start_time), now)
    : null

  const estimatedPay = todayShift
    ? (() => {
        const hrs = (new Date(todayShift.end_time).getTime() - new Date(todayShift.start_time).getTime()) / 3600000
        return (hrs * todayShift.hourly_rate).toFixed(2)
      })()
    : null

  const handleClockPress = (action: 'in' | 'out') => {
    setClockAction(action)
    setShowClockIn(true)
  }

  return (
    <div className="min-h-screen bg-surface px-4 pt-14 pb-4 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white/40 text-sm">{greeting},</p>
          <h1 className="text-xl font-bold text-white">{guard?.first_name} {guard?.last_name}</h1>
        </div>
        <button
          onClick={() => navigate('/messages')}
          className="w-10 h-10 bg-surface-card rounded-full flex items-center justify-center border border-white/5 relative"
        >
          <Bell size={18} className="text-white/60" />
        </button>
      </div>

      {/* Today's Shift Card */}
      {loading ? (
        <Card className="p-5 animate-pulse">
          <div className="h-4 bg-white/5 rounded w-1/2 mb-3" />
          <div className="h-6 bg-white/5 rounded w-3/4 mb-2" />
          <div className="h-4 bg-white/5 rounded w-1/3" />
        </Card>
      ) : todayShift ? (
        <Card className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-white/40 text-xs uppercase tracking-wider mb-1">Today's Shift</p>
              <h2 className="text-lg font-bold text-white leading-tight">{todayShift.site_name}</h2>
              <p className="text-white/50 text-sm">{todayShift.client_name}</p>
            </div>
            <StatusBadge status={todayShift.status} />
          </div>

          {/* Time */}
          <div className="flex items-center gap-2 mb-3">
            <Clock size={15} className="text-brand-400" />
            <span className="text-white font-medium">
              {format(new Date(todayShift.start_time), 'h:mm a')} — {format(new Date(todayShift.end_time), 'h:mm a')}
            </span>
            {estimatedPay && <span className="text-white/40 text-sm ml-auto">£{estimatedPay}</span>}
          </div>

          {/* Address */}
          {todayShift.site_address && (
            <button
              className="flex items-center gap-2 text-brand-400 text-sm mb-4 hover:text-brand-300"
              onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(todayShift.site_address!)}`, '_blank')}
            >
              <MapPin size={14} />
              {todayShift.site_address}
              <ChevronRight size={14} />
            </button>
          )}

          {/* Countdown */}
          {minutesUntilShift !== null && minutesUntilShift > 0 && (
            <div className="bg-brand-900/30 border border-brand-700/30 rounded-xl px-4 py-2.5 mb-4 text-center">
              <p className="text-brand-300 text-sm font-medium">
                Shift starts in {minutesUntilShift > 60
                  ? `${Math.floor(minutesUntilShift / 60)}h ${minutesUntilShift % 60}m`
                  : `${minutesUntilShift}m`}
              </p>
            </div>
          )}

          {todayShift.status === 'active' && (
            <div className="bg-green-900/30 border border-green-700/30 rounded-xl px-4 py-2.5 mb-4 text-center">
              <p className="text-green-300 text-sm font-medium">
                ● On duty — {formatDistanceToNow(new Date(todayShift.start_time))} elapsed
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 mt-1">
            {todayShift.status === 'assigned' && shiftStarted && !shiftEnded && (
              <button
                onClick={() => handleClockPress('in')}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl py-3 flex items-center justify-center gap-2"
              >
                <LogIn size={18} /> Clock In
              </button>
            )}
            {todayShift.status === 'active' && (
              <button
                onClick={() => handleClockPress('out')}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl py-3 flex items-center justify-center gap-2"
              >
                <LogOut size={18} /> Clock Out
              </button>
            )}
            <button
              onClick={() => navigate('/map')}
              className="flex-1 bg-surface-elevated hover:bg-white/10 text-white font-medium rounded-xl py-3 flex items-center justify-center gap-2 border border-white/10"
            >
              <Navigation size={16} /> Map
            </button>
          </div>
        </Card>
      ) : (
        <Card className="p-6 text-center">
          <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-3">
            <Clock size={22} className="text-white/30" />
          </div>
          <p className="text-white/60 font-medium">No shift scheduled today</p>
          <p className="text-white/30 text-sm mt-1">Check your schedule for upcoming shifts</p>
          <button onClick={() => navigate('/schedule')} className="mt-4 text-brand-400 text-sm font-medium">
            View Schedule →
          </button>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { icon: Navigation, label: 'Route', path: '/map', color: 'text-blue-400' },
          { icon: FileText, label: 'Timesheet', path: '/timesheet', color: 'text-green-400' },
          { icon: MessageCircle, label: 'Messages', path: '/messages', color: 'text-purple-400' },
          { icon: AlertTriangle, label: 'Incident', path: '/incidents', color: 'text-red-400' },
        ].map(({ icon: Icon, label, path, color }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className="flex flex-col items-center gap-2 bg-surface-card border border-white/5 rounded-2xl py-3.5 hover:bg-surface-elevated transition-colors"
          >
            <Icon size={22} className={color} />
            <span className="text-white/60 text-xs font-medium">{label}</span>
          </button>
        ))}
      </div>

      {/* Upcoming Shifts */}
      {upcomingShifts.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-white/80">Upcoming Shifts</h3>
            <button onClick={() => navigate('/schedule')} className="text-brand-400 text-sm">See all</button>
          </div>
          <div className="space-y-2">
            {upcomingShifts.slice(0, 3).map(shift => (
              <UpcomingShiftRow key={shift.id} shift={shift} />
            ))}
          </div>
        </div>
      )}

      {showClockIn && todayShift && (
        <ClockInModal
          shift={todayShift}
          action={clockAction}
          onClose={() => setShowClockIn(false)}
          onSuccess={(updatedShift) => { setTodayShift(updatedShift); setShowClockIn(false) }}
        />
      )}
    </div>
  )
}

function UpcomingShiftRow({ shift }: { shift: GuardShift }) {
  return (
    <Card className="px-4 py-3 flex items-center gap-3">
      <div className="w-10 h-10 bg-brand-900/50 rounded-xl flex flex-col items-center justify-center border border-brand-800/50 shrink-0">
        <span className="text-brand-400 text-xs font-bold leading-none">{format(new Date(shift.start_time), 'MMM').toUpperCase()}</span>
        <span className="text-white font-bold text-sm leading-none">{format(new Date(shift.start_time), 'd')}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-white text-sm truncate">{shift.site_name}</p>
        <p className="text-white/40 text-xs">
          {format(new Date(shift.start_time), 'h:mm a')} — {format(new Date(shift.end_time), 'h:mm a')}
        </p>
      </div>
      <StatusBadge status={shift.status} />
    </Card>
  )
}
