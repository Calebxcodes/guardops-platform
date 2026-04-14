import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Shield, Eye, EyeOff, AlertCircle, Loader, RefreshCw } from 'lucide-react'
import { adminAuthApi } from '../../api'
import { useAuthStore } from '../../store/authStore'
import InstallPromptButton from '../../components/InstallPromptButton'

function makeCaptcha() {
  const ops = ['+', '-', '×'] as const
  const op = ops[Math.floor(Math.random() * ops.length)]
  let a: number, b: number
  if (op === '+') { a = Math.floor(Math.random() * 15) + 2; b = Math.floor(Math.random() * 15) + 2 }
  else if (op === '-') { a = Math.floor(Math.random() * 15) + 8; b = Math.floor(Math.random() * 8) + 1 }
  else { a = Math.floor(Math.random() * 9) + 2; b = Math.floor(Math.random() * 9) + 2 }
  const answer = op === '+' ? a + b : op === '-' ? a - b : a * b
  return { question: `${a} ${op} ${b}`, answer }
}

export default function Login() {
  const navigate   = useNavigate()
  const setAuth    = useAuthStore(s => s.setAuth)
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [captcha,  setCaptcha]  = useState(makeCaptcha)
  const [captchaInput, setCaptchaInput] = useState('')
  const [captchaError, setCaptchaError] = useState(false)

  const refreshCaptcha = () => { setCaptcha(makeCaptcha()); setCaptchaInput(''); setCaptchaError(false) }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setCaptchaError(false)
    if (parseInt(captchaInput, 10) !== captcha.answer) {
      setCaptchaError(true)
      refreshCaptcha()
      return
    }
    setError('')
    setLoading(true)
    try {
      const { token, admin } = await adminAuthApi.login(email, password)
      setAuth(token, admin)
      navigate('/', { replace: true })
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed. Please check your credentials.')
      refreshCaptcha()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-xl">
            <Shield size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Strondis Ops</h1>
          <p className="text-gray-500 text-sm mt-1">Operations Platform</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
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
              placeholder="Enter your admin email"
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'} required autoComplete="current-password"
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 pr-12 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              />
              <button type="button" onClick={() => setShowPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 p-1">
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Math CAPTCHA */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Security Check</label>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 flex items-center justify-between">
                <span className="text-white font-mono text-lg tracking-widest select-none">
                  {captcha.question} = ?
                </span>
                <button
                  type="button"
                  onClick={refreshCaptcha}
                  className="text-gray-500 hover:text-gray-300 ml-2"
                  title="New question"
                >
                  <RefreshCw size={14} />
                </button>
              </div>
              <input
                type="number"
                required
                value={captchaInput}
                onChange={e => { setCaptchaInput(e.target.value); setCaptchaError(false) }}
                placeholder="Answer"
                className={`w-24 bg-gray-900 border rounded-xl px-3 py-3 text-white text-center focus:outline-none focus:ring-1 transition-colors ${
                  captchaError
                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                    : 'border-gray-700 focus:border-blue-500 focus:ring-blue-500'
                }`}
              />
            </div>
            {captchaError && (
              <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                <AlertCircle size={12} /> Incorrect answer — new question generated
              </p>
            )}
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl py-3.5 flex items-center justify-center gap-2 transition-colors mt-2">
            {loading ? <><Loader size={18} className="animate-spin" /> Signing in...</> : 'Sign In'}
          </button>

          <div className="text-center pt-1">
            <Link to="/forgot-password" className="text-blue-400 hover:text-blue-300 text-sm transition-colors">
              Forgot your password?
            </Link>
          </div>

          <InstallPromptButton />
        </form>
      </div>
    </div>
  )
}
