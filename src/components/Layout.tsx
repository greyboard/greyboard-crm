import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, Settings, FileText, Users } from 'lucide-react'

const today = new Date().toLocaleDateString('de-DE', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
})

const navCls = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
    isActive
      ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
      : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
  }`

export function Layout() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans transition-colors duration-200">
      <header className="border-b border-zinc-200 dark:border-zinc-800/60 bg-white/80 dark:bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-white">G</span>
              </div>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">Greyboard CRM</span>
            </div>

            <span className="text-zinc-200 dark:text-zinc-700">|</span>

            <nav className="flex items-center gap-1">
              <NavLink to="/" end className={navCls}>
                <LayoutDashboard size={14} />
                Dashboard
              </NavLink>
              <NavLink to="/kontakte" className={navCls}>
                <Users size={14} />
                Kontakte
              </NavLink>
              <NavLink to="/templates" className={navCls}>
                <FileText size={14} />
                Templates
              </NavLink>
              <NavLink to="/einstellungen" className={navCls}>
                <Settings size={14} />
                Einstellungen
              </NavLink>
            </nav>
          </div>

          <p className="text-xs text-zinc-400 dark:text-zinc-600 hidden sm:block">{today}</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}
