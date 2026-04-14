import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { authApi } from './api'
import CookieConsent from './components/CookieConsent'
import PWAPermissions from './components/PWAPermissions'
import AppShell from './components/layout/AppShell'
import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import Schedule from './pages/Schedule'
import Timesheet from './pages/Timesheet'
import MapPage from './pages/Map'
import Messages from './pages/Messages'
import Incidents from './pages/Incidents'
import Profile from './pages/Profile'

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
  const token      = useAuthStore(s => s.token)
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
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="schedule" element={<Schedule />} />
          <Route path="timesheet" element={<Timesheet />} />
          <Route path="map" element={<MapPage />} />
          <Route path="messages" element={<Messages />} />
          <Route path="incidents" element={<Incidents />} />
          <Route path="profile" element={<Profile />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
