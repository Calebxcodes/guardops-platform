import { useEffect, useState, useCallback } from 'react'
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns'
import { Download, List, Calendar, Clock, MapPin, PoundSterling, ChevronLeft, ChevronRight } from 'lucide-react'
import { shiftsApi } from '../../api'
import Card from '../../components/ui/Card'
import StatusBadge from '../../components/ui/StatusBadge'
import { formatLondon12, isSameLondonDay, formatLondon } from '../../utils/time'

type Shift = {
  id: number
  start_time: string
  end_time: string
  actual_end_time?: string
  site_name: string
  client_name: string
  status: string
  hours_worked?: number | string
  effective_rate?: number | string
  auto_clocked_out?: number | boolean
}

function fmtDate(d: string | number | Date) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', day: '2-digit', month: 'short', year: 'numeric',
  }).format(new Date(d))
}

export default function History() {
  const today       = format(new Date(), 'yyyy-MM-dd')
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 29), 'yyyy-MM-dd'))
  const [endDate,   setEndDate]   = useState(today)
  const [shifts,    setShifts]    = useState<Shift[]>([])
  const [loading,   setLoading]   = useState(true)
  const [view,      setView]      = useState<'list' | 'calendar'>('list')
  const [calMonth,  setCalMonth]  = useState(new Date())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await shiftsApi.history(startDate, endDate)
      setShifts(Array.isArray(data) ? data : [])
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate])

  useEffect(() => { load() }, [load])

  const setPreset = (days: number) => {
    setStartDate(format(subDays(new Date(), days - 1), 'yyyy-MM-dd'))
    setEndDate(today)
  }

  const totalHours = shifts.reduce((sum, s) => sum + parseFloat(String(s.hours_worked || 0)), 0)
  const totalPay   = shifts.reduce((sum, s) => {
    const hrs  = parseFloat(String(s.hours_worked || 0))
    const rate = parseFloat(String(s.effective_rate || 0))
    return sum + hrs * rate
  }, 0)

  // Calendar helpers — week starts Monday (UK convention). getDay() returns 0=Sun…6=Sat;
  // shift so Mon=0, …, Sun=6
  const days = eachDayOfInterval({ start: startOfMonth(calMonth), end: endOfMonth(calMonth) })
  const startDay = (startOfMonth(calMonth).getDay() + 6) % 7

  return (
    <div className="min-h-screen bg-surface px-4 pt-14 pb-24 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Shift History</h1>
        <button
          onClick={() => shiftsApi.historyExportCsv(startDate, endDate)}
          className="flex items-center gap-1.5 text-sm bg-white/10 hover:bg-white/15 text-white px-3 py-1.5 rounded-xl transition-colors"
        >
          <Download size={14} /> CSV
        </button>
      </div>

      {/* Date controls */}
      <Card className="p-4 space-y-3">
        <div className="flex gap-2 flex-wrap">
          {[
            { label: '30d', days: 30 },
            { label: '90d', days: 90 },
            { label: '1yr', days: 365 },
          ].map(({ label, days }) => (
            <button
              key={label}
              onClick={() => setPreset(days)}
              className="text-xs bg-white/10 hover:bg-white/15 text-white/80 px-3 py-1 rounded-lg transition-colors"
            >
              Last {label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-white/40 mb-1 block">From</label>
            <input
              type="date" value={startDate} max={endDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-500"
            />
          </div>
          <div>
            <label className="text-xs text-white/40 mb-1 block">To</label>
            <input
              type="date" value={endDate} min={startDate} max={today}
              onChange={e => setEndDate(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-500"
            />
          </div>
        </div>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Shifts', val: shifts.length },
          { label: 'Hours', val: totalHours.toFixed(1) },
          { label: 'Est. Pay', val: `£${totalPay.toFixed(0)}` },
        ].map(({ label, val }) => (
          <Card key={label} className="p-3 text-center">
            <div className="text-lg font-bold text-white">{val}</div>
            <div className="text-xs text-white/40">{label}</div>
          </Card>
        ))}
      </div>

      {/* View toggle */}
      <div className="flex gap-2">
        {(['list', 'calendar'] as const).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              view === v ? 'bg-brand-600 text-white' : 'bg-white/5 text-white/50 hover:bg-white/10'
            }`}
          >
            {v === 'list' ? <List size={14} /> : <Calendar size={14} />}
            {v.charAt(0).toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <Card className="p-8 text-center text-white/30">Loading...</Card>
      ) : shifts.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-white/30">No shifts in selected range</p>
        </Card>
      ) : view === 'list' ? (
        <div className="space-y-2">
          {shifts.map(shift => {
            const hrs  = parseFloat(String(shift.hours_worked || 0)).toFixed(2)
            const rate = parseFloat(String(shift.effective_rate || 0))
            const pay  = (parseFloat(hrs) * rate).toFixed(2)
            return (
              <Card key={shift.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-white text-sm">{shift.site_name}</p>
                    <p className="text-white/40 text-xs">{shift.client_name}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {shift.auto_clocked_out ? (
                      <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">Auto</span>
                    ) : null}
                    <StatusBadge status={shift.status} />
                  </div>
                </div>
                <div className="text-xs text-white/40">{fmtDate(shift.start_time)}</div>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <div className="flex items-center gap-1 text-xs text-white/60">
                    <Clock size={11} className="text-brand-400" />
                    {formatLondon12(shift.start_time)} – {formatLondon12(shift.actual_end_time || shift.end_time)}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-white/60">
                    <PoundSterling size={11} className="text-green-400" />
                    {hrs}h · £{pay}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      ) : (
        /* Calendar view */
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => setCalMonth(m => { const d = new Date(m); d.setMonth(d.getMonth() - 1); return d })} className="p-1.5 text-white/40 hover:text-white">
              <ChevronLeft size={18} />
            </button>
            <span className="font-semibold text-white text-sm">{format(calMonth, 'MMMM yyyy')}</span>
            <button onClick={() => setCalMonth(m => { const d = new Date(m); d.setMonth(d.getMonth() + 1); return d })} className="p-1.5 text-white/40 hover:text-white">
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="grid grid-cols-7 mb-1">
            {['M','T','W','T','F','S','S'].map((d, i) => (
              <div key={i} className="text-center text-white/30 text-xs py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: startDay }).map((_, i) => <div key={`e-${i}`} />)}
            {days.map(day => {
              const dayShifts = shifts.filter(s => isSameLondonDay(s.start_time, day))
              const hrs = dayShifts.reduce((sum, s) => sum + parseFloat(String(s.hours_worked || 0)), 0)
              return (
                <div
                  key={day.toISOString()}
                  className={`flex flex-col items-center py-1.5 rounded-xl ${dayShifts.length > 0 ? 'bg-brand-600/30 border border-brand-600/40' : ''}`}
                >
                  <span className={`text-xs font-medium ${dayShifts.length > 0 ? 'text-brand-300' : 'text-white/50'}`}>
                    {format(day, 'd')}
                  </span>
                  {hrs > 0 && <span className="text-[9px] text-brand-400 mt-0.5">{hrs.toFixed(0)}h</span>}
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}
