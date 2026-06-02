import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import {
  Shield, Eye, EyeOff, AlertCircle, CheckCircle, Loader,
  Camera, Upload, Building2, ChevronRight, ChevronLeft,
} from 'lucide-react'
import { guardSignupApi, badgeApi } from '../../api'

type BadgeData = {
  sia_license_number?: string
  sia_expiry_date?: string
  badge_number?: string
  card_type?: string
  photo_url?: string | null
}

type LocationState = { tenantId?: number; tenantName?: string; tenantSlug?: string }

function isBadgeExpired(expiryDate?: string): boolean {
  if (!expiryDate) return false
  const expiry = new Date(expiryDate)
  return expiry < new Date()
}

export default function GuardSignupFlow() {
  const location  = useLocation()
  const navigate  = useNavigate()
  const state     = (location.state as LocationState) || {}

  const [step,        setStep]        = useState(1)
  const [error,       setError]       = useState('')
  const [loading,     setLoading]     = useState(false)
  const [success,     setSuccess]     = useState(false)

  // Step 1 fields
  const [firstName,   setFirstName]   = useState('')
  const [lastName,    setLastName]    = useState('')
  const [email,       setEmail]       = useState('')
  const [dob,         setDob]         = useState('')
  const [privacyOk,   setPrivacyOk]   = useState(false)
  const [termsOk,     setTermsOk]     = useState(false)

  // Step 2 — badge OCR
  const [badge,        setBadge]       = useState<BadgeData | null>(null)
  const [ocrLoading,   setOcrLoading]  = useState(false)
  const [cameraMode,   setCameraMode]  = useState(false)
  const [cameraError,  setCameraError] = useState(false)
  const videoRef  = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Step 3 — password
  const [password,    setPassword]    = useState('')
  const [confirm,     setConfirm]     = useState('')
  const [showPass,    setShowPass]    = useState(false)

  // If no tenant selected, redirect to tenant select
  useEffect(() => {
    if (!state.tenantId) navigate('/signup', { replace: true })
  }, [state.tenantId, navigate])

  // Cleanup camera on unmount or step change
  useEffect(() => {
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()) }
  }, [])

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setCameraMode(false)
  }

  const startCamera = async () => {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = stream
      setCameraMode(true)
      setTimeout(() => {
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play() }
      }, 100)
    } catch {
      setCameraError(true)
    }
  }

  const captureFromCamera = async () => {
    if (!videoRef.current || !canvasRef.current) return
    const canvas = canvasRef.current
    canvas.width  = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight
    canvas.getContext('2d')!.drawImage(videoRef.current, 0, 0)
    canvas.toBlob(async blob => {
      if (!blob) return
      stopCamera()
      await uploadBadgeFile(new File([blob], 'badge.jpg', { type: 'image/jpeg' }))
    }, 'image/jpeg', 0.92)
  }

  const uploadBadgeFile = async (file: File) => {
    setOcrLoading(true)
    setError('')
    try {
      const result = await badgeApi.upload(file)
      setBadge({ ...result.extracted, photo_url: result.photo_url })
    } catch {
      setError('Could not read badge. Please try again or use a clearer photo.')
    } finally {
      setOcrLoading(false)
    }
  }

  const handleStep1 = (e: React.FormEvent) => {
    e.preventDefault()
    if (!privacyOk || !termsOk) { setError('Please accept the Privacy Policy and Terms of Service'); return }
    setError(''); setStep(2)
  }

  const handleConfirmBadge = () => {
    if (!badge) return
    if (isBadgeExpired(badge.sia_expiry_date)) {
      setError('Badge is expired — cannot complete signup with an expired SIA licence')
      return
    }
    setError(''); setStep(3)
  }

  const handleCompleteSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 10) { setError('Password must be at least 10 characters'); return }
    setLoading(true)
    try {
      await guardSignupApi.signup({
        tenantId: state.tenantId!,
        email, password,
        firstName, lastName,
        dateOfBirth: dob || undefined,
        siaBadge: badge || undefined,
      })
      setSuccess(true)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Signup failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!state.tenantId) return null

  if (success) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm text-center space-y-4">
          <CheckCircle size={56} className="mx-auto text-green-400" />
          <h2 className="text-2xl font-bold text-white">Account Created!</h2>
          <p className="text-white/50 text-sm">
            Your account at <strong className="text-white">{state.tenantName}</strong> is pending admin activation.
            You'll receive an email once approved.
          </p>
          <Link to="/login" className="inline-block mt-4 text-brand-400 hover:text-brand-300 text-sm underline">
            Back to Sign In
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center px-6 py-10">
      <div className="flex flex-col items-center mb-6">
        <div className="w-16 h-16 bg-brand-900 border-2 border-brand-600 rounded-2xl flex items-center justify-center mb-3 shadow-xl shadow-brand-900/50">
          <Shield size={32} className="text-brand-400" />
        </div>
        <div className="flex items-center gap-1.5 text-sm text-white/40 mb-1">
          <Building2 size={14} /> {state.tenantName}
        </div>
        <h1 className="text-xl font-bold text-white">Create Your Account</h1>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {[1, 2, 3].map(n => (
          <div key={n} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
              step > n ? 'bg-green-500 text-white'
                : step === n ? 'bg-brand-600 text-white'
                : 'bg-white/10 text-white/40'
            }`}>{step > n ? '✓' : n}</div>
            {n < 3 && <div className={`w-8 h-0.5 rounded ${step > n ? 'bg-green-500' : 'bg-white/10'}`} />}
          </div>
        ))}
      </div>

      {error && (
        <div className="w-full max-w-sm mb-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 flex items-center gap-2 text-sm">
          <AlertCircle size={16} className="shrink-0" />{error}
        </div>
      )}

      <div className="w-full max-w-sm">
        {/* ── Step 1: Basic info ── */}
        {step === 1 && (
          <form onSubmit={handleStep1} className="space-y-4">
            <h2 className="text-lg font-semibold text-white mb-2">Basic Information</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'First Name', val: firstName, set: setFirstName, type: 'text' },
                { label: 'Last Name',  val: lastName,  set: setLastName,  type: 'text' },
              ].map(({ label, val, set, type }) => (
                <div key={label}>
                  <label className="block text-xs font-medium text-white/50 mb-1">{label} *</label>
                  <input required type={type} value={val} onChange={e => set(e.target.value)}
                    className="w-full bg-surface-card border border-white/10 rounded-xl px-3 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-brand-500" />
                </div>
              ))}
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1">Email *</label>
              <input required type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full bg-surface-card border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-brand-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1">Date of Birth *</label>
              <input required type="date" value={dob} onChange={e => setDob(e.target.value)}
                className="w-full bg-surface-card border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-500" />
            </div>
            <div className="space-y-2">
              {[
                { label: 'I agree to the Privacy Policy', val: privacyOk, set: setPrivacyOk },
                { label: 'I agree to the Terms of Service', val: termsOk,  set: setTermsOk  },
              ].map(({ label, val, set }) => (
                <label key={label} className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={val} onChange={e => set(e.target.checked)}
                    className="w-4 h-4 rounded accent-brand-500" />
                  <span className="text-sm text-white/60">{label}</span>
                </label>
              ))}
            </div>
            <button type="submit"
              className="w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl py-4 flex items-center justify-center gap-2 transition-colors">
              Next: Upload Badge <ChevronRight size={16} />
            </button>
          </form>
        )}

        {/* ── Step 2: Badge OCR ── */}
        {step === 2 && (
          <div className="space-y-4">
            <button onClick={() => { setStep(1); setError('') }} className="flex items-center gap-1 text-sm text-white/40 hover:text-white/70">
              <ChevronLeft size={14} /> Back
            </button>
            <h2 className="text-lg font-semibold text-white">Security Badge</h2>
            <p className="text-sm text-white/40">Upload or scan your SIA security badge to verify your licence.</p>

            {ocrLoading && (
              <div className="flex flex-col items-center gap-3 py-8">
                <Loader size={28} className="animate-spin text-brand-400" />
                <p className="text-sm text-white/50">Reading badge...</p>
              </div>
            )}

            {!ocrLoading && !badge && (
              <div className="space-y-3">
                {!cameraMode ? (
                  <div className="grid grid-cols-2 gap-3">
                    {!cameraError && (
                      <button onClick={startCamera}
                        className="flex flex-col items-center gap-2 py-6 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors text-white/70">
                        <Camera size={24} />
                        <span className="text-sm">Scan Camera</span>
                      </button>
                    )}
                    <label className={`flex flex-col items-center gap-2 py-6 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors text-white/70 cursor-pointer ${cameraError ? 'col-span-2' : ''}`}>
                      <Upload size={24} />
                      <span className="text-sm">Upload Photo</span>
                      <input type="file" accept="image/*" className="hidden"
                        onChange={e => e.target.files?.[0] && uploadBadgeFile(e.target.files[0])} />
                    </label>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3]">
                      <video ref={videoRef} className="w-full h-full object-cover" playsInline muted autoPlay />
                      <canvas ref={canvasRef} className="hidden" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={captureFromCamera}
                        className="bg-brand-600 hover:bg-brand-700 text-white rounded-xl py-3 font-semibold text-sm">
                        Capture
                      </button>
                      <button onClick={stopCamera}
                        className="bg-white/10 hover:bg-white/15 text-white/70 rounded-xl py-3 text-sm">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!ocrLoading && badge && (
              <div className="space-y-3">
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-white mb-1">Confirm Badge Details</h3>
                  {[
                    { label: 'SIA Licence No.', val: badge.sia_license_number },
                    { label: 'Expiry Date',     val: badge.sia_expiry_date },
                    { label: 'Badge No.',       val: badge.badge_number },
                    { label: 'Card Type',       val: badge.card_type },
                  ].map(({ label, val }) => val ? (
                    <div key={label} className="flex justify-between text-sm">
                      <span className="text-white/40">{label}</span>
                      <span className={`font-medium ${label === 'Expiry Date' && isBadgeExpired(val) ? 'text-red-400' : 'text-white'}`}>
                        {val}
                        {label === 'Expiry Date' && isBadgeExpired(val) && ' (Expired)'}
                      </span>
                    </div>
                  ) : null)}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={handleConfirmBadge}
                    className="bg-brand-600 hover:bg-brand-700 text-white rounded-xl py-3 font-semibold text-sm flex items-center justify-center gap-1">
                    Confirm <ChevronRight size={14} />
                  </button>
                  <button onClick={() => { setBadge(null); setError('') }}
                    className="bg-white/10 hover:bg-white/15 text-white/70 rounded-xl py-3 text-sm">
                    Retake
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Step 3: Password ── */}
        {step === 3 && (
          <form onSubmit={handleCompleteSignup} className="space-y-4">
            <button onClick={() => { setStep(2); setError('') }} className="flex items-center gap-1 text-sm text-white/40 hover:text-white/70">
              <ChevronLeft size={14} /> Back
            </button>
            <h2 className="text-lg font-semibold text-white">Create Password</h2>
            {[
              { label: 'Password', val: password, set: setPassword },
              { label: 'Confirm Password', val: confirm, set: setConfirm },
            ].map(({ label, val, set }) => (
              <div key={label}>
                <label className="block text-xs font-medium text-white/50 mb-1">{label} *</label>
                <div className="relative">
                  <input required minLength={10} type={showPass ? 'text' : 'password'} value={val}
                    onChange={e => set(e.target.value)} placeholder="Min. 10 characters"
                    className="w-full bg-surface-card border border-white/10 rounded-xl px-4 py-3 pr-10 text-white text-sm placeholder-white/20 focus:outline-none focus:border-brand-500" />
                  <button type="button" onClick={() => setShowPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 p-1">
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            ))}
            <button type="submit" disabled={loading}
              className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold rounded-xl py-4 flex items-center justify-center gap-2 transition-colors">
              {loading ? <><Loader size={16} className="animate-spin" /> Creating Account...</> : 'Complete Signup'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
