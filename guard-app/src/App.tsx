import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { authApi } from './api'
import CookieConsent from './components/CookieConsent'
import PWAPermissions from './components/PWAPermissions'
import AppShell from './components/layout/AppShell'

// Lazy-load all pages — each becomes its own JS chunk
const Login          = lazy(() => import('./pages/Login'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword  = lazy(() => import('./pages/ResetPassword'))
const Dashboard      = lazy(() => import('./pages/Dashboard'))
const Schedule       = lazy(() => import('./pages/Schedule'))
const Timesheet      = lazy(() => import('./pages/Timesheet'))
const MapPage        = lazy(() => import('./pages/Map'))
const Messages       = lazy(() => import('./pages/Messages'))
const Incidents      = lazy(() => import('./pages/Incidents'))
const Profile        = lazy(() => import('./pages/Profile'))
const DocumentsPage  = lazy(() => import('./pages/Documents'))

// Minimal spinner — matches the dark app theme
function PageLoader() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

/** Listen for PUSH_NAVIGATE messages from the service worker */
function PushNavigationListener() {
  const navigate = useNavigate()
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'PUSH_NAVIGATE' && event.data?.url) {
        navigate(event.data.url, { replace: false })
      }
    }
    navigator.serviceWorker?.addEventListener('message', handler)
    return () => navigator.serviceWorker?.removeEventListener('message', handler)
  }, [navigate])
  return null
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token       = useAuthStore(s => s.token)
  const updateGuard = useAuthStore(s => s.updateGuard)

  // Refresh guard data on every app load so has_face_id stays in sync with the DB
  useEffect(() => {
    if (!token) return
    authApi.me().then(fresh => updateGuard(fresh)).catch(() => {})
  }, [token])

  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <PushNavigationListener />
      <CookieConsent />
      <PWAPermissions />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login"           element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password"  element={<ResetPassword />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <AppShell />
              </RequireAuth>
            }
          >
            <Route index                 element={<Dashboard />} />
            <Route path="schedule"       element={<Schedule />} />
            <Route path="timesheet"      element={<Timesheet />} />
            <Route path="map"            element={<MapPage />} />
            <Route path="messages"       element={<Messages />} />
            <Route path="incidents"      element={<Incidents />} />
            <Route path="documents"      element={<DocumentsPage />} />
            <Route path="profile"        element={<Profile />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
