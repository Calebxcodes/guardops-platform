import { useState, useEffect, useRef } from 'react'
import { ShieldCheck, Upload, RotateCcw, CheckCircle, AlertTriangle, Camera, ChevronRight } from 'lucide-react'
import { badgeApi } from '../../api'
import clsx from 'clsx'

interface ExtractedData {
  sia_license_number: string | null
  sia_expiry_date: string | null
  badge_number: string | null
  card_type: string | null
  confidence: number
  raw_text: string
}

interface CurrentBadge {
  id: number
  sia_license_number: string | null
  sia_expiry_date: string | null
  badge_number: string | null
  card_type: string | null
  photo_url: string | null
  is_current: number
  status: string
  created_at: string
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function badgeDaysLeft(expiry: string): number {
  return Math.floor((new Date(expiry).getTime() - Date.now()) / 86400000)
}

export default function SecurityBadge() {
  const [step, setStep] = useState<'view' | 'upload' | 'review'>('view')
  const [current, setCurrent] = useState<CurrentBadge | null>(null)
  const [history, setHistory] = useState<CurrentBadge[]>([])
  const [loading, setLoading] = useState(true)
  const [noTenant, setNoTenant] = useState(false)

  // Upload state
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  // Review state
  const [extracted, setExtracted] = useState<ExtractedData | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [form, setForm] = useState({ sia_license_number: '', sia_expiry_date: '', badge_number: '', card_type: '' })
  const [confirming, setConfirming] = useState(false)
  const [confirmError, setConfirmError] = useState('')
  const [done, setDone] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    badgeApi.current()
      .then(data => { setCurrent(data.current); setHistory(data.history) })
      .catch(err => { if (err.response?.status === 403) setNoTenant(true) })
      .finally(() => setLoading(false))
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setUploadError('')
    const reader = new FileReader()
    reader.onload = ev => setPreview(ev.target?.result as string)
    reader.readAsDataURL(f)
  }

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    setUploadError('')
    try {
      const data = await badgeApi.upload(file)
      setExtracted(data.extracted)
      setPhotoUrl(data.photo_url)
      setForm({
        sia_license_number: data.extracted.sia_license_number || '',
        sia_expiry_date: data.extracted.sia_expiry_date || '',
        badge_number: data.extracted.badge_number || '',
        card_type: data.extracted.card_type || '',
      })
      setStep('review')
    } catch (err: any) {
      setUploadError(err.response?.data?.error || 'Failed to process badge photo. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const handleConfirm = async () => {
    setConfirming(true)
    setConfirmError('')
    try {
      await badgeApi.confirm({ ...form, photo_url: photoUrl })
      setDone(true)
      // Refresh badge data
      const data = await badgeApi.current()
      setCurrent(data.current)
      setHistory(data.history)
      setTimeout(() => {
        setDone(false)
        setStep('view')
        setFile(null)
        setPreview(null)
        setExtracted(null)
      }, 1500)
    } catch (err: any) {
      setConfirmError(err.response?.data?.error || 'Failed to save badge. Please try again.')
    } finally {
      setConfirming(false)
    }
  }

  const startUpload = () => {
    setStep('upload')
    setFile(null)
    setPreview(null)
    setUploadError('')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (noTenant) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-6 gap-4">
        <AlertTriangle size={40} className="text-amber-400" />
        <p className="text-white text-center font-medium">Badge verification requires a company account.</p>
        <p className="text-gray-400 text-sm text-center">Please log out and log back in using your company credentials.</p>
      </div>
    )
  }

