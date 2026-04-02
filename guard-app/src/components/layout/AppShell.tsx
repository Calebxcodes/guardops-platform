import { Outlet } from 'react-router-dom'
import TabBar from './TabBar'

export default function AppShell() {
  return (
    <div className="min-h-screen bg-surface text-white flex flex-col max-w-lg mx-auto relative">
      <main className="flex-1 pb-20 overflow-y-auto">
        <Outlet />
      </main>
      <TabBar />
    </div>
  )
}
