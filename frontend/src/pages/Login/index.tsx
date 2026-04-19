import { useState, useEffect } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
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

// Google & Microsoft SVG wordmark icons (inline, no external dependency)
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

function MicrosoftIcon() {
  return (
    <svg viewBox="0 0 21 21" className="w-4 h-4" aria-hidden="true">
      <rect x="1"  y="1"  width="9" height="9" fill="#F25022"/>
      <rect x="11" y="1"  width="9" height="9" fill="#7FBA00"/>
      <rect x="1"  y="11" width="9" height="9" fill="#00A4EF"/>
      <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
    </svg>
  )
}

export default function Login() {
  const navigate        = useNavigate()
  const setAuth         = useAuthStore(s => s.setAuth)
  const [searchParams]  = useSearchParams()

  const [email,        setEmail]        = useState('')
  const [password,     setPassword]     = useState('')
  const [showPass,     setShowPass]     = useState(false)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')
  const [captcha,      setCaptcha]      = useState(makeCaptcha)
  const [captchaInput, setCaptchaInput] = useState('')
  const [captchaError, setCaptchaError] = useState(false)
  const [ssoConfig,    setSsoConfig]    = useState<{ google: boolean; microsoft: boolean } | null>(null)
  const [ssoLoading,   setSsoLoading]   = useState<'google' | 'microsoft' | null>(null)

  // 2FA step
  const [twoFaMode,     setTwoFaMode]     = useState(false)
  const [partialToken,  setPartialToken]  = useState('')
  const [twoFaCode,     setTwoFaCode]     = useState('')
  const [twoFaLoading,  setTwoFaLoading]  = useState(false)

  // Consume OAuth callback params: ?token=...&user=... or ?error=...
  useEffect(() => {
    const oauthToken = searchParams.get('token')
    const oauthUser  = searchParams.get('user')
    const oauthError = searchParams.get('error')

    if (oauthError) {
      setError(oauthError)
      // Clear params so refresh doesn't replay the error
      window.history.replaceState({}, '', '/login')
      return
    }

    if (oauthToken && oauthUser) {
      try {
        const admin = JSON.parse(decodeURIComponent(oauthUser))
        setAuth(oauthToken, admin)
        window.history.replaceState({}, '', '/login')
        navigate('/', { replace: true })
      } catch {
        setError('SSO sign-in failed — malformed response. Please try again.')
        window.history.replaceState({}, '', '/login')
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch which SSO providers are configured
  useEffect(() => {
    adminAuthApi.ssoConfig()
      .then(setSsoConfig)
      .catch(() => setSsoConfig({ google: false, microsoft: false }))
  }, [])

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
      const result = await adminAuthApi.login(email, password)
      if (result.requires_2fa) {
        setPartialToken(result.partial_token)
        setTwoFaMode(true)
        setError('')
      } else {
        setAuth(result.token, result.admin)
        navigate('/', { replace: true })
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed. Please check your credentials.')
      refreshCaptcha()
    } finally {
      setLoading(false)
    }
  }

  const handleTwoFa = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setTwoFaLoading(true)
    try {
      const { token, admin } = await adminAuthApi.twoFaValidate(partialToken, twoFaCode)
      setAuth(token, admin)
      navigate('/', { replace: true })
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid code. Please try again.')
      setTwoFaCode('')
    } finally {
      setTwoFaLoading(false)
    }
  }

  const handleSSO = (provider: 'google' | 'microsoft') => {
    setSsoLoading(provider)
    adminAuthApi.ssoRedirect(provider)
    // setSsoLoading stays set — page will navigate away
  }

  const showSso = ssoConfig && (ssoConfig.google || ssoConfig.microsoft)

  if (twoFaMode) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-10">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-xl">
              <Shield size={32} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Two-Factor Auth</h1>
            <p className="text-gray-500 text-sm mt-1">Enter the code from your authenticator app</p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 flex items-center gap-2 text-sm mb-4">
              <AlertCircle size={16} className="shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleTwoFa} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Authentication Code</label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                maxLength={8}
                value={twoFaCode}
                onChange={e => setTwoFaCode(e.target.value.replace(/[^0-9A-Fa-f-]/g, ''))}
                placeholder="000000 or XXXXXX-XXXXXX"
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white text-center text-xl tracking-widest placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                autoFocus
              />
              <p className="text-gray-600 text-xs mt-1.5">Enter the 6-digit code, or a backup code (XXXXXX-XXXXXX)</p>
            </div>

            <button type="submit" disabled={twoFaLoading || twoFaCode.length < 6}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl py-3.5 flex items-center justify-center gap-2 transition-colors">
              {twoFaLoading ? <><Loader size={18} className="animate-spin" /> Verifying...</> : 'Verify'}
            </button>

            <button type="button" onClick={() => { setTwoFaMode(false); setError(''); setTwoFaCode('') }}
              className="w-full text-gray-500 hover:text-gray-300 text-sm py-2 transition-colors">
              ← Back to login
            </button>
          </form>
        </div>
      </div>
    )
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

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 flex items-center gap-2 text-sm mb-4">
            <AlertCircle size={16} className="shrink-0" />
            {error}
          </div>
        )}

        {/* SSO buttons — shown only when at least one provider is configured */}
        {showSso && (
          <div className="space-y-2.5 mb-6">
            {ssoConfig!.google && (
              <button
                type="button"
                onClick={() => handleSSO('google')}
                disabled={!!ssoLoading}
                className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 disabled:opacity-60 text-gray-800 font-medium rounded-xl py-3 px-4 border border-gray-200 transition-colors"
              >
                {ssoLoading === 'google'
                  ? <Loader size={16} className="animate-spin text-gray-500" />
                  : <GoogleIcon />}
                Continue with Google
              </button>
            )}
            {ssoConfig!.microsoft && (
              <button
                type="button"
                onClick={() => handleSSO('microsoft')}
                disabled={!!ssoLoading}
                className="w-full flex items-center justify-center gap-3 bg-[#2f2f2f] hover:bg-[#404040] disabled:opacity-60 text-white font-medium rounded-xl py-3 px-4 transition-colors"
              >
                {ssoLoading === 'microsoft'
                  ? <Loader size={16} className="animate-spin text-gray-400" />
                  : <MicrosoftIcon />}
                Continue with Microsoft
              </button>
            )}

            {/* Divider */}
            <div className="flex items-center gap-3 pt-1">
              <div className="flex-1 h-px bg-gray-800" />
              <span className="text-gray-600 text-xs font-medium">or sign in with password</span>
              <div className="flex-1 h-px bg-gray-800" />
            </div>
          </div>
        )}

        {/* Password form */}
        <form onSubmit={handleLogin} className="space-y-4">
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
