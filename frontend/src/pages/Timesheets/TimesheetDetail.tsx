import { useState } from 'react'
import { Timesheet } from '../../types'
import StatusBadge from '../../components/StatusBadge'
import { format } from 'date-fns'
import { Check, X } from 'lucide-react'

interface Props {
  timesheet: Timesheet
  onApprove: () => void
  onReject: (notes: string) => void
  onClose: () => void
}

export default function TimesheetDetail({ timesheet: ts, onApprove, onReject, onClose }: Props) {
  const [rejectionNote, setRejectionNote] = useState('')
  const [showReject, setShowReject] = useState(false)

  const total = ts.regular_hours + ts.overtime_hours

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">{ts.first_name} {ts.last_name}</h3>
        <StatusBadge status={ts.status} />
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-gray-500 text-xs">Period</div>
          <div className="font-medium">{format(new Date(ts.period_start), 'MMM d')} – {format(new Date(ts.period_end), 'MMM d, yyyy')}</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-gray-500 text-xs">Source</div>
          <div className="font-medium capitalize">{ts.source}</div>
        </div>
        <div className="bg-blue-50 rounded-lg p-3">
          <div className="text-blue-500 text-xs">Regular Hours</div>
          <div className="font-bold text-blue-700 text-xl">{ts.regular_hours}h</div>
        </div>
        <div className="bg-orange-50 rounded-lg p-3">
          <div className="text-orange-500 text-xs">Overtime Hours</div>
          <div className="font-bold text-orange-700 text-xl">{ts.overtime_hours}h</div>
        </div>
        <div className="col-span-2 bg-gray-900 rounded-lg p-3 text-white">
          <div className="text-gray-400 text-xs">Total Hours</div>
          <div className="font-bold text-2xl">{total}h</div>
        </div>
      </div>

      {ts.guard_notes && (
        <div className="bg-gray-50 rounded-lg p-3 text-sm">
          <div className="text-gray-500 text-xs mb-1">Guard Notes</div>
          <p>{ts.guard_notes}</p>
        </div>
      )}

      {ts.manager_notes && (
        <div className="bg-yellow-50 rounded-lg p-3 text-sm border border-yellow-200">
          <div className="text-yellow-600 text-xs mb-1">Manager Notes</div>
          <p>{ts.manager_notes}</p>
        </div>
      )}

      {ts.submitted_at && (
        <p className="text-xs text-gray-400">Submitted: {format(new Date(ts.submitted_at), 'MMM d, yyyy HH:mm')}</p>
      )}
      {ts.approved_at && (
        <p className="text-xs text-gray-400">Approved: {format(new Date(ts.approved_at), 'MMM d, yyyy HH:mm')}</p>
      )}

      {showReject && (
        <div>
          <label className="label">Rejection reason</label>
          <textarea className="input" rows={2} value={rejectionNote} onChange={e => setRejectionNote(e.target.value)} placeholder="Explain why this timesheet is being rejected..." />
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <button onClick={onClose} className="btn-secondary">Close</button>
        {ts.status === 'submitted' && (
          <div className="flex gap-2">
            {!showReject ? (
              <>
                <button onClick={() => setShowReject(true)} className="btn-danger flex items-center gap-1">
                  <X size={14} /> Reject
                </button>
                <button onClick={onApprove} className="btn-primary flex items-center gap-1">
                  <Check size={14} /> Approve
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setShowReject(false)} className="btn-secondary">Back</button>
                <button onClick={() => onReject(rejectionNote)} className="btn-danger flex items-center gap-1">
                  <X size={14} /> Confirm Reject
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
