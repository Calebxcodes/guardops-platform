import { useState, useEffect } from 'react'
import { AlertTriangle, Eye, EyeOff, CheckCircle, Loader, X } from 'lucide-react'

interface Props {
  isOpen: boolean
  onClose: () => void
  onConfirm: (password: string) => Promise<void>
}

type State = 'idle' | 'loading' | 'success' | 'error'

const CONSEQUENCES = [
  'Remove all guards, shifts, payroll records, and incidents',
  'Drop the entire database for this company',
  'Delete all team member accounts',
  'Cannot be undone — this action is irreversible',
]

export default function DeleteTenantModal({ isOpen, onClose, onConfirm }: Props) {
  const [password, setPassword]     = useState('')
  const [showPass, setShowPass]     = useState(false)
  const [checked, setChecked]       = useState(false)
  const [state, setState]           = useState<State>('idle')
  const [errorMsg, setErrorMsg]     = useState('')

  // Reset every time the modal opens
  useEffect(() => {
    if (isOpen) {
      setPassword(''); setShowPass(false); setChecked(false)
      setState('idle'); setErrorMsg('')
    }
  }, [isOpen])

  // Lock body scroll while open
  useEffect(() => {
    if (!isOpen) return
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  // Escape to close (only when not mid-operation)
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && state === 'idle') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, state, onClose])

  if (!isOpen) return null

  const canSubmit = password.length > 0 && checked && state !== 'loading' && state !== 'success'

  const handleSubmit = async () => {
    if (!canSubmit) return
    setState('loading')
    setErrorMsg('')
    try {
      await onConfirm(password)
      setState('success')
      setTimeout(() => {
        window.location.href = 'https://strondis.com'
      }, 2000)
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message ?? err?.message ?? 'Something went wrong.')
      setState('error')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={state === 'idle' ? onClose : undefined}
      />

      {/* Sheet on mobile, dialog on md+ */}
      <div className="relative bg-white w-full flex flex-col rounded-t-2xl max-h-[92vh] md:rounded-2xl md:shadow-2xl md:mx-4 md:max-w-lg">

        {/* Drag handle — mobile only */}
        <div className="md:hidden flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* ── Success state ── */}
        {state === 'success' && (
          <div className="flex flex-col items-center justify-center gap-4 p-10 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle size={32} className="text-green-600" />
            </div>
            <p className="text-lg font-semibold text-gray-900">Account deleted.</p>
            <p className="text-sm text-gray-500">Redirecting to strondis.com…</p>
          </div>
        )}

        {/* ── Default / loading / error state ── */}
        {state !== 'success' && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
              <h2 className="text-base font-semibold text-gray-900">Delete Company Account</h2>
              <button
                onClick={onClose}
                disabled={state === 'loading'}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-40"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">

              {/* ── Red warning banner ── */}
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
                <AlertTriangle size={20} className="text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-red-700 leading-snug">
                    ⚠️ PERMANENT: This company account cannot be recovered
                  </p>
                  <p className="text-xs text-red-600 mt-0.5">
                    You may contact support within 30 days to request a restore.
                  </p>
                </div>
              </div>

              {/* ── Consequences list ── */}
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-2">Deleting will:</p>
                <ul className="space-y-2">
                  {CONSEQUENCES.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="mt-0.5 w-4 h-4 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                        <span className="block w-1.5 h-1.5 rounded-full bg-red-500" />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* ── Password field ── */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Confirm your password
                </label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => { setPassword(e.target.value); if (state === 'error') setState('idle') }}
                    placeholder="Enter your password"
                    disabled={state === 'loading'}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 pr-10 text-sm
                               focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500
                               disabled:bg-gray-50 disabled:text-gray-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* ── Confirmation checkbox ── */}
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={e => setChecked(e.target.checked)}
                  disabled={state === 'loading'}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 accent-red-600 cursor-pointer"
                />
                <span className="text-sm text-gray-700 leading-snug">
                  I understand this is permanent and will delete all data for this company
                </span>
              </label>

              {/* ── Error message ── */}
              {state === 'error' && errorMsg && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                  {errorMsg}
                </div>
              )}
            </div>

            {/* ── Footer buttons ── */}
            <div className="flex gap-3 p-5 border-t shrink-0">
              <button
                onClick={onClose}
                disabled={state === 'loading'}
                className="flex-1 btn-secondary disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700
                           disabled:bg-red-300 disabled:cursor-not-allowed
                           text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                {state === 'loading' ? (
                  <>
                    <Loader size={15} className="animate-spin" />
                    Deleting…
                  </>
                ) : (
                  'Delete Company Account'
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
