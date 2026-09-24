import { useState, useEffect } from 'react'
import {
  BarChart3, RefreshCw, CheckCircle2, XCircle, AlertTriangle, Pause,
  ListTodo, TrendingUp, Clock, X, Activity,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Area, AreaChart,
} from 'recharts'
import { api } from '../api/client'
import type { DashboardData } from '../api/client'
import { Card } from '../components/ui'

const COLORS = {
  accent:      '#DA7756',
  done:        '#10b981',
  failed:      '#ef4444',
  pending:     '#f59e0b',
  error:       '#f87171',
  interrupted: '#94a3b8',
}

const PIE_COLORS = [COLORS.done, COLORS.failed, COLORS.pending, COLORS.error, COLORS.interrupted]

const STATUS_LABELS: Record<string, string> = {
  done: 'Done', failed: 'Failed', pending: 'Pending', error: 'Error', interrupted: 'Interrupted',
}

type Period = 'day' | 'week' | 'month'

// ── Tooltip ─────────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[var(--bg-card)] border border-slate-200 dark:border-slate-700/50 rounded-lg shadow-xl px-3 py-2.5">
      <p className="text-[11px] font-semibold text-slate-500 mb-1.5">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 text-[11px]">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
          <span className="text-slate-500">{p.name ?? p.dataKey}</span>
          <span className="font-bold text-slate-800 dark:text-slate-100 ml-auto">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

// ── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color, bg, subtitle }: {
  label: string; value: number; icon: typeof CheckCircle2; color: string; bg: string; subtitle?: string
}) {
  return (
    <div className="bg-[var(--bg-card)] border border-slate-200 dark:border-slate-700/40 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
          <Icon size={20} className={color} />
        </div>
        {subtitle && <span className="text-[10px] text-slate-400 font-medium">{subtitle}</span>}
      </div>
      <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 leading-none">{value}</p>
      <p className="text-[12px] font-medium text-slate-500 mt-1.5">{label}</p>
    </div>
  )
}

// ── Format ──────────────────────────────────────────────────────────────────

