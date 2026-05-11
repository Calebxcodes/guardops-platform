import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { adminUsersApi } from '../../api'
import { useAuthStore } from '../../store/authStore'
import { Shield, Loader, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react'
import { ROLE_LABELS } from '../../utils/permissions'

type Step = 'loading' | 'form' | 'error'

export default function AcceptInvite() {
  const [params] = useSearchParams()
  const navigate  = useNavigate()
  const { setAuth } = useAuthStore()

  const token    = params.get('token') || ''
  const tenantId = params.get('tenantId') || ''

  const [step, setStep]             = useState<Step>('loading')
  const [inviteInfo, setInviteInfo] = useState<{ email: string; name: string; role: string } | null>(null)
  const [loadError, setLoadError]   = useState('')

  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [showPass,  setShowPass]  = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    if (!token || !tenantId) {
      setLoadError('Invalid invitation link. Please request a new one.')
      setStep('error')
      return
    }
    adminUsersApi.inviteInfo(token, tenantId)
      .then(info => {
        setInviteInfo(info)
        setStep('form')
      })
      .catch(err => {
        setLoadError(err.response?.data?.message || 'This invitation link is invalid or has expired.')
        setStep('error')
      })
  }, [token, tenantId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 10) {
      setSubmitError('Password must be at least 10 characters.')
      return
    }
    if (password !== confirm) {
      setSubmitError('Passwords do not match.')
      return
    }
    setSubmitError('')
    setSubmitting(true)
    try {
      const result = await adminUsersApi.acceptInvite({ token, password, tenantId })
      setAuth(result.token, result.admin)
      navigate('/', { replace: true })
    } catch (err: any) {
      setSubmitError(err.response?.data?.message || 'Failed to accept invitation. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl mb-4">
            <Shield size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Strondis Ops</h1>
          <p className="text-gray-500 text-sm mt-1">Operations Platform</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          {step === 'loading' && (
            <div className="flex flex-col items-center gap-3 py-6 text-gray-500">
              <Loader size={24} className="animate-spin text-blue-500" />
              <p className="text-sm">Verifying your invitation...</p>
            </div>
          )}

          {step === 'error' && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 text-red-600">
                <AlertCircle size={20} className="shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Invitation Invalid</p>
                  <p className="text-sm text-gray-600 mt-1">{loadError}</p>
                </div>
              </div>
              <p className="text-sm text-gray-500">
                Contact your administrator to receive a new invitation link.
              </p>
            </div>
          )}

          {step === 'form' && inviteInfo && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <div className="flex items-center gap-2 text-green-600 mb-4">
                  <CheckCircle size={18} />
                  <span className="font-semibold text-sm">You've been invited!</span>
                </div>
                <p className="text-sm text-gray-600">
                  You're joining as <strong>{inviteInfo.name || inviteInfo.email}</strong> with the role{' '}
                  <span className="font-semibold text-blue-700">
                    {ROLE_LABELS[inviteInfo.role as keyof typeof ROLE_LABELS] || inviteInfo.role}
                  </span>.
                </p>
                <p className="text-xs text-gray-400 mt-1">{inviteInfo.email}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Set your password</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    className="input pr-10 w-full"
                    placeholder="At least 10 characters"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    minLength={10}
                    disabled={submitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
                <input
                  type={showPass ? 'text' : 'password'}
                  className="input w-full"
                  placeholder="Repeat your password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  disabled={submitting}
                />
              </div>

              {submitError && (
                <div className="flex items-center gap-2 text-red-600 text-sm">
                  <AlertCircle size={14} />
                  {submitError}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || !password || !confirm}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {submitting ? <Loader size={15} className="animate-spin" /> : null}
                {submitting ? 'Activating account...' : 'Activate Account'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
