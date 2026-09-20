import { NavLink, Outlet } from 'react-router-dom'
import { Settings, Layers, Zap, Sun, Moon, ListTodo, LogOut, BarChart3 } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'

const navItems = [
  { to: '/dashboard',  label: 'Dashboard', icon: BarChart3 },
  { to: '/tasks',      label: 'My Tasks',  icon: ListTodo },
  { to: '/batch-run',  label: 'Batch Run', icon: Layers },
  { to: '/settings',   label: 'Settings',  icon: Settings },
]

export default function Layout() {
  const { dark, toggle } = useTheme()
  const { user, logout } = useAuth()

  return (
    <div className="h-screen flex bg-[var(--bg-base)] overflow-hidden">
      {/* Sidebar */}
      <nav className="w-56 shrink-0 border-r border-slate-200 dark:border-stone-700/50 flex flex-col bg-[var(--bg-surface)] h-full overflow-hidden">

        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-slate-200 dark:border-stone-700/40">
          <div className="w-8 h-8 rounded-xl bg-[#DA7756]/15 border border-[#DA7756]/30 flex items-center justify-center">
            <Zap size={15} className="text-[#DA7756]" />
          </div>
          <div>
            <p className="text-[14px] font-bold text-slate-900 dark:text-slate-100 leading-tight">DevAgent</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">AI Development Platform</p>
          </div>
        </div>

        {/* Nav */}
        <div className="flex-1 px-3 py-3 space-y-0.5">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-[#DA7756]/10 text-[#DA7756] dark:text-[#E8A080] border border-[#DA7756]/20'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-stone-800/60 border border-transparent'
                }`
              }
            >
              <Icon size={15} />
              {label}
            </NavLink>
          ))}
        </div>

        {/* Footer */}
        <div className="px-3 py-3 border-t border-slate-200 dark:border-stone-700/40 space-y-0.5">
          <button
            onClick={toggle}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-[12px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-stone-800/60 transition-all"
          >
            {dark
              ? <><Sun size={14} className="text-amber-400" /> Light mode</>
              : <><Moon size={14} className="text-[#DA7756]" /> Dark mode</>
            }
          </button>
          <button
            onClick={logout}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-[12px] font-medium text-slate-500 dark:text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
          >
            <LogOut size={14} /> Sign out
          </button>
          {user && (
            <p className="text-[10px] text-slate-400 dark:text-slate-600 px-3 pt-1 truncate">{user.email}</p>
          )}
        </div>
      </nav>

      {/* Main */}
      <main className="flex-1 overflow-auto bg-[var(--bg-base)]">
        <div className="max-w-4xl mx-auto px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
