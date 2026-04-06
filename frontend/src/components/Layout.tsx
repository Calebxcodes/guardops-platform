import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, MapPin, Calendar, ClipboardList,
  DollarSign, BarChart2, AlertTriangle, Settings, Shield,
  ShieldCheck, ExternalLink, LogOut, Menu, X
} from 'lucide-react'
import { useState, useEffect } from 'react'
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

// Bottom nav shows only the most used items on mobile
const mobileNav = nav.slice(0, 5)

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { admin, logout } = useAuthStore()
  const navigate = useNavigate()

  // Close mobile menu on resize to desktop
  useEffect(() => {
    const handler = () => { if (window.innerWidth >= 1024) setMobileMenuOpen(false) }
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">

      {/* ── Desktop sidebar ─────────────────────────────────────── */}
      <aside className={clsx(
        'hidden lg:flex flex-col bg-gray-900 text-white transition-all duration-200 shrink-0',
        sidebarOpen ? 'w-56' : 'w-16'
      )}>
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 h-16 border-b border-gray-800 shrink-0">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
            <Shield size={16} className="text-white" />
          </div>
          {sidebarOpen && (
            <div className="min-w-0 flex-1">
              <div className="font-bold text-sm leading-none text-white tracking-tight">Strondis</div>
              <div className="text-gray-500 text-xs mt-0.5">Operations Platform</div>
            </div>
          )}
          <button
            className="ml-auto text-gray-400 hover:text-white shrink-0 p-1 rounded"
            onClick={() => setSidebarOpen(v => !v)}
          >
            {sidebarOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 space-y-0.5 overflow-y-auto">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to} to={to} end={end}
              className={({ isActive }) => clsx(
                'flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors',
                isActive ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              )}
            >
              <Icon size={17} className="shrink-0" />
              {sidebarOpen && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-800 shrink-0">
          {sidebarOpen ? (
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs text-gray-500 min-w-0">
                <div className="font-medium text-gray-300 truncate">{admin?.name || 'Admin'}</div>
                <div className="truncate">{admin?.email}</div>
              </div>
              <button onClick={handleLogout} title="Sign out"
                className="text-gray-500 hover:text-red-400 transition-colors shrink-0 p-1">
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button onClick={handleLogout} title="Sign out"
              className="w-8 h-8 bg-blue-600 hover:bg-red-600 rounded-full flex items-center justify-center text-xs font-bold transition-colors mx-auto">
              {admin?.name?.[0] || 'A'}
            </button>
          )}
        </div>
      </aside>

      {/* ── Mobile / tablet overlay menu ────────────────────────── */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          {/* Drawer */}
          <aside className="relative w-72 max-w-[85vw] bg-gray-900 text-white flex flex-col h-full shadow-2xl animate-slide-in-left">
            {/* Header */}
            <div className="flex items-center justify-between px-5 h-16 border-b border-gray-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Shield size={16} className="text-white" />
                </div>
                <div>
                  <div className="font-bold text-sm text-white">Strondis</div>
                  <div className="text-gray-500 text-xs">Operations Platform</div>
                </div>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="text-gray-400 hover:text-white p-1">
                <X size={20} />
              </button>
            </div>

            {/* Nav */}
            <nav className="flex-1 py-3 space-y-0.5 overflow-y-auto">
              {nav.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to} to={to} end={end}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) => clsx(
                    'flex items-center gap-3 px-5 py-3 text-sm font-medium transition-colors',
                    isActive ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  )}
                >
                  <Icon size={18} className="shrink-0" />
                  <span>{label}</span>
                </NavLink>
              ))}
            </nav>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-gray-800 shrink-0">
              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-500">
                  <div className="font-medium text-gray-300">{admin?.name || 'Admin'}</div>
                  <div className="truncate max-w-[180px]">{admin?.email}</div>
                </div>
                <button onClick={handleLogout}
                  className="flex items-center gap-1.5 text-gray-500 hover:text-red-400 text-xs transition-colors">
                  <LogOut size={15} /> Sign out
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* ── Main content area ────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center justify-between px-4 h-14 bg-white border-b border-gray-200 shrink-0">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
              <Shield size={14} className="text-white" />
            </div>
            <span className="font-bold text-sm text-gray-900">Strondis</span>
          </div>
          <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded-lg">
            <LogOut size={18} />
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 flex items-center justify-around px-2 h-16 safe-area-pb">
          {mobileNav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to} to={to} end={end}
              className={({ isActive }) => clsx(
                'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors min-w-0',
                isActive ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
              )}
            >
              <Icon size={20} />
              <span className="text-[10px] font-medium truncate">{label}</span>
            </NavLink>
          ))}
          {/* "More" button opens full drawer */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="flex flex-col items-center gap-0.5 px-3 py-1.5 text-gray-400 hover:text-gray-600 rounded-xl"
          >
            <Menu size={20} />
            <span className="text-[10px] font-medium">More</span>
          </button>
        </nav>
      </div>
    </div>
  )
}
