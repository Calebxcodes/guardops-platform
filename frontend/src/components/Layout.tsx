import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, MapPin, Calendar, ClipboardList,
  DollarSign, BarChart2, AlertTriangle, Settings, Shield,
  Menu, X, ShieldCheck, ExternalLink, LogOut
} from 'lucide-react'
import { useState } from 'react'
import clsx from 'clsx'
import { useAuthStore } from '../store/authStore'

const nav = [
  { to: '/',           label: 'Dashboard',      icon: LayoutDashboard, end: true },
  { to: '/guards',     label: 'Officers',        icon: Users },
  { to: '/sites',      label: 'Sites & Clients', icon: MapPin },
  { to: '/scheduling', label: 'Scheduling',      icon: Calendar },
  { to: '/timesheets', label: 'Timesheets',      icon: ClipboardList },
  { to: '/payroll',    label: 'Payroll',         icon: DollarSign },
  { to: '/financial',  label: 'Financial',       icon: BarChart2 },
  { to: '/incidents',  label: 'Incidents',       icon: AlertTriangle },
  { to: '/compliance', label: 'SIA Compliance',  icon: ShieldCheck },
  { to: '/portal',     label: 'Client Portal',   icon: ExternalLink },
  { to: '/settings',   label: 'Settings',        icon: Settings },
]

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const { admin, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className={clsx(
        'flex flex-col bg-gray-900 text-white transition-all duration-200 shrink-0',
        sidebarOpen ? 'w-56' : 'w-16'
      )}>
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 h-16 border-b border-gray-800">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
            <Shield size={16} className="text-white" />
          </div>
          {sidebarOpen && (
            <div className="min-w-0">
              <div className="font-bold text-sm leading-none text-white tracking-tight">SecureEdge</div>
              <div className="text-gray-500 text-xs mt-0.5">Operations Platform</div>
            </div>
          )}
          <button
            className="ml-auto text-gray-400 hover:text-white shrink-0"
            onClick={() => setSidebarOpen(v => !v)}
          >
            {sidebarOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 space-y-0.5 overflow-y-auto">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => clsx(
                'flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors rounded-none',
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              )}
            >
              <Icon size={17} className="shrink-0" />
              {sidebarOpen && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-800">
          {sidebarOpen ? (
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs text-gray-500 min-w-0">
                <div className="font-medium text-gray-300 truncate">{admin?.name || 'Admin'}</div>
                <div className="truncate">{admin?.email}</div>
              </div>
              <button onClick={handleLogout} title="Sign out"
                className="text-gray-500 hover:text-red-400 transition-colors shrink-0">
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button onClick={handleLogout} title="Sign out"
              className="w-7 h-7 bg-blue-600 hover:bg-red-600 rounded-full flex items-center justify-center text-xs font-bold transition-colors">
              A
            </button>
          )}
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
