import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Shield, Eye, EyeOff, AlertCircle, Loader, RefreshCw, CheckCircle, ChevronDown } from 'lucide-react'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api'

const TIERS = [
  { id: 'starter',          label: 'Starter',          guards: 10,  price: '£349/mo',  priceNote: '30-day free trial' },
  { id: 'professional_30',  label: 'Professional 30',  guards: 30,  price: '£499/mo',  priceNote: '30-day free trial' },
  { id: 'professional_60',  label: 'Professional 60',  guards: 60,  price: '£899/mo',  priceNote: '30-day free trial' },
  { id: 'professional_100', label: 'Professional 100', guards: 100, price: '£1,399/mo', priceNote: '30-day free trial' },
  { id: 'enterprise',       label: 'Enterprise',       guards: 500, price: '£2,499/mo', priceNote: '30-day free trial' },
]

function makeCaptcha() {
  const ops = ['+', '-', '×'] as const
  const op = ops[Math.floor(Math.random() * ops.length)]
  let a: number, b: number
  if (op === '+')      { a = Math.floor(Math.random() * 15) + 2; b = Math.floor(Math.random() * 15) + 2 }
  else if (op === '-') { a = Math.floor(Math.random() * 15) + 8; b = Math.floor(Math.random() * 8) + 1 }
  else                 { a = Math.floor(Math.random() * 9) + 2;  b = Math.floor(Math.random() * 9) + 2 }
  const answer = op === '+' ? a + b : op === '-' ? a - b : a * b
  return { question: `${a} ${op} ${b}`, answer }
}

function passwordStrength(pw: string): { score: number; label: string; color: string } {
  if (pw.length === 0) return { score: 0, label: '', color: '' }
  let score = 0
  if (pw.length >= 10)                    score++
  if (pw.length >= 14)                    score++
  if (/[A-Z]/.test(pw))                  score++
  if (/[0-9]/.test(pw))                  score++
  if (/[^A-Za-z0-9]/.test(pw))          score++
  if (score <= 1) return { score, label: 'Weak',   color: 'bg-red-500' }
  if (score <= 3) return { score, label: 'Fair',   color: 'bg-yellow-500' }
  if (score <= 4) return { score, label: 'Good',   color: 'bg-blue-500' }
  return                { score, label: 'Strong', color: 'bg-green-500' }
}

interface SignupResult {
  tenantId: number
  slug: string
  trialEndsAt: number
  adminUrl: string
  message: string
}

export default function Signup() {
  const navigate = useNavigate()

  const [companyName,  setCompanyName]  = useState('')
  const [email,        setEmail]        = useState('')
  const [password,     setPassword]     = useState('')
  const [showPass,     setShowPass]     = useState(false)
  const [tier,         setTier]         = useState('starter')
  const [tierOpen,     setTierOpen]     = useState(false)
  const [captcha,      setCaptcha]      = useState(makeCaptcha)
  const [captchaInput, setCaptchaInput] = useState('')
  const [captchaError, setCaptchaError] = useState(false)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')
  const [success,      setSuccess]      = useState<SignupResult | null>(null)

  const refreshCaptcha = () => { setCaptcha(makeCaptcha()); setCaptchaInput(''); setCaptchaError(false) }
  const strength = passwordStrength(password)
  const selectedTier = TIERS.find(t => t.id === tier)!

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setCaptchaError(false)

    if (parseInt(captchaInput, 10) !== captcha.answer) {
      setCaptchaError(true)
      refreshCaptcha()
      return
    }
    if (password.length < 10) {
      setError('Password must be at least 10 characters.')
      return
    }

    setError('')
    setLoading(true)
    try {
      const { data } = await axios.post<SignupResult>(`${API_BASE}/signup`, {
        companyName,
        email,
        password,
        tier,
      })
      setSuccess(data)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Signup failed. Please try again.')
      refreshCaptcha()
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    const trialDate = new Date(success.trialEndsAt * 1000).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric',
    })
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm text-center">
          <div className="w-16 h-16 bg-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl">
            <CheckCircle size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight mb-2">You're all set!</h1>
          <p className="text-gray-400 text-sm mb-8">{success.message}</p>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 text-left space-y-3 mb-8">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Company slug</span>
              <span className="text-white font-mono">{success.slug}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Trial ends</span>
              <span className="text-white">{trialDate}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Login email</span>
              <span className="text-white">{email}</span>
            </div>
          </div>

          <a
            href={`https://${success.slug}.strondis.com/login`}
            className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl py-3.5 text-center transition-colors"
          >
            Go to Login →
          </a>
          <p className="text-xs text-gray-600 text-center mt-2">
            Your company portal: <span className="text-gray-400 font-mono">{success.slug}.strondis.com</span>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-xl">
            <Shield size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Create Account</h1>
          <p className="text-gray-500 text-sm mt-1">Start your 30-day free trial</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 flex items-center gap-2 text-sm mb-4">
            <AlertCircle size={16} className="shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Company Name */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Company Name</label>
            <input
              type="text" required autoComplete="organization"
              value={companyName} onChange={e => setCompanyName(e.target.value)}
              placeholder="Acme Security Ltd"
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Email Address</label>
            <input
              type="email" required autoComplete="email"
              value={email} onChange={e => setEmail(e.target.value)}
              placeholder="admin@yourcompany.com"
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'} required autoComplete="new-password"
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="At least 10 characters"
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 pr-12 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              />
              <button type="button" onClick={() => setShowPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 p-1">
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {password.length > 0 && (
              <div className="mt-2">
                <div className="flex gap-1 mb-1">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= strength.score ? strength.color : 'bg-gray-800'}`} />
                  ))}
                </div>
                <p className="text-xs text-gray-500">{strength.label}</p>
              </div>
            )}
          </div>

          {/* Tier Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Plan</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setTierOpen(v => !v)}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white text-left flex items-center justify-between hover:border-gray-600 transition-colors"
              >
                <div>
                  <span className="font-medium">{selectedTier.label}</span>
                  <span className="text-gray-500 text-sm ml-3">up to {selectedTier.guards} guards</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-blue-400 text-sm font-medium">{selectedTier.price}</span>
                  <ChevronDown size={16} className={`text-gray-500 transition-transform ${tierOpen ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {tierOpen && (
                <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-700 rounded-xl overflow-hidden shadow-2xl">
                  {TIERS.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => { setTier(t.id); setTierOpen(false) }}
                      className={`w-full px-4 py-3 flex items-center justify-between hover:bg-gray-800 transition-colors text-sm ${t.id === tier ? 'bg-gray-800' : ''}`}
                    >
                      <div className="text-left">
                        <p className="text-white font-medium">{t.label}</p>
                        <p className="text-gray-500 text-xs">up to {t.guards} guards · {t.priceNote}</p>
                      </div>
                      <span className="text-blue-400 font-medium ml-4">{t.price}</span>
                    </button>
                  ))}
                </div>
              )}
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
                <button type="button" onClick={refreshCaptcha} className="text-gray-500 hover:text-gray-300 ml-2" title="New question">
                  <RefreshCw size={14} />
                </button>
              </div>
              <input
                type="number" required
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
            {loading ? <><Loader size={18} className="animate-spin" /> Creating account...</> : 'Start Free Trial'}
          </button>

          <div className="text-center pt-1">
            <span className="text-gray-600 text-sm">Already have an account? </span>
            <Link to="/login" className="text-blue-400 hover:text-blue-300 text-sm transition-colors">
              Sign in
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
