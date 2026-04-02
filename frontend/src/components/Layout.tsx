import { NavLink, Outlet } from 'react-router-dom'
import {
  LayoutDashboard, Users, MapPin, Calendar, ClipboardList,
  DollarSign, BarChart2, AlertTriangle, Settings, Shield, Menu, X
} from 'lucide-react'
import { useState } from 'react'
import clsx from 'clsx'

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/guards', label: 'Guards', icon: Users },
  { to: '/sites', label: 'Sites & Clients', icon: MapPin },
  { to: '/scheduling', label: 'Scheduling', icon: Calendar },
  { to: '/timesheets', label: 'Timesheets', icon: ClipboardList },
  { to: '/payroll', label: 'Payroll', icon: DollarSign },
  { to: '/financial', label: 'Financial', icon: BarChart2 },
  { to: '/incidents', label: 'Incidents', icon: AlertTriangle },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className={clsx(
        'flex flex-col bg-gray-900 text-white transition-all duration-200 shrink-0',
        sidebarOpen ? 'w-56' : 'w-16'
      )}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-16 border-b border-gray-800">
          <Shield className="text-blue-400 shrink-0" size={24} />
          {sidebarOpen && (
            <span className="font-bold text-lg tracking-tight">GuardOps</span>
          )}
          <button
            className="ml-auto text-gray-400 hover:text-white"
            onClick={() => setSidebarOpen(v => !v)}
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 space-y-0.5 overflow-y-auto">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => clsx(
                'flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              )}
            >
              <Icon size={18} className="shrink-0" />
              {sidebarOpen && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-800">
          {sidebarOpen ? (
            <div className="text-xs text-gray-500">
              <div className="font-medium text-gray-300">Admin User</div>
              <div>admin@guardops.com</div>
            </div>
          ) : (
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-xs font-bold">
              A
            </div>
          )}
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
