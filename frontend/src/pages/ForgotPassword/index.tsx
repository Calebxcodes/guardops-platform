import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Shield, AlertCircle, CheckCircle, Loader } from 'lucide-react'
import { adminAuthApi } from '../../api'

export default function ForgotPassword() {
  const [email,   setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [sent,    setSent]    = useState(false)
  const [error,   setError]   = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await adminAuthApi.forgotPassword(email)
      setSent(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-xl">
            <Shield size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">SecureEdge</h1>
          <p className="text-gray-500 text-sm mt-1">Reset your password</p>
        </div>

        {sent ? (
          <div className="bg-green-500/10 border border-green-500/30 text-green-400 rounded-xl px-5 py-4 flex items-start gap-3">
            <CheckCircle size={20} className="shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold mb-1">Check your email</div>
              <div className="text-sm opacity-80">If <strong>{email}</strong> is registered, you'll receive a reset link shortly. Check your spam folder if it doesn't arrive.</div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-gray-400 text-sm mb-2">Enter your admin email address and we'll send you a link to reset your password.</p>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 flex items-center gap-2 text-sm">
                <AlertCircle size={16} className="shrink-0" />
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Email Address</label>
              <input
                type="email" required autoComplete="email"
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="admin@secureedge.co.uk"
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              />
            </div>

            <button type="submit" disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl py-3.5 flex items-center justify-center gap-2 transition-colors">
              {loading ? <><Loader size={18} className="animate-spin" /> Sending...</> : 'Send Reset Link'}
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <Link to="/login" className="text-blue-400 hover:text-blue-300 text-sm transition-colors">
            ← Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  )
}
