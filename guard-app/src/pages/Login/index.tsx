import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Eye, EyeOff, AlertCircle, Loader } from 'lucide-react'
import { authApi } from '../../api'
import { useAuthStore } from '../../store/authStore'

export default function Login() {
  const navigate = useNavigate()
  const setAuth = useAuthStore(s => s.setAuth)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { token, guard } = await authApi.login(email, password)
      setAuth(token, guard)
      navigate('/', { replace: true })
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed. Check your connection.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-6 py-12">
      {/* Logo */}
      <div className="flex flex-col items-center mb-10">
        <div className="w-20 h-20 bg-brand-900 border-2 border-brand-600 rounded-3xl flex items-center justify-center mb-4 shadow-2xl shadow-brand-900/50">
          <Shield size={40} className="text-brand-400" />
        </div>
        <h1 className="text-3xl font-bold text-white tracking-tight">GuardOps</h1>
        <p className="text-white/40 text-sm mt-1">Guard Portal</p>
      </div>

      {/* Form */}
      <form onSubmit={handleLogin} className="w-full max-w-sm space-y-4">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 flex items-center gap-2 text-sm">
            <AlertCircle size={16} className="shrink-0" />
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-white/60 mb-1.5">Email Address</label>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="your.email@company.com"
            className="w-full bg-surface-card border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-white/20 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white/60 mb-1.5">Password</label>
          <div className="relative">
            <input
              type={showPass ? 'text' : 'password'}
              required
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-surface-card border border-white/10 rounded-xl px-4 py-3.5 pr-12 text-white placeholder-white/20 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPass(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 p-1"
            >
              {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-4 flex items-center justify-center gap-2 transition-colors mt-2 text-base"
        >
          {loading ? <><Loader size={18} className="animate-spin" /> Signing in...</> : 'Sign In'}
        </button>

        <p className="text-center text-white/30 text-sm mt-4">
          Locked out? Contact your manager.
        </p>
      </form>

      {/* Demo hint */}
      <div className="mt-8 bg-surface-card border border-white/5 rounded-xl px-4 py-3 w-full max-w-sm">
        <p className="text-white/40 text-xs text-center">
          <span className="text-white/60 font-medium">Demo: </span>
          marcus.w@guardops.com / guard123
        </p>
      </div>
    </div>
  )
}
