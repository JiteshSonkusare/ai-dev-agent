import { Loader2 } from 'lucide-react'

export function Spinner({ className = '' }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} />
}

export function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    running:       'bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-500/30',
    awaiting_gate: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30',
    done:          'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30',
    error:         'bg-red-500/15 text-red-600 dark:text-red-300 border-red-500/30',
    cancelled:     'bg-slate-500/15 text-slate-500 border-slate-400/30',
  }
  const cls = colors[status] ?? 'bg-slate-500/15 text-slate-500 border-slate-400/30'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold tracking-wide border ${cls}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-[var(--bg-card)] border border-slate-200 dark:border-slate-700/50 rounded-xl p-4 ${className}`}>
      {children}
    </div>
  )
}

export function Button({
  children,
  onClick,
  disabled,
  variant = 'primary',
  className = '',
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  variant?: 'primary' | 'secondary' | 'danger'
  className?: string
}) {
  const base = 'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[13px] font-semibold transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed select-none'
  const variants = {
    primary:   'bg-[var(--accent)] hover:bg-[var(--accent-h)] active:bg-[var(--accent-a)] text-white shadow-sm shadow-[rgba(218,119,86,0.2)]',
    secondary: 'bg-slate-100 dark:bg-slate-700/80 hover:bg-slate-200 dark:hover:bg-slate-600/80 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600/50',
    danger:    'bg-red-500/10 dark:bg-red-600/80 hover:bg-red-500/20 dark:hover:bg-red-500 text-red-600 dark:text-white border border-red-400/40 dark:border-red-500/30',
  }
  return (
    <button className={`${base} ${variants[variant]} ${className}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )
}

export function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[12px] font-semibold text-slate-500 dark:text-slate-400 mb-1 tracking-wide">
      {children}
    </label>
  )
}

export function Input({
  value,
  onChange,
  placeholder,
  className = '',
  type = 'text',
  disabled = false,
  onKeyDown,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
  type?: 'text' | 'password' | 'email'
  disabled?: boolean
  onKeyDown?: (e: React.KeyboardEvent) => void
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      disabled={disabled}
      className={`w-full bg-[var(--bg-input)] border border-slate-300 dark:border-slate-600/60 rounded-lg px-3 py-2 text-[13px] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#DA7756] focus:ring-1 focus:ring-[rgba(218,119,86,0.2)] transition-all disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    />
  )
}

export function Textarea({
  value,
  onChange,
  placeholder,
  rows = 4,
  className = '',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
  className?: string
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className={`w-full bg-[var(--bg-input)] border border-slate-300 dark:border-slate-600/60 rounded-lg px-3 py-2 text-[13px] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#DA7756] focus:ring-1 focus:ring-[rgba(218,119,86,0.2)] transition-all resize-vertical ${className}`}
    />
  )
}
