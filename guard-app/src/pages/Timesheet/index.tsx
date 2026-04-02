import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Plus, CheckCircle, Clock, AlertCircle, ChevronRight } from 'lucide-react'
import { timesheetsApi } from '../../api'
import { GuardTimesheet } from '../../types'
import StatusBadge from '../../components/ui/StatusBadge'
import Card from '../../components/ui/Card'
import BottomSheet from '../../components/ui/BottomSheet'
import SubmitSheet from './SubmitSheet'

export default function Timesheet() {
  const [timesheets, setTimesheets] = useState<GuardTimesheet[]>([])
  const [loading, setLoading] = useState(true)
  const [showSubmit, setShowSubmit] = useState(false)
  const [selected, setSelected] = useState<GuardTimesheet | null>(null)

  const load = () => timesheetsApi.list().then(data => { setTimesheets(data); setLoading(false) })
  useEffect(() => { load() }, [])

  const pending = timesheets.filter(t => t.status === 'draft')
  const submitted = timesheets.filter(t => t.status === 'submitted')
  const approved = timesheets.filter(t => t.status === 'approved')

  const estimatePay = (t: GuardTimesheet) => {
    // We don't have hourly rate here directly, just show hours
    return t.total_hours
  }

  return (
    <div className="min-h-screen bg-surface px-4 pt-14 pb-4 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Timesheets</h1>
        <button
          onClick={() => { setSelected(null); setShowSubmit(true) }}
          className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center"
        >
          <Plus size={20} />
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Draft', count: pending.length, color: 'text-white/40' },
          { label: 'Submitted', count: submitted.length, color: 'text-yellow-400' },
          { label: 'Approved', count: approved.length, color: 'text-green-400' },
        ].map(({ label, count, color }) => (
          <Card key={label} className="p-3 text-center">
            <p className={`text-2xl font-bold ${color}`}>{count}</p>
            <p className="text-white/30 text-xs">{label}</p>
          </Card>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <p className="text-white/30 text-center py-8">Loading...</p>
      ) : timesheets.length === 0 ? (
        <Card className="p-8 text-center">
          <Clock size={40} className="text-white/10 mx-auto mb-3" />
          <p className="text-white/40">No timesheets yet</p>
          <p className="text-white/20 text-sm mt-1">Clock out of a shift to generate one</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {timesheets.map(ts => (
            <button
              key={ts.id}
              onClick={() => { setSelected(ts); setShowSubmit(true) }}
              className="w-full text-left"
            >
              <Card className="px-4 py-3.5 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  ts.status === 'approved' ? 'bg-green-500/20' :
                  ts.status === 'submitted' ? 'bg-yellow-500/20' :
                  ts.status === 'rejected' ? 'bg-red-500/20' : 'bg-white/5'
                }`}>
                  {ts.status === 'approved' ? <CheckCircle size={20} className="text-green-400" /> :
                   ts.status === 'rejected' ? <AlertCircle size={20} className="text-red-400" /> :
                   <Clock size={20} className="text-white/40" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-white font-medium text-sm">
                      {format(new Date(ts.period_start), 'MMM d')} – {format(new Date(ts.period_end), 'MMM d')}
                    </p>
                    <StatusBadge status={ts.status} />
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-white/40 text-xs">{ts.total_hours}h total</span>
                    {ts.overtime_hours > 0 && (
                      <span className="text-orange-400 text-xs">{ts.overtime_hours}h OT</span>
                    )}
                    {ts.site_name && <span className="text-white/30 text-xs truncate">{ts.site_name}</span>}
                  </div>
                </div>
                <ChevronRight size={16} className="text-white/20 shrink-0" />
              </Card>
            </button>
          ))}
        </div>
      )}

      {showSubmit && (
        <SubmitSheet
          timesheet={selected}
          onClose={() => { setShowSubmit(false); setSelected(null) }}
          onSuccess={() => { setShowSubmit(false); setSelected(null); load() }}
        />
      )}
    </div>
  )
}
