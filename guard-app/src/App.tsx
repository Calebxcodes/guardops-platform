import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import AppShell from './components/layout/AppShell'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Schedule from './pages/Schedule'
import Timesheet from './pages/Timesheet'
import MapPage from './pages/Map'
import Messages from './pages/Messages'
import Incidents from './pages/Incidents'
import Profile from './pages/Profile'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuthStore(s => s.token)
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
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
