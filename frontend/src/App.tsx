import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import CookieConsent from './components/CookieConsent'

// Eagerly load Layout — it's the app shell, needed immediately after login
import Layout from './components/Layout'

// Lazy-load every page so each route is a separate chunk.
// The login page is the most common cold-start; keep it in a tiny first bundle.
const Login           = lazy(() => import('./pages/Login'))
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

// Full-screen spinner shown while a lazy chunk is loading
function PageLoader() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore(s => s.token)
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <CookieConsent />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public routes */}
          <Route path="/login"           element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password"  element={<ResetPassword />} />
          <Route path="/portal/:token"   element={<PortalView />} />

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
            <Route path="settings"        element={<Settings />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
