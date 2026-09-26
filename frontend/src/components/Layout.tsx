import { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Settings, Zap, Sun, Moon, ListTodo, LogOut, BarChart3, ChevronDown, Building2, User, Activity } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'

const navItems = [
  { to: '/dashboard',  label: 'Dashboard', icon: BarChart3 },
  { to: '/tasks',      label: 'My Tasks',  icon: ListTodo },
  { to: '/settings',   label: 'Settings',  icon: Settings },
]

function ProgressNavItem() {
  const navigate = useNavigate()
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)

  useEffect(() => {
    const check = () => setActiveTaskId(localStorage.getItem('cc_active_task'))
    check()
    const interval = setInterval(check, 3000)
    return () => clearInterval(interval)
  }, [])

  if (!activeTaskId) return null

  return (
    <button
      onClick={() => navigate(`/tasks/${activeTaskId}/progress`)}
      className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium w-full text-left bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 transition-all hover:bg-emerald-500/15"
    >
      <Activity size={15} className="animate-pulse" /> Progress
    </button>
  )
}

export default function Layout() {
  const { dark, toggle } = useTheme()
  const { user, logout } = useAuth()
  const [showDropdown, setShowDropdown] = useState(false)

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
            <p className="text-[14px] font-bold text-slate-900 dark:text-slate-100 leading-tight">AI DevAgent</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Agentic AI Platform</p>
          </div>
        </div>

        {/* Nav */}
        <div className="flex-1 px-3 py-3 space-y-0.5">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-[#DA7756]/10 text-[#DA7756] dark:text-[#E8A080] border border-[#DA7756]/20'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-stone-800/60 border border-transparent'
                }`
              }>
              <Icon size={15} />{label}
            </NavLink>
          ))}

          {/* Progress — shows when a task is running */}
          <ProgressNavItem />
        </div>

        {/* Footer — theme only */}
        <div className="px-3 py-3 border-t border-slate-200 dark:border-stone-700/40">
          <button onClick={toggle}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-[12px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-stone-800/60 transition-all">
            {dark ? <><Sun size={14} className="text-amber-400" /> Light mode</> : <><Moon size={14} className="text-[#DA7756]" /> Dark mode</>}
          </button>
        </div>
      </nav>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 shrink-0 border-b border-slate-200 dark:border-stone-700/50 bg-[var(--bg-surface)] flex items-center justify-end px-6">
          <div className="relative">
            <button
              onClick={() => setShowDropdown(d => !d)}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
            >
              {user?.org_name && (
                <span className="flex items-center gap-1 text-[11px] text-slate-400 border-r border-slate-200 dark:border-slate-700 pr-2.5 mr-0.5">
                  <Building2 size={12} /> {user.org_name}
                </span>
              )}
              <div className="w-7 h-7 rounded-full bg-[#DA7756]/15 flex items-center justify-center">
                <span className="text-[11px] font-bold text-[#DA7756]">{user?.name?.charAt(0).toUpperCase()}</span>
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-[12px] font-medium text-slate-700 dark:text-slate-200 leading-tight">{user?.name}</p>
                <p className="text-[10px] text-slate-400">{user?.role}</p>
              </div>
              <ChevronDown size={13} className="text-slate-400" />
            </button>

            {/* Dropdown */}
            {showDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
                <div className="absolute right-0 top-full mt-1 w-56 bg-[var(--bg-card)] border border-slate-200 dark:border-slate-700/50 rounded-xl shadow-xl z-50 py-1.5 animate-slide-in">
                  <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800">
                    <p className="text-[12px] font-medium text-slate-700 dark:text-slate-200">{user?.name}</p>
                    <p className="text-[10px] text-slate-400">{user?.email}</p>
                    {user?.org_name && (
                      <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-1">
                        <Building2 size={10} /> {user.org_name}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => { setShowDropdown(false); logout() }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[12px] font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                  >
                    <LogOut size={14} /> Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto">
          <div className="max-w-5xl mx-auto px-8 py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
