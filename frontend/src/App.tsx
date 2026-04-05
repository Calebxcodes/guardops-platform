import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public client portal — no auth needed */}
        <Route path="/portal/:token" element={<PortalView />} />

        {/* Admin CRM */}
        <Route path="/" element={<Layout />}>
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
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
