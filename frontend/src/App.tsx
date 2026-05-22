import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { useTenantStore } from './store/tenantStore'
import { getSubdomainSlug } from './utils/tenantDetection'
import CookieConsent from './components/CookieConsent'
import Chatbot from './components/Chatbot'

// Eagerly load Layout — it's the app shell, needed immediately after login
import Layout from './components/Layout'

// Lazy-load every page so each route is a separate chunk.
// The login page is the most common cold-start; keep it in a tiny first bundle.
const Login           = lazy(() => import('./pages/Login'))
const Signup          = lazy(() => import('./pages/Signup'))
const ForgotPassword  = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword   = lazy(() => import('./pages/ResetPassword'))
const PortalView      = lazy(() => import('./pages/ClientPortal/PortalView'))
const Dashboard       = lazy(() => import('./pages/Dashboard'))
const Guards          = lazy(() => import('./pages/Guards'))
const Sites           = lazy(() => import('./pages/Sites'))
const Scheduling      = lazy(() => import('./pages/Scheduling'))
const Timesheets      = lazy(() => import('./pages/Timesheets'))
const Payroll         = lazy(() => import('./pages/Payroll'))
const Financial       = lazy(() => import('./pages/Financial'))
const Incidents       = lazy(() => import('./pages/Incidents'))
const Settings        = lazy(() => import('./pages/Settings'))
const Compliance      = lazy(() => import('./pages/Compliance'))
const ClientPortalAdmin = lazy(() => import('./pages/ClientPortal'))
const Messages        = lazy(() => import('./pages/Messages'))
const Analytics       = lazy(() => import('./pages/Analytics'))
const Documents       = lazy(() => import('./pages/Documents'))
const Notifications   = lazy(() => import('./pages/Notifications'))
const AcceptInvite    = lazy(() => import('./pages/AcceptInvite'))
const SettingsUsers   = lazy(() => import('./pages/Settings/Users'))
const HR              = lazy(() => import('./pages/HR'))
const GuardBadges     = lazy(() => import('./pages/HR/Badges'))

// Full-screen spinner shown while a lazy chunk is loading
function PageLoader() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function CompanyNotFound() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl font-black text-blue-400">S</span>
        </div>
        <h1 className="text-white text-xl font-semibold">Company not found</h1>
        <p className="text-gray-400 text-sm mt-2">
          This URL is not associated with any company on Strondis.
        </p>
        <p className="text-gray-600 text-xs mt-4">
          If you have an account, check your invitation email for the correct link.
        </p>
      </div>
    </div>
  )
}

function TenantGuard({ children }: { children: React.ReactNode }) {
  const setTenant = useTenantStore(s => s.setTenant)
  const { token, admin, logout } = useAuthStore()
  const [status, setStatus] = useState<'loading' | 'ready' | 'not-found'>('loading')

  useEffect(() => {
    const slug = getSubdomainSlug()

    if (!slug) {
      // localhost without VITE_DEV_TENANT_SLUG — skip tenant enforcement in dev
      setStatus('ready')
      return
    }

    const apiBase = import.meta.env.VITE_API_URL
      ? `${import.meta.env.VITE_API_URL}/api`
      : '/api'

    fetch(`${apiBase}/tenant/by-slug/${encodeURIComponent(slug)}`)
      .then(r => {
        if (!r.ok) throw new Error('not-found')
        return r.json()
      })
      .then(data => {
        setTenant({ id: Number(data.id), name: data.name, slug: data.slug })
        // Q4: If stored JWT belongs to a different tenant, force re-login
        if (token && admin?.tenantId && Number(admin.tenantId) !== Number(data.id)) {
          logout()
        }
        setStatus('ready')
      })
      .catch(() => setStatus('not-found'))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (status === 'loading') return <PageLoader />
  if (status === 'not-found') return <CompanyNotFound />
  return <>{children}</>
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore(s => s.token)
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <TenantGuard>
      <CookieConsent />
      <Chatbot />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public routes */}
          <Route path="/login"           element={<Login />} />
          <Route path="/signup"          element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password"  element={<ResetPassword />} />
          <Route path="/portal/:token"   element={<PortalView />} />
          <Route path="/accept-invite"   element={<AcceptInvite />} />

          {/* Protected admin CRM */}
          <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index                  element={<Dashboard />} />
            <Route path="guards"          element={<Guards />} />
            <Route path="sites"           element={<Sites />} />
            <Route path="scheduling"      element={<Scheduling />} />
            <Route path="timesheets"      element={<Timesheets />} />
            <Route path="payroll"         element={<Payroll />} />
            <Route path="financial"       element={<Financial />} />
            <Route path="analytics"       element={<Analytics />} />
            <Route path="incidents"       element={<Incidents />} />
            <Route path="compliance"      element={<Compliance />} />
            <Route path="portal"          element={<ClientPortalAdmin />} />
            <Route path="messages"        element={<Messages />} />
            <Route path="documents"       element={<Documents />} />
            <Route path="notifications"   element={<Notifications />} />
            <Route path="hr"              element={<HR />} />
            <Route path="hr/badges"       element={<GuardBadges />} />
            <Route path="settings"        element={<Settings />} />
            <Route path="settings/users"  element={<SettingsUsers />} />
          </Route>
        </Routes>
      </Suspense>
      </TenantGuard>
    </BrowserRouter>
  )
}
