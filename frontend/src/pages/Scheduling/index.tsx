import { useEffect, useState, useCallback } from 'react'
import { Calendar, momentLocalizer, Views, SlotInfo } from 'react-big-calendar'
import moment from 'moment'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { Shift, Site, Guard } from '../../types'
import { shiftsApi, sitesApi, guardsApi } from '../../api'
import Modal from '../../components/Modal'
import ShiftForm from './ShiftForm'
import ShiftDetail from './ShiftDetail'
import { AlertCircle } from 'lucide-react'

const localizer = momentLocalizer(moment)

const shiftColors: Record<string, string> = {
  unassigned: '#ef4444',
  assigned: '#3b82f6',
  active: '#10b981',
  completed: '#6b7280',
  cancelled: '#d1d5db',
}

export default function Scheduling() {
  const [shifts, setShifts] = useState<Shift[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [guards, setGuards] = useState<Guard[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null)
  const [slotInfo, setSlotInfo] = useState<{ start: Date; end: Date } | null>(null)
  const [view, setView] = useState<any>(Views.WEEK)
  const [date, setDate] = useState(new Date())
  const [error, setError] = useState('')

  const loadShifts = useCallback(async () => {
    const start = moment(date).startOf('month').subtract(7, 'days').toISOString()
    const end = moment(date).endOf('month').add(7, 'days').toISOString()
    const data = await shiftsApi.list({ start, end })
    setShifts(data)
  }, [date])

  useEffect(() => {
    loadShifts()
    sitesApi.list().then(setSites)
    guardsApi.list().then(setGuards)
  }, [loadShifts])

  const events = shifts.map(s => ({
    id: s.id,
    title: s.guard_id
      ? `${s.site_name} — ${s.first_name} ${s.last_name}`
      : `⚠ ${s.site_name} (Unassigned)`,
    start: new Date(s.start_time),
    end: new Date(s.end_time),
    resource: s,
    color: shiftColors[s.status] || '#6b7280',
  }))

  const handleSelectSlot = (slot: SlotInfo) => {
    setSlotInfo({ start: slot.start, end: slot.end })
    setShowCreate(true)
  }

  const handleSelectEvent = (event: any) => {
    setSelectedShift(event.resource)
    setShowDetail(true)
  }

  const handleCreate = async (data: any) => {
    setError('')
    try {
      await shiftsApi.create(data)
      setShowCreate(false)
      loadShifts()
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to create shift')
    }
  }

  const handleUpdate = async (id: number, data: any) => {
    setError('')
    try {
      await shiftsApi.update(id, data)
      setShowDetail(false)
      loadShifts()
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to update shift')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Cancel this shift?')) return
    await shiftsApi.delete(id)
    setShowDetail(false)
    loadShifts()
  }

  const uncoveredToday = shifts.filter(s =>
    s.status === 'unassigned' && moment(s.start_time).isSame(moment(), 'day')
  ).length

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Scheduling</h1>
          <p className="text-gray-500 text-sm mt-0.5 hidden sm:block">Click any slot to create a shift · Click a shift to edit</p>
        </div>
        {uncoveredToday > 0 && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
            <AlertCircle size={16} />
            {uncoveredToday} uncovered shift{uncoveredToday > 1 ? 's' : ''} today
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        {Object.entries(shiftColors).filter(([k]) => k !== 'cancelled').map(([status, color]) => (
          <span key={status} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: color }} />
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Calendar */}
      <div className="card p-2 sm:p-4" style={{ height: 'calc(100vh - 220px)', minHeight: 400 }}>
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          view={view}
          onView={setView}
          date={date}
          onNavigate={setDate}
          selectable
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
          eventPropGetter={(event: any) => ({
            style: {
              backgroundColor: event.color,
              borderColor: event.color,
              color: 'white',
              borderRadius: '4px',
              fontSize: '12px',
            }
          })}
          views={[Views.MONTH, Views.WEEK, Views.DAY]}
          step={30}
          timeslots={2}
          defaultView={Views.WEEK}
        />
      </div>

      {showCreate && slotInfo && (
        <Modal title="Create Shift" onClose={() => setShowCreate(false)} size="md">
          <ShiftForm
            initialStart={slotInfo.start}
            initialEnd={slotInfo.end}
            sites={sites}
            guards={guards}
            onSave={handleCreate}
            onCancel={() => setShowCreate(false)}
            error={error}
          />
        </Modal>
      )}

      {showDetail && selectedShift && (
        <Modal title="Shift Details" onClose={() => setShowDetail(false)} size="md">
          <ShiftDetail
            shift={selectedShift}
            sites={sites}
            guards={guards}
            onSave={(data) => handleUpdate(selectedShift.id, data)}
            onDelete={() => handleDelete(selectedShift.id)}
            onCancel={() => setShowDetail(false)}
            error={error}
          />
        </Modal>
      )}
    </div>
  )
}