  // ── Upload step ────────────────────────────────────────────────────────────
  if (step === 'upload') {
    return (
      <div className="min-h-screen bg-surface pb-28">
        <div className="px-4 pt-6 pb-4">
          <button onClick={() => setStep('view')} className="text-brand-400 text-sm mb-4 flex items-center gap-1">
            ← Back
          </button>
          <h1 className="text-white text-xl font-bold">Upload Security Badge</h1>
          <p className="text-gray-400 text-sm mt-1">Take a clear photo of your SIA badge. Our system will automatically extract the details.</p>
        </div>

        <div className="px-4 space-y-4">
          {/* File picker */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className={clsx(
              'border-2 border-dashed rounded-2xl flex flex-col items-center justify-center min-h-48 cursor-pointer transition-colors',
              preview ? 'border-brand-500/50 bg-brand-500/5' : 'border-gray-700 hover:border-gray-600 bg-gray-800/50'
            )}
          >
            {preview ? (
              <img src={preview} alt="Badge preview" className="max-h-64 rounded-xl object-contain" />
            ) : (
              <>
                <Camera size={40} className="text-gray-600 mb-3" />
                <p className="text-gray-300 font-medium">Tap to select photo</p>
                <p className="text-gray-500 text-sm mt-1">JPG, PNG up to 5MB</p>
              </>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileSelect}
          />

          {preview && (
            <button
              onClick={() => { setFile(null); setPreview(null) }}
              className="w-full py-2 text-sm text-gray-400 flex items-center justify-center gap-2"
            >
              <RotateCcw size={14} /> Choose different photo
            </button>
          )}

          {uploadError && (
            <div className="bg-red-900/30 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
              {uploadError}
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="w-full bg-brand-500 hover:bg-brand-600 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold py-4 rounded-2xl transition-colors flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Upload size={18} /> Process Badge
              </>
            )}
          </button>
        </div>
      </div>
    )
  }

  // ── Review step ────────────────────────────────────────────────────────────
  if (step === 'review') {
    return (
      <div className="min-h-screen bg-surface pb-28">
        <div className="px-4 pt-6 pb-4">
          <button onClick={() => setStep('upload')} className="text-brand-400 text-sm mb-4 flex items-center gap-1">
            ← Retake Photo
          </button>
          <h1 className="text-white text-xl font-bold">Review Badge Details</h1>
          <p className="text-gray-400 text-sm mt-1">
            Check the extracted details below. You can correct any errors before saving.
          </p>
        </div>

        {preview && (
          <div className="px-4 mb-4">
            <img src={preview} alt="Badge" className="w-full max-h-48 object-contain rounded-2xl bg-gray-800" />
          </div>
        )}

        {extracted && (
          <div className="px-4 mb-3">
            <div className={clsx(
              'rounded-xl px-3 py-2 text-xs',
              extracted.confidence >= 0.8 ? 'bg-emerald-900/30 text-emerald-400' : 'bg-amber-900/30 text-amber-400'
            )}>
              OCR confidence: {Math.round(extracted.confidence * 100)}%
              {extracted.confidence < 0.8 && ' — please verify fields carefully'}
            </div>
          </div>
        )}

        <div className="px-4 space-y-3">
          {[
            { label: 'SIA License Number', field: 'sia_license_number', type: 'text', placeholder: 'e.g. SIA1234567' },
            { label: 'Expiry Date', field: 'sia_expiry_date', type: 'date', placeholder: '' },
            { label: 'Badge Number', field: 'badge_number', type: 'text', placeholder: 'e.g. CMD-001' },
            { label: 'Card Type', field: 'card_type', type: 'text', placeholder: 'e.g. Frontline, Standard' },
          ].map(({ label, field, type, placeholder }) => (
            <div key={field}>
              <label className="text-gray-400 text-xs font-medium block mb-1">{label}</label>
              <input
                type={type}
                placeholder={placeholder}
                value={(form as any)[field]}
                onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-500"
              />
            </div>
          ))}
        </div>

        {confirmError && (
          <div className="mx-4 mt-4 bg-red-900/30 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
            {confirmError}
          </div>
        )}

        <div className="px-4 mt-6">
          <button
            onClick={handleConfirm}
            disabled={confirming || !form.sia_expiry_date || done}
            className="w-full bg-brand-500 hover:bg-brand-600 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold py-4 rounded-2xl transition-colors flex items-center justify-center gap-2"
          >
            {done ? (
              <><CheckCircle size={18} /> Saved!</>
            ) : confirming ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</>
            ) : (
              <><CheckCircle size={18} /> Confirm &amp; Save</>
            )}
          </button>
        </div>
      </div>
    )
  }

  // ── View step (default) ────────────────────────────────────────────────────
  const daysLeft = current?.sia_expiry_date ? badgeDaysLeft(current.sia_expiry_date) : null
  const isExpired = daysLeft !== null && daysLeft < 0
  const isExpiringSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 30

  return (
    <div className="min-h-screen bg-surface pb-28">
      <div className="px-4 pt-6 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-white text-xl font-bold">Security Badge</h1>
          <p className="text-gray-400 text-sm mt-0.5">SIA badge verification</p>
        </div>
        <ShieldCheck size={24} className="text-brand-400" />
      </div>

      {current ? (
        <div className="px-4 space-y-4">
          {/* Current badge card */}
          <div className="bg-gray-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-gray-400 text-xs font-medium uppercase tracking-wide">Current Badge</p>
                <p className="text-white text-lg font-bold mt-1">{current.sia_license_number || 'SIA—'}</p>
              </div>
              <span className={clsx(
                'px-2.5 py-1 rounded-full text-xs font-semibold',
                isExpired ? 'bg-red-400/10 text-red-400' :
                isExpiringSoon ? 'bg-amber-400/10 text-amber-400' :
                'bg-emerald-400/10 text-emerald-400'
              )}>
                {isExpired ? 'Expired' : isExpiringSoon ? 'Expiring Soon' : 'Valid'}
              </span>
            </div>

            {current.photo_url && (
              <img src={current.photo_url} alt="Badge" className="w-full rounded-xl object-cover max-h-40 bg-gray-900" />
            )}

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-gray-500 text-xs">Expiry</p>
                <p className={clsx('font-medium', isExpired ? 'text-red-400' : isExpiringSoon ? 'text-amber-400' : 'text-white')}>
                  {current.sia_expiry_date ? fmt(current.sia_expiry_date) : '—'}
                  {daysLeft !== null && daysLeft >= 0 && <span className="text-gray-500 ml-1">({daysLeft}d)</span>}
                </p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Badge #</p>
                <p className="text-white font-medium">{current.badge_number || '—'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Card Type</p>
                <p className="text-white font-medium">{current.card_type || '—'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Uploaded</p>
                <p className="text-white font-medium">{fmt(current.created_at)}</p>
              </div>
            </div>
          </div>

          {(isExpired || isExpiringSoon) && (
            <div className={clsx(
              'rounded-xl px-4 py-3 text-sm',
              isExpired ? 'bg-red-900/30 text-red-400 border border-red-500/20' : 'bg-amber-900/30 text-amber-400 border border-amber-500/20'
            )}>
              {isExpired
                ? 'Your badge has expired. Please upload your renewed badge immediately.'
                : `Your badge expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Upload your renewed badge soon.`}
            </div>
          )}

          <button
            onClick={startUpload}
            className="w-full bg-brand-500 hover:bg-brand-600 text-white font-semibold py-4 rounded-2xl transition-colors flex items-center justify-center gap-2"
          >
            <Upload size={18} /> Update Badge
          </button>

          {/* History */}
          {history.length > 1 && (
            <div className="mt-2">
              <p className="text-gray-400 text-sm font-medium mb-2">Previous Badges</p>
              <div className="space-y-2">
                {history.filter(b => !b.is_current).map(b => (
                  <div key={b.id} className="bg-gray-800/50 rounded-xl px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-gray-300 text-sm font-medium">{b.sia_license_number || 'Unknown'}</p>
                      <p className="text-gray-500 text-xs">Expired {b.sia_expiry_date ? fmt(b.sia_expiry_date) : '—'}</p>
                    </div>
                    <span className="text-gray-500 text-xs">{fmt(b.created_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="px-4 space-y-4">
          <div className="bg-gray-800 rounded-2xl p-6 flex flex-col items-center text-center gap-3">
            <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center">
              <ShieldCheck size={28} className="text-gray-500" />
            </div>
            <p className="text-white font-semibold">No badge on file</p>
            <p className="text-gray-400 text-sm">Upload a photo of your SIA badge to verify your credentials.</p>
          </div>
          <button
            onClick={startUpload}
            className="w-full bg-brand-500 hover:bg-brand-600 text-white font-semibold py-4 rounded-2xl transition-colors flex items-center justify-center gap-2"
          >
            <Upload size={18} /> Upload SIA Badge
          </button>
        </div>
      )}
    </div>
  )
}
