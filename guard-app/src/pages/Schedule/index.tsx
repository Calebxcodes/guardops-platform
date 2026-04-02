import { useEffect, useState } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, addMonths, subMonths } from 'date-fns'
import { ChevronLeft, ChevronRight, Clock, MapPin, PoundSterling } from 'lucide-react'
import { shiftsApi } from '../../api'
import { GuardShift } from '../../types'
import StatusBadge from '../../components/ui/StatusBadge'
import Card from '../../components/ui/Card'

const statusColors: Record<string, string> = {
  assigned: 'bg-blue-400',
  active: 'bg-green-400',
  completed: 'bg-slate-500',
  cancelled: 'bg-red-500',
  unassigned: 'bg-yellow-400',
}

export default function Schedule() {
  const [month, setMonth] = useState(new Date())
  const [shifts, setShifts] = useState<GuardShift[]>([])
  const [selected, setSelected] = useState<Date>(new Date())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    shiftsApi.upcoming().then(data => {
      setShifts(data)
      setLoading(false)
    })
  }, [])

  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) })
  const startDay = startOfMonth(month).getDay()

  const selectedShifts = shifts.filter(s => isSameDay(new Date(s.start_time), selected))

  const estimatePay = (s: GuardShift) => {
    const hrs = (new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / 3600000
    return (hrs * s.hourly_rate).toFixed(2)
  }

  return (
    <div className="min-h-screen bg-surface px-4 pt-14 pb-4 space-y-5">
      <h1 className="text-2xl font-bold text-white">Schedule</h1>

      {/* Month navigation */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setMonth(m => subMonths(m, 1))} className="p-2 text-white/40 hover:text-white">
            <ChevronLeft size={20} />
          </button>
          <h2 className="font-semibold text-white">{format(month, 'MMMM yyyy')}</h2>
          <button onClick={() => setMonth(m => addMonths(m, 1))} className="p-2 text-white/40 hover:text-white">
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-2">
          {['S','M','T','W','T','F','S'].map((d, i) => (
            <div key={i} className="text-center text-white/30 text-xs font-medium py-1">{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: startDay }).map((_, i) => <div key={`empty-${i}`} />)}
          {days.map(day => {
            const dayShifts = shifts.filter(s => isSameDay(new Date(s.start_time), day))
            const isSelected = isSameDay(day, selected)
            return (
              <button
                key={day.toISOString()}
                onClick={() => setSelected(day)}
                className={`relative flex flex-col items-center py-1.5 rounded-xl transition-colors ${
                  isSelected ? 'bg-brand-600' : isToday(day) ? 'bg-brand-900/40 border border-brand-700/30' : 'hover:bg-white/5'
                }`}
              >
                <span className={`text-sm font-medium ${isSelected ? 'text-white' : isToday(day) ? 'text-brand-400' : 'text-white/70'}`}>
                  {format(day, 'd')}
                </span>
                {dayShifts.length > 0 && (
                  <div className="flex gap-0.5 mt-0.5">
                    {dayShifts.slice(0, 2).map(s => (
                      <div key={s.id} className={`w-1.5 h-1.5 rounded-full ${statusColors[s.status] || 'bg-slate-400'}`} />
                    ))}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </Card>

      {/* Selected day shifts */}
      <div>
        <h3 className="font-semibold text-white/60 text-sm mb-3">
          {isToday(selected) ? 'Today' : format(selected, 'EEEE, MMMM d')}
          {selectedShifts.length > 0 ? ` — ${selectedShifts.length} shift${selectedShifts.length > 1 ? 's' : ''}` : ''}
        </h3>

        {loading ? (
          <Card className="p-5 text-center text-white/30">Loading...</Card>
        ) : selectedShifts.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-white/30">No shifts on this day</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {selectedShifts.map(shift => (
              <Card key={shift.id} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-white">{shift.site_name}</h4>
                    <p className="text-white/40 text-sm">{shift.client_name}</p>
                  </div>
                  <StatusBadge status={shift.status} />
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-white/60">
                    <Clock size={14} className="text-brand-400" />
                    {format(new Date(shift.start_time), 'h:mm a')} – {format(new Date(shift.end_time), 'h:mm a')}
                  </div>
                  {shift.site_address && (
                    <div className="flex items-center gap-2 text-white/60">
                      <MapPin size={14} className="text-brand-400" />
                      {shift.site_address}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-white/60">
                    <PoundSterling size={14} className="text-green-400" />
                    Est. £{estimatePay(shift)} · £{shift.hourly_rate}/hr
                  </div>
                </div>

                {shift.post_orders && (
                  <div className="mt-3 pt-3 border-t border-white/5">
                    <p className="text-xs text-white/30 uppercase tracking-wider mb-1">Post Orders</p>
                    <p className="text-white/50 text-sm">{shift.post_orders}</p>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
