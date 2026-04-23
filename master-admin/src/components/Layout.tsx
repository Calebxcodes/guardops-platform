import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { LayoutDashboard, Building2, CreditCard, Flag, Users, LogOut, Shield, Menu, X } from 'lucide-react'
import clsx from 'clsx'

const nav = [
  { to: '/',         label: 'Dashboard', icon: LayoutDashboard },
  { to: '/tenants',  label: 'Tenants',   icon: Building2 },
  { to: '/payments', label: 'Payments',  icon: CreditCard },
  { to: '/flags',    label: 'Flags',     icon: Flag },
  { to: '/users',    label: 'Admins',    icon: Users },
]

function NavItem({ to, label, icon: Icon, onClick }: { to: string; label: string; icon: React.ElementType; onClick?: () => void }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      onClick={onClick}
      className={({ isActive }) =>
        clsx(
          'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
          isActive ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
        )
      }
    >
      <Icon size={16} />
      {label}
    </NavLink>
  )
}

export default function Layout() {
  const { name, role, logout } = useAuthStore()
  const navigate = useNavigate()
  const [drawerOpen, setDrawerOpen] = useState(false)

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100">

      {/* ── Desktop sidebar (md+) ──────────────────────────────── */}
      <aside className="hidden md:flex w-56 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex-col">
        <div className="px-4 py-5 border-b border-gray-800 flex items-center gap-2">
          <Shield className="text-blue-400" size={20} />
          <span className="font-bold text-white text-sm tracking-wide">Strondis Admin</span>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {nav.map(item => <NavItem key={item.to} {...item} />)}
        </nav>

        <div className="p-3 border-t border-gray-800">
          <div className="px-3 py-2 text-xs text-gray-500 mb-1 truncate">{name}</div>
          <div className="px-3 mb-2">
            <span className="text-xs bg-blue-900 text-blue-300 px-2 py-0.5 rounded">{role}</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </aside>

      {/* ── Mobile header bar ─────────────────────────────────── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-2">
          <Shield className="text-blue-400" size={18} />
          <span className="font-bold text-white text-sm tracking-wide">Strondis Admin</span>
        </div>
        <button
          onClick={() => setDrawerOpen(true)}
          className="text-gray-400 hover:text-white p-1"
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>
      </div>

      {/* ── Mobile drawer overlay ─────────────────────────────── */}
      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* ── Mobile drawer panel ───────────────────────────────── */}
      <aside className={clsx(
        'md:hidden fixed top-0 left-0 bottom-0 z-50 w-64 bg-gray-900 border-r border-gray-800 flex flex-col transition-transform duration-300',
        drawerOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="px-4 py-5 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="text-blue-400" size={20} />
            <span className="font-bold text-white text-sm tracking-wide">Strondis Admin</span>
          </div>
          <button onClick={() => setDrawerOpen(false)} className="text-gray-500 hover:text-white p-1">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {nav.map(item => <NavItem key={item.to} {...item} onClick={() => setDrawerOpen(false)} />)}
        </nav>

        <div className="p-3 border-t border-gray-800">
          <div className="px-3 py-2 text-xs text-gray-500 mb-1 truncate">{name}</div>
          <div className="px-3 mb-2">
            <span className="text-xs bg-blue-900 text-blue-300 px-2 py-0.5 rounded">{role}</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────────── */}
      <main className="flex-1 overflow-auto md:pt-0 pt-14 pb-16 md:pb-0">
        <Outlet />
      </main>

      {/* ── Mobile bottom nav ─────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-gray-900 border-t border-gray-800 flex">
        {nav.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              clsx(
                'flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs transition-colors',
                isActive ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'
              )
            }
          >
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
