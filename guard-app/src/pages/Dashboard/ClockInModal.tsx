import { useState, useEffect } from 'react'
import { MapPin, Camera, CheckCircle, AlertCircle, Loader } from 'lucide-react'
import { shiftsApi } from '../../api'
import { GuardShift } from '../../types'
import { format } from 'date-fns'

interface Props {
  shift: GuardShift
  action: 'in' | 'out'
  onClose: () => void
  onSuccess: (shift: GuardShift) => void
}

type Step = 'confirm' | 'locating' | 'ready' | 'success' | 'error'

export default function ClockInModal({ shift, action, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<Step>('confirm')
  const [location, setLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<any>(null)

  const getLocation = () => {
    setStep('locating')
    if (!navigator.geolocation) {
      setLocation(null)
      setStep('ready')
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy })
        setStep('ready')
      },
      () => {
        setLocation(null)
        setStep('ready')
      },
      { timeout: 8000, enableHighAccuracy: true }
    )
  }

  const handleConfirm = async () => {
    setSubmitting(true)
    try {
      const data = { shift_id: shift.id, ...location }
      const res = action === 'in' ? await shiftsApi.clockIn(data) : await shiftsApi.clockOut(data)
      setResult(res)
      setStep('success')
      // Refresh shift from API
      const updated = await shiftsApi.today()
      onSuccess(updated || { ...shift, status: action === 'in' ? 'active' : 'completed' })
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed. Please try again.')
      setStep('error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full bg-surface-card rounded-t-3xl p-6 space-y-5 max-w-lg mx-auto">
        <div className="w-12 h-1 bg-white/20 rounded-full mx-auto -mt-2" />

        {step === 'confirm' && (
          <>
            <div className="text-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 ${action === 'in' ? 'bg-green-600' : 'bg-red-600'}`}>
                <span className="text-2xl">{action === 'in' ? '▶' : '⏹'}</span>
              </div>
              <h2 className="text-xl font-bold text-white">Clock {action === 'in' ? 'In' : 'Out'}</h2>
              <p className="text-white/50 mt-1">{shift.site_name}</p>
              <p className="text-white/30 text-sm">{format(new Date(), 'h:mm a, MMM d')}</p>
            </div>
            <div className="bg-surface rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-white/40">Shift time</span>
                <span className="text-white">{format(new Date(shift.start_time), 'h:mm a')} – {format(new Date(shift.end_time), 'h:mm a')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Site</span>
                <span className="text-white truncate ml-4">{shift.site_name}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 py-3.5 rounded-xl border border-white/10 text-white/60 font-medium">Cancel</button>
              <button onClick={getLocation} className="flex-1 py-3.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold flex items-center justify-center gap-2">
                <MapPin size={16} /> Get Location
              </button>
            </div>
          </>
        )}

        {step === 'locating' && (
          <div className="text-center py-8">
            <Loader size={40} className="animate-spin text-brand-400 mx-auto mb-4" />
            <p className="text-white font-medium">Getting your location...</p>
            <p className="text-white/40 text-sm mt-1">Please allow location access</p>
          </div>
        )}

        {step === 'ready' && (
          <>
            <h2 className="text-xl font-bold text-white text-center">Confirm Clock {action === 'in' ? 'In' : 'Out'}</h2>
            <div className="bg-surface rounded-xl p-4 space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <MapPin size={15} className={location ? 'text-green-400' : 'text-yellow-400'} />
                {location ? (
                  <span className="text-white/70">
                    {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                    <span className="text-white/30 ml-2">±{Math.round(location.accuracy)}m</span>
                  </span>
                ) : (
                  <span className="text-yellow-400">Location unavailable — clocking in without GPS</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Camera size={15} className="text-white/30" />
                <span className="text-white/30">Photo capture coming in Phase 2</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 py-3.5 rounded-xl border border-white/10 text-white/60 font-medium">Cancel</button>
              <button
                onClick={handleConfirm}
                disabled={submitting}
                className={`flex-1 py-3.5 rounded-xl font-semibold text-white flex items-center justify-center gap-2 ${action === 'in' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'} disabled:opacity-50`}
              >
                {submitting ? <Loader size={16} className="animate-spin" /> : null}
                Confirm Clock {action === 'in' ? 'In' : 'Out'}
              </button>
            </div>
          </>
        )}

        {step === 'success' && (
          <div className="text-center py-6">
            <CheckCircle size={56} className="text-green-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white">Clocked {action === 'in' ? 'In' : 'Out'}!</h2>
            <p className="text-white/50 mt-1">
              {action === 'out' && result?.hours_worked
                ? `${result.hours_worked}h worked today`
                : `Shift started at ${format(new Date(), 'h:mm a')}`}
            </p>
            {action === 'out' && (
              <p className="text-green-400/70 text-sm mt-2">Timesheet draft created — submit when ready</p>
            )}
            <button onClick={onClose} className="mt-6 w-full py-3.5 rounded-xl bg-brand-600 text-white font-semibold">Done</button>
          </div>
        )}

        {step === 'error' && (
          <div className="text-center py-6">
            <AlertCircle size={48} className="text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white">Something went wrong</h2>
            <p className="text-red-400 text-sm mt-2">{error}</p>
            <div className="flex gap-3 mt-6">
              <button onClick={onClose} className="flex-1 py-3.5 rounded-xl border border-white/10 text-white/60">Close</button>
              <button onClick={() => setStep('ready')} className="flex-1 py-3.5 rounded-xl bg-brand-600 text-white font-semibold">Try Again</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