function fmtDateLabel(dateStr: string, period: Period): string {
  if (period === 'month') {
    const [y, m] = dateStr.split('-')
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${months[parseInt(m) - 1]} ${y.slice(2)}`
  }
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>('day')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  useEffect(() => { loadData() }, [period, fromDate, toDate])

  async function loadData() {
    setLoading(true)
    try {
      setData(await api.getDashboardStats(period, fromDate || undefined, toDate || undefined))
    } catch { setData(null) }
    finally { setLoading(false) }
  }

  function handlePeriodChange(p: Period) {
    setPeriod(p)
    const now = new Date()
    setToDate(now.toISOString().split('T')[0])
    const from = new Date(now)
    if (p === 'day') from.setDate(from.getDate() - 14)
    else if (p === 'week') from.setDate(from.getDate() - 56)
    else from.setMonth(from.getMonth() - 6)
    setFromDate(from.toISOString().split('T')[0])
  }

  function clearDates() { setFromDate(''); setToDate('') }

  const counts = data?.counts ?? {}
  const chartByDate = (data?.by_date ?? []).map(d => ({ ...d, label: fmtDateLabel(d.date, period) }))
  const chartSuccessRate = (data?.success_rate_trend ?? []).map(d => ({ ...d, label: fmtDateLabel(d.date, 'day') }))

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#DA7756]/15 border border-[#DA7756]/25 flex items-center justify-center">
            <BarChart3 size={20} className="text-[#DA7756]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-tight">Dashboard</h1>
            <p className="text-sm text-slate-500">Task processing metrics and insights</p>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-[var(--bg-card)] border border-slate-200 dark:border-slate-700/40 rounded-xl p-3 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800/60 rounded-lg p-0.5">
          {(['day', 'week', 'month'] as Period[]).map(p => (
            <button key={p} onClick={() => handlePeriodChange(p)}
              className={`px-3.5 py-1.5 rounded-md text-[12px] font-medium transition-all ${
                period === p ? 'bg-[var(--bg-card)] text-[#DA7756] shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}>
              {p === 'day' ? 'Daily' : p === 'week' ? 'Weekly' : 'Monthly'}
            </button>
          ))}
        </div>
        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700" />
        <Clock size={14} className="text-slate-400 shrink-0" />
        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
          className="date-input bg-[var(--bg-base)] border border-slate-200 dark:border-slate-600/50 rounded-lg px-2.5 py-1.5 text-[12px] text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#DA7756] w-[130px]" />
        <span className="text-[12px] text-slate-400">to</span>
        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
          className="date-input bg-[var(--bg-base)] border border-slate-200 dark:border-slate-600/50 rounded-lg px-2.5 py-1.5 text-[12px] text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#DA7756] w-[130px]" />
        <div className="flex items-center gap-1 ml-auto">
          {(fromDate || toDate) && (
            <button onClick={clearDates} className="text-[11px] text-slate-400 hover:text-slate-600 flex items-center gap-1 px-2 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800">
              <X size={12} /> Clear
            </button>
          )}
          <button onClick={loadData} disabled={loading}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {loading && !data ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw size={24} className="animate-spin text-[#DA7756]" />
        </div>
      ) : !data ? (
        <Card className="text-center py-16">
          <BarChart3 size={40} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
          <p className="text-[15px] font-medium text-slate-600 dark:text-slate-300">No data yet</p>
          <p className="text-[13px] text-slate-400 mt-1">Process some tasks to see your dashboard</p>
        </Card>
      ) : (
        <>
          {/* Stat Cards — 2 rows of 3 */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <StatCard label="Total Processed" value={counts.total ?? 0} icon={ListTodo} color="text-[#DA7756]" bg="bg-[#DA7756]/10" subtitle="all time" />
            <StatCard label="Completed" value={counts.done ?? 0} icon={CheckCircle2} color="text-emerald-500" bg="bg-emerald-500/10" subtitle="success" />
            <StatCard label="Failed" value={counts.failed ?? 0} icon={XCircle} color="text-red-500" bg="bg-red-500/10" subtitle="errors" />
            <StatCard label="Pending Approval" value={counts.pending ?? 0} icon={Pause} color="text-amber-500" bg="bg-amber-500/10" />
            <StatCard label="Errors" value={counts.error ?? 0} icon={AlertTriangle} color="text-red-400" bg="bg-red-400/10" />
            <StatCard label="Interrupted" value={counts.interrupted ?? 0} icon={AlertTriangle} color="text-slate-500" bg="bg-slate-400/10" />
          </div>

          {/* Tasks Over Time — full width */}
          <Card className="!p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-[14px] font-semibold text-slate-800 dark:text-slate-100">Tasks Over Time</p>
                <p className="text-[12px] text-slate-400 mt-0.5">Processed tasks grouped {period === 'day' ? 'daily' : period === 'week' ? 'weekly' : 'monthly'}</p>
              </div>
              <Activity size={18} className="text-slate-300" />
            </div>
            {chartByDate.length === 0 ? (
              <p className="text-[13px] text-slate-400 text-center py-12">No data for this period</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartByDate} barGap={2} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid, #e2e8f0)" opacity={0.4} vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} width={35} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="done" name="Done" fill={COLORS.done} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="failed" name="Failed" fill={COLORS.failed} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="pending" name="Pending" fill={COLORS.pending} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="error" name="Error" fill={COLORS.error} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="interrupted" name="Interrupted" fill={COLORS.interrupted} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex items-center justify-center gap-5 mt-3">
                  {Object.entries(STATUS_LABELS).map(([key, label]) => (
                    <span key={key} className="flex items-center gap-1.5 text-[11px] text-slate-400">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[key as keyof typeof COLORS] }} />
                      {label}
                    </span>
                  ))}
                </div>
              </>
            )}
          </Card>

          {/* Two column: Repository + Status */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Repository — wider */}
            <Card className="md:col-span-3 !p-5">
              <p className="text-[14px] font-semibold text-slate-800 dark:text-slate-100 mb-1">By Repository</p>
              <p className="text-[12px] text-slate-400 mb-5">Task count per repository</p>
              {(data.by_repo ?? []).length === 0 ? (
                <p className="text-[13px] text-slate-400 text-center py-8">No data</p>
              ) : (
                <div className="space-y-3">
                  {data.by_repo.slice(0, 6).map(r => {
                    const maxCount = data.by_repo[0]?.count ?? 1
                    const pct = (r.count / maxCount) * 100
                    return (
                      <div key={r.repo}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[12px] font-medium text-slate-600 dark:text-slate-300 truncate">{r.repo}</span>
                          <span className="text-[13px] font-bold text-slate-800 dark:text-slate-100 ml-3">{r.count}</span>
                        </div>
                        <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-[#DA7756] to-[#E8A080] transition-all duration-500"
                               style={{ width: `${Math.max(pct, 4)}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>

            {/* Status — donut */}
            <Card className="md:col-span-2 !p-5">
              <p className="text-[14px] font-semibold text-slate-800 dark:text-slate-100 mb-1">Status</p>
              <p className="text-[12px] text-slate-400 mb-3">Distribution breakdown</p>
              {(data.by_status ?? []).length === 0 ? (
                <p className="text-[13px] text-slate-400 text-center py-8">No data</p>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <ResponsiveContainer width={160} height={160}>
                    <PieChart>
                      <Pie data={data.by_status} dataKey="count" nameKey="status" cx="50%" cy="50%"
                           innerRadius={45} outerRadius={70} paddingAngle={3} strokeWidth={0}>
                        {data.by_status.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 w-full">
                    {data.by_status.map((s, i) => (
                      <div key={s.status} className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-[12px] text-slate-500 dark:text-slate-400">
                          <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                          {STATUS_LABELS[s.status] ?? s.status}
                        </span>
                        <span className="text-[13px] font-bold text-slate-700 dark:text-slate-200">{s.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* Two column: Priority + Success Rate */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Priority */}
            <Card className="!p-5">
              <p className="text-[14px] font-semibold text-slate-800 dark:text-slate-100 mb-1">By Priority</p>
              <p className="text-[12px] text-slate-400 mb-5">Tasks grouped by priority level</p>
              {(data.by_priority ?? []).length === 0 ? (
                <p className="text-[13px] text-slate-400 text-center py-8">No data</p>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={data.by_priority} layout="vertical" barSize={16}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid, #e2e8f0)" opacity={0.4} horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="priority" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={65} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="count" name="Tasks" fill={COLORS.accent} radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>

            {/* Success Rate — area chart */}
            <Card className="!p-5">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp size={16} className="text-emerald-500" />
                <p className="text-[14px] font-semibold text-slate-800 dark:text-slate-100">Success Rate</p>
              </div>
              <p className="text-[12px] text-slate-400 mb-5">Daily task completion rate (%)</p>
              {chartSuccessRate.length === 0 ? (
                <p className="text-[13px] text-slate-400 text-center py-8">No data</p>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={chartSuccessRate}>
                    <defs>
                      <linearGradient id="successGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.done} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={COLORS.done} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid, #e2e8f0)" opacity={0.4} vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} domain={[0, 100]} width={35} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="rate" name="Success %" stroke={COLORS.done} strokeWidth={2.5}
                          fill="url(#successGrad)" dot={{ r: 3, fill: COLORS.done, strokeWidth: 0 }} activeDot={{ r: 5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
