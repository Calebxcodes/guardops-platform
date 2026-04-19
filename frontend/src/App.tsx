import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Guards from './pages/Guards'
import Sites from './pages/Sites'
import Scheduling from './pages/Scheduling'
import Timesheets from './pages/Timesheets'
import Payroll from './pages/Payroll'
import Financial from './pages/Financial'
import Incidents from './pages/Incidents'
import Settings from './pages/Settings'
import Compliance from './pages/Compliance'
import ClientPortalAdmin from './pages/ClientPortal'
import PortalView from './pages/ClientPortal/PortalView'
import Messages from './pages/Messages'
import Analytics from './pages/Analytics'
import Documents from './pages/Documents'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import { useAuthStore } from './store/authStore'
import CookieConsent from './components/CookieConsent'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore(s => s.token)
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <CookieConsent />
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/portal/:token" element={<PortalView />} />

        {/* Protected admin CRM */}
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="guards" element={<Guards />} />
          <Route path="sites" element={<Sites />} />
          <Route path="scheduling" element={<Scheduling />} />
          <Route path="timesheets" element={<Timesheets />} />
          <Route path="payroll" element={<Payroll />} />
          <Route path="financial" element={<Financial />} />
          <Route path="incidents" element={<Incidents />} />
          <Route path="compliance" element={<Compliance />} />
          <Route path="portal" element={<ClientPortalAdmin />} />
          <Route path="messages" element={<Messages />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="documents" element={<Documents />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
