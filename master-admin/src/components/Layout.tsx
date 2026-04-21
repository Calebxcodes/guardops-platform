import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { LayoutDashboard, Building2, CreditCard, Flag, Users, LogOut, Shield } from 'lucide-react'
import clsx from 'clsx'

const nav = [
  { to: '/',          label: 'Dashboard', icon: LayoutDashboard },
  { to: '/tenants',   label: 'Tenants',   icon: Building2 },
  { to: '/payments',  label: 'Payments',  icon: CreditCard },
  { to: '/flags',     label: 'Flags',     icon: Flag },
  { to: '/users',     label: 'Admins',    icon: Users },
]

export default function Layout() {
  const { name, role, logout } = useAuthStore()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="px-4 py-5 border-b border-gray-800 flex items-center gap-2">
          <Shield className="text-blue-400" size={20} />
          <span className="font-bold text-white text-sm tracking-wide">Strondis Admin</span>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                )
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
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

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
