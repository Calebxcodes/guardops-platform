import { NavLink } from 'react-router-dom'
import { Home, Calendar, ClipboardList, Map, MessageCircle, User } from 'lucide-react'
import clsx from 'clsx'

const tabs = [
  { to: '/',          icon: Home,          label: 'Home' },
  { to: '/schedule',  icon: Calendar,      label: 'Schedule' },
  { to: '/timesheet', icon: ClipboardList, label: 'Timesheet' },
  { to: '/map',       icon: Map,           label: 'Map' },
  { to: '/messages',  icon: MessageCircle, label: 'Messages' },
  { to: '/profile',   icon: User,          label: 'Me' },
]

export default function TabBar() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-surface-card border-t border-white/5 safe-area-pb">
      <div className="flex">
        {tabs.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => clsx(
              'flex-1 flex flex-col items-center py-2 gap-0.5 transition-colors',
              isActive ? 'text-brand-400' : 'text-white/40 hover:text-white/70'
            )}
          >
            {({ isActive }) => <>
              <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
              <span className="text-[10px] font-medium">{label}</span>
            </>}
          </NavLink>
        ))}
      </div>
      {/* iPhone home indicator space */}
      <div className="h-safe-area-inset-bottom" />
    </nav>
  )
}
