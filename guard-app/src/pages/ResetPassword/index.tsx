import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Shield, Eye, EyeOff, AlertCircle, CheckCircle, Loader } from 'lucide-react'
import { authApi } from '../../api'

export default function ResetPassword() {
  const [searchParams]             = useSearchParams()
  const navigate                   = useNavigate()
  const token                      = searchParams.get('token') || ''
  const [password,   setPassword]  = useState('')
  const [confirm,    setConfirm]   = useState('')
  const [showPass,   setShowPass]  = useState(false)
  const [loading,    setLoading]   = useState(false)
  const [done,       setDone]      = useState(false)
  const [error,      setError]     = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    setLoading(true)
    try {
      await authApi.resetPassword(token, password)
      setDone(true)
      setTimeout(() => navigate('/login', { replace: true }), 2500)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Reset failed. The link may have expired.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-6 py-12">
      <div className="flex flex-col items-center mb-10">
        <div className="w-20 h-20 bg-brand-900 border-2 border-brand-600 rounded-3xl flex items-center justify-center mb-4 shadow-2xl shadow-brand-900/50">
          <Shield size={40} className="text-brand-400" />
        </div>
        <h1 className="text-3xl font-bold text-white tracking-tight">SecureEdge</h1>
        <p className="text-white/40 text-sm mt-1">Set a new password</p>
      </div>

      <div className="w-full max-w-sm">
        {!token ? (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-sm text-center">
            Invalid reset link. <Link to="/forgot-password" className="underline">Request a new one.</Link>
          </div>
        ) : done ? (
          <div className="bg-green-500/10 border border-green-500/30 text-green-400 rounded-xl px-5 py-4 flex items-start gap-3">
            <CheckCircle size={20} className="shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold mb-1">Password updated!</div>
              <div className="text-sm opacity-80">Redirecting you to sign in…</div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 flex items-center gap-2 text-sm">
                <AlertCircle size={16} className="shrink-0" />
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-white/60 mb-1.5">New Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'} required minLength={8}
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="w-full bg-surface-card border border-white/10 rounded-xl px-4 py-3.5 pr-12 text-white placeholder-white/20 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
                />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 p-1">
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/60 mb-1.5">Confirm Password</label>
              <input
                type={showPass ? 'text' : 'password'} required
                value={confirm} onChange={e => setConfirm(e.target.value)}
                placeholder="Repeat new password"
                className="w-full bg-surface-card border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-white/20 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
              />
            </div>

            <button type="submit" disabled={loading}
              className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold rounded-xl py-4 flex items-center justify-center gap-2 transition-colors text-base">
              {loading ? <><Loader size={18} className="animate-spin" /> Updating...</> : 'Set New Password'}
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <Link to="/login" className="text-brand-400 hover:text-brand-300 text-sm transition-colors">
            ← Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  )
}
