import { useState, useEffect } from 'react'
import { MapPin, CheckCircle, AlertCircle, Loader, ScanFace, Navigation, RefreshCw } from 'lucide-react'
import { shiftsApi, profileApi } from '../../api'
import { useAuthStore } from '../../store/authStore'
import { GuardShift } from '../../types'
import { format } from 'date-fns'
import FaceCapture from '../../components/FaceCapture'
import { useNavigate } from 'react-router-dom'

const GEOFENCE_YARDS  = 200
const GEOFENCE_METERS = 183

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180
  const Δφ = (lat2 - lat1) * Math.PI / 180, Δλ = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

interface Props {
  shift: GuardShift
  action: 'in' | 'out'
  onClose: () => void
  onSuccess: (shift: GuardShift) => void
}

type Step = 'confirm' | 'locating' | 'face' | 'face_fail' | 'ready' | 'submitting' | 'success' | 'error'

export default function ClockInModal({ shift, action, onClose, onSuccess }: Props) {
  const guard    = useAuthStore(s => s.guard)
  const navigate = useNavigate()

  const [step, setStep]               = useState<Step>('confirm')
  const [location, setLocation]       = useState<{ lat: number; lng: number; accuracy: number } | null>(null)
  const [faceVerified, setFaceVerified] = useState(false)
  const [faceDescriptor, setFaceDescriptor] = useState<number[] | null>(null)
  const [error, setError]             = useState('')
  const [result, setResult]           = useState<any>(null)

  const hasFaceId = guard?.has_face_id ?? false

  // Geofence (client-side preview — backend is authoritative)
  const distanceMeters = location && shift.lat && shift.lng
    ? Math.round(haversineMeters(location.lat, location.lng, shift.lat, shift.lng))
    : null
  const distanceYards = distanceMeters !== null ? Math.round(distanceMeters * 1.09361) : null
  const siteHasCoords = !!(shift.lat && shift.lng)
  const withinRange   = distanceMeters !== null ? distanceMeters <= GEOFENCE_METERS : !siteHasCoords

  // Pre-fetch stored face descriptor as soon as modal opens (if enrolled)
  useEffect(() => {
    if (hasFaceId) {
      profileApi.getFaceDescriptor().then(r => setFaceDescriptor(r.descriptor)).catch(() => {})
    }
  }, [hasFaceId])

  const getLocation = () => {
    setStep('locating')
    if (!navigator.geolocation) {
      setLocation(null)
      goToFace()
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy })
        goToFace()
      },
      () => { setLocation(null); goToFace() },
      { timeout: 8000, enableHighAccuracy: true }
    )
  }

  // Always go to face step — no shortcut path that skips it
  const goToFace = () => setStep('face')

  const handleFaceSuccess = () => {
    setFaceVerified(true)
    setStep('ready')
  }

  const handleFaceFail = () => {
    setFaceVerified(false)
    setStep('face_fail')
  }

  const handleConfirm = async () => {
    // Guard against submitting without face verification
    if (hasFaceId && !faceVerified) return

    setStep('submitting')
    try {
      const data = { shift_id: shift.id, ...location, face_verified: faceVerified }
      const res  = action === 'in' ? await shiftsApi.clockIn(data) : await shiftsApi.clockOut(data)
      setResult(res)
      setStep('success')
      const updated = await shiftsApi.today()
      onSuccess(updated || { ...shift, status: action === 'in' ? 'active' : 'completed' })
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed. Please try again.')
      setStep('error')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={step === 'success' || step === 'error' ? onClose : undefined} />
      <div className="relative w-full bg-surface-card rounded-t-3xl p-6 space-y-5 max-w-lg mx-auto">
        <div className="w-12 h-1 bg-white/20 rounded-full mx-auto -mt-2" />

        {/* ── Step: confirm ── */}
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
              {/* 2FA steps preview */}
              <div className="border-t border-white/5 pt-2 mt-2 space-y-1.5">
                <div className="flex items-center gap-2 text-white/50">
                  <MapPin size={13} className="text-brand-400" />
                  <span>Step 1 — GPS location check</span>
                </div>
                <div className="flex items-center gap-2 text-white/50">
                  <ScanFace size={13} className={hasFaceId ? 'text-brand-400' : 'text-red-400'} />
                  <span>Step 2 — Face ID verification</span>
                  {!hasFaceId && <span className="text-red-400 text-xs ml-auto">Not enrolled</span>}
                </div>
              </div>
            </div>

            {!hasFaceId ? (
              <div className="bg-red-900/30 border border-red-700/40 rounded-xl px-4 py-3 text-center space-y-3">
                <p className="text-red-300 text-sm font-semibold">Face ID Required</p>
                <p className="text-red-300/70 text-xs">You must enrol Face ID before you can clock in. Go to your profile to set it up.</p>
                <div className="flex gap-3">
                  <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/50 text-sm">Cancel</button>
                  <button
                    onClick={() => { onClose(); navigate('/profile') }}
                    className="flex-1 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold flex items-center justify-center gap-1.5"
                  >
                    <ScanFace size={15} /> Enrol Face ID
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-3">
                <button onClick={onClose} className="flex-1 py-3.5 rounded-xl border border-white/10 text-white/60 font-medium">Cancel</button>
                <button onClick={getLocation} className="flex-1 py-3.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold flex items-center justify-center gap-2">
                  <MapPin size={16} /> Begin Clock {action === 'in' ? 'In' : 'Out'}
                </button>
              </div>
            )}
          </>
        )}

        {/* ── Step: locating ── */}
        {step === 'locating' && (
          <div className="text-center py-8">
            <Loader size={40} className="animate-spin text-brand-400 mx-auto mb-4" />
            <p className="text-white font-medium">Step 1 of 2 — Getting your location...</p>
            <p className="text-white/40 text-sm mt-1">Please allow location access if prompted</p>
          </div>
        )}

        {/* ── Step: face verification ── */}
        {step === 'face' && (
          <>
            <div className="text-center mb-2">
              <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Step 2 of 2</p>
              <h2 className="text-lg font-bold text-white">Face ID Verification</h2>
              <p className="text-white/40 text-sm mt-0.5">Look directly at the camera to verify your identity</p>
            </div>
            <FaceCapture
              mode="verify"
              referenceDescriptor={faceDescriptor}
              onSuccess={handleFaceSuccess}
              onFail={handleFaceFail}
              onCancel={onClose}
            />
          </>
        )}

        {/* ── Step: face failed ── */}
        {step === 'face_fail' && (
          <div className="text-center py-6">
            <div className="w-16 h-16 rounded-full bg-red-900/40 border border-red-700/40 flex items-center justify-center mx-auto mb-4">
              <ScanFace size={30} className="text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Face Not Recognised</h2>
            <p className="text-white/50 text-sm mt-2">
              Your face could not be verified. Ensure good lighting and look directly at the camera.
            </p>
            <div className="flex gap-3 mt-6">
              <button onClick={onClose} className="flex-1 py-3.5 rounded-xl border border-white/10 text-white/60 font-medium">Cancel</button>
              <button
                onClick={() => setStep('face')}
                className="flex-1 py-3.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold flex items-center justify-center gap-2"
              >
                <RefreshCw size={15} /> Try Again
              </button>
            </div>
          </div>
        )}

        {/* ── Step: ready ── */}
        {step === 'ready' && (
          <>
            <h2 className="text-xl font-bold text-white text-center">Confirm Clock {action === 'in' ? 'In' : 'Out'}</h2>
            <div className="bg-surface rounded-xl p-4 space-y-3 text-sm">

              {/* GPS row */}
              <div className="flex items-start gap-2">
                <MapPin size={15} className={location ? (withinRange ? 'text-green-400' : 'text-red-400') : 'text-yellow-400'} />
                <div className="flex-1">
                  {location ? (
                    <>
                      <span className="text-white/70">
                        {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                        <span className="text-white/30 ml-2">±{Math.round(location.accuracy)}m</span>
                      </span>
                      {siteHasCoords && distanceYards !== null && (
                        <div className={`flex items-center gap-1 mt-1 ${withinRange ? 'text-green-400' : 'text-red-400'}`}>
                          <Navigation size={11} />
                          <span className="text-xs font-medium">
                            {withinRange
                              ? `${distanceYards} yds from site — within range ✓`
                              : `${distanceYards} yds from site — must be within ${GEOFENCE_YARDS} yds`}
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <span className={siteHasCoords ? 'text-red-400' : 'text-yellow-400'}>
                      {siteHasCoords ? 'GPS unavailable — server will enforce location' : 'No GPS — no site coordinates set'}
                    </span>
                  )}
                </div>
              </div>

              {/* Face ID row */}
              <div className="flex items-center gap-2">
                <ScanFace size={15} className={faceVerified ? 'text-green-400' : 'text-red-400'} />
                {faceVerified
                  ? <span className="text-green-400">Face ID verified ✓</span>
                  : <span className="text-red-400">Face ID not verified — cannot clock {action}</span>}
              </div>
            </div>

            {/* Out-of-range warning */}
            {!withinRange && siteHasCoords && (
              <div className="bg-red-900/30 border border-red-700/40 rounded-xl px-4 py-3 flex items-center gap-2">
                <AlertCircle size={16} className="text-red-400 shrink-0" />
                <span className="text-red-300 text-sm">
                  You're too far from the site. Move closer and retry.
                </span>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 py-3.5 rounded-xl border border-white/10 text-white/60 font-medium">Cancel</button>
              {!withinRange && siteHasCoords ? (
                <button
                  onClick={getLocation}
                  className="flex-1 py-3.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold flex items-center justify-center gap-2"
                >
                  <MapPin size={16} /> Retry Location
                </button>
              ) : !faceVerified ? (
                <button
                  onClick={() => setStep('face')}
                  className="flex-1 py-3.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold flex items-center justify-center gap-2"
                >
                  <ScanFace size={16} /> Retry Face ID
                </button>
              ) : (
                <button
                  onClick={handleConfirm}
                  className={`flex-1 py-3.5 rounded-xl font-semibold text-white flex items-center justify-center gap-2 ${action === 'in' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
                >
                  Confirm Clock {action === 'in' ? 'In' : 'Out'}
                </button>
              )}
            </div>
          </>
        )}

        {/* ── Step: submitting ── */}
        {step === 'submitting' && (
          <div className="text-center py-8">
            <Loader size={40} className="animate-spin text-brand-400 mx-auto mb-4" />
            <p className="text-white font-medium">Recording your clock {action}...</p>
          </div>
        )}

        {/* ── Step: success ── */}
        {step === 'success' && (
          <div className="text-center py-6">
            <CheckCircle size={56} className="text-green-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white">Clocked {action === 'in' ? 'In' : 'Out'}!</h2>
            <p className="text-white/50 mt-1">
              {action === 'out' && result?.hours_worked
                ? `${result.hours_worked}h worked today`
                : `Shift started at ${result?.clocked_in_at ? format(new Date(result.clocked_in_at), 'h:mm a') : format(new Date(), 'h:mm a')}`}
            </p>
            <div className="flex items-center justify-center gap-3 mt-3">
              <span className="text-green-400/70 text-xs flex items-center gap-1"><MapPin size={12} />Location verified</span>
              <span className="text-green-400/70 text-xs flex items-center gap-1"><ScanFace size={12} />Face ID verified</span>
            </div>
            {action === 'out' && <p className="text-green-400/70 text-sm mt-3">Timesheet draft created — submit when ready</p>}
            <button onClick={onClose} className="mt-6 w-full py-3.5 rounded-xl bg-brand-600 text-white font-semibold">Done</button>
          </div>
        )}

        {/* ── Step: error ── */}
        {step === 'error' && (
          <div className="text-center py-6">
            <AlertCircle size={48} className="text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white">Clock {action === 'in' ? 'In' : 'Out'} Failed</h2>
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
