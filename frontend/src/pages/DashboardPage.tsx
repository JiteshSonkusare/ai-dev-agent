import { useState, useEffect } from 'react'
import {
  BarChart3, RefreshCw, CheckCircle2, XCircle, AlertTriangle, Pause, ListTodo, TrendingUp, Clock, X,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from 'recharts'
import { api } from '../api/client'
import type { DashboardData } from '../api/client'
import { Card } from '../components/ui'

// ── Colors ──────────────────────────────────────────────────────────────────

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
    <div className="bg-[var(--bg-card)] border border-slate-200 dark:border-slate-700/50 rounded-lg shadow-lg px-3 py-2">
      <p className="text-[11px] font-medium text-slate-500 mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 text-[11px]">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
          <span className="text-slate-600 dark:text-slate-300">{p.name ?? p.dataKey}:</span>
          <span className="font-semibold text-slate-800 dark:text-slate-100">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

// ── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color, bg }: {
  label: string; value: number; icon: typeof CheckCircle2; color: string; bg: string
}) {
  return (
    <div className="bg-[var(--bg-card)] border border-slate-200 dark:border-slate-700/40 rounded-xl p-3.5 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
        <Icon size={16} className={color} />
      </div>
      <div>
        <p className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-none">{value}</p>
        <p className="text-[10px] font-medium text-slate-500 mt-0.5">{label}</p>
      </div>
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
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
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

  function clearDates() {
    setFromDate('')
    setToDate('')
  }

  const counts = data?.counts ?? {}
  const chartByDate = (data?.by_date ?? []).map(d => ({ ...d, label: fmtDateLabel(d.date, period) }))
  const chartSuccessRate = (data?.success_rate_trend ?? []).map(d => ({ ...d, label: fmtDateLabel(d.date, 'day') }))

  return (
    <div className="max-w-4xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#DA7756]/15 border border-[#DA7756]/25 flex items-center justify-center">
            <BarChart3 size={17} className="text-[#DA7756]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-tight">Dashboard</h1>
            <p className="text-sm text-slate-500">Task processing metrics and insights</p>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-[var(--bg-card)] border border-slate-200 dark:border-slate-700/40 rounded-xl p-3 flex items-center gap-2 flex-wrap">
        {/* Period toggle */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/60 rounded-lg p-0.5">
          {(['day', 'week', 'month'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => handlePeriodChange(p)}
              className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-all ${
                period === p
                  ? 'bg-[var(--bg-card)] text-[#DA7756] shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {p === 'day' ? 'Daily' : p === 'week' ? 'Weekly' : 'Monthly'}
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700" />

        {/* Date range */}
        <Clock size={13} className="text-slate-400 shrink-0" />
        <input
          type="date"
          value={fromDate}
          onChange={e => setFromDate(e.target.value)}
          className="date-input bg-[var(--bg-base)] border border-slate-200 dark:border-slate-600/50 rounded-lg px-2.5 py-1.5 text-[12px] text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#DA7756] w-[125px]"
        />
        <span className="text-[11px] text-slate-400">—</span>
        <input
          type="date"
          value={toDate}
          onChange={e => setToDate(e.target.value)}
          className="date-input bg-[var(--bg-base)] border border-slate-200 dark:border-slate-600/50 rounded-lg px-2.5 py-1.5 text-[12px] text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#DA7756] w-[125px]"
        />

        <div className="flex items-center gap-1 ml-auto">
          {(fromDate || toDate) && (
            <button
              onClick={clearDates}
              className="text-[11px] text-slate-400 hover:text-slate-600 flex items-center gap-1 px-2 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X size={12} /> Clear
            </button>
          )}
          <button
            onClick={loadData}
            disabled={loading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"
            title="Refresh"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {loading && !data ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw size={20} className="animate-spin text-slate-400" />
        </div>
      ) : !data ? (
        <Card className="text-center py-14">
          <BarChart3 size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-[14px] font-medium text-slate-600 dark:text-slate-300">No data yet</p>
          <p className="text-[12px] text-slate-400 mt-1">Process some tasks to see your dashboard</p>
        </Card>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            <StatCard label="Total" value={counts.total ?? 0} icon={ListTodo} color="text-[#DA7756]" bg="bg-[#DA7756]/10" />
            <StatCard label="Done" value={counts.done ?? 0} icon={CheckCircle2} color="text-emerald-500" bg="bg-emerald-500/10" />
            <StatCard label="Failed" value={counts.failed ?? 0} icon={XCircle} color="text-red-500" bg="bg-red-500/10" />
            <StatCard label="Pending" value={counts.pending ?? 0} icon={Pause} color="text-amber-500" bg="bg-amber-500/10" />
            <StatCard label="Error" value={counts.error ?? 0} icon={AlertTriangle} color="text-red-400" bg="bg-red-400/10" />
            <StatCard label="Interrupted" value={counts.interrupted ?? 0} icon={AlertTriangle} color="text-slate-500" bg="bg-slate-400/10" />
          </div>

          {/* Tasks Over Time */}
          <Card>
            <div className="mb-4">
              <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">Tasks Over Time</p>
              <p className="text-[11px] text-slate-400">Processed tasks grouped {period === 'day' ? 'daily' : period === 'week' ? 'weekly' : 'monthly'}</p>
            </div>
            {chartByDate.length === 0 ? (
              <p className="text-[12px] text-slate-400 text-center py-8">No data for this period</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartByDate} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid, #e2e8f0)" opacity={0.5} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} width={30} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="done" name="Done" fill={COLORS.done} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="failed" name="Failed" fill={COLORS.failed} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="pending" name="Pending" fill={COLORS.pending} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="error" name="Error" fill={COLORS.error} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="interrupted" name="Interrupted" fill={COLORS.interrupted} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex items-center justify-center gap-4 mt-2">
                  {Object.entries(STATUS_LABELS).map(([key, label]) => (
                    <span key={key} className="flex items-center gap-1.5 text-[10px] text-slate-400">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[key as keyof typeof COLORS] }} />
                      {label}
                    </span>
                  ))}
                </div>
              </>
            )}
          </Card>

          {/* Repository + Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100 mb-1">By Repository</p>
              <p className="text-[11px] text-slate-400 mb-4">Task count per repository</p>
              {(data.by_repo ?? []).length === 0 ? (
                <p className="text-[12px] text-slate-400 text-center py-6">No data</p>
              ) : (
                <div className="space-y-2.5">
                  {data.by_repo.slice(0, 6).map(r => {
                    const maxCount = data.by_repo[0]?.count ?? 1
                    const pct = (r.count / maxCount) * 100
                    return (
                      <div key={r.repo}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300 truncate">{r.repo}</span>
                          <span className="text-[11px] font-bold text-slate-800 dark:text-slate-100 ml-2">{r.count}</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div className="h-full rounded-full bg-[#DA7756] transition-all duration-500" style={{ width: `${Math.max(pct, 4)}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>

            <Card>
              <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100 mb-1">Status Distribution</p>
              <p className="text-[11px] text-slate-400 mb-2">Breakdown of all processed tasks</p>
              {(data.by_status ?? []).length === 0 ? (
                <p className="text-[12px] text-slate-400 text-center py-6">No data</p>
              ) : (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width={130} height={130}>
                    <PieChart>
                      <Pie data={data.by_status} dataKey="count" nameKey="status" cx="50%" cy="50%" innerRadius={36} outerRadius={58} paddingAngle={3} strokeWidth={0}>
                        {data.by_status.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5 flex-1">
                    {data.by_status.map((s, i) => (
                      <div key={s.status} className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                          {STATUS_LABELS[s.status] ?? s.status}
                        </span>
                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">{s.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* Priority + Success Rate */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100 mb-1">By Priority</p>
              <p className="text-[11px] text-slate-400 mb-4">Tasks grouped by priority level</p>
              {(data.by_priority ?? []).length === 0 ? (
                <p className="text-[12px] text-slate-400 text-center py-6">No data</p>
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={data.by_priority} layout="vertical" barSize={14}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid, #e2e8f0)" opacity={0.5} horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="priority" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={60} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="count" name="Tasks" fill={COLORS.accent} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>

            <Card>
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp size={14} className="text-emerald-500" />
                <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">Success Rate</p>
              </div>
              <p className="text-[11px] text-slate-400 mb-4">Daily task completion rate (%)</p>
              {chartSuccessRate.length === 0 ? (
                <p className="text-[12px] text-slate-400 text-center py-6">No data</p>
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={chartSuccessRate}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid, #e2e8f0)" opacity={0.5} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} domain={[0, 100]} width={30} />
                    <Tooltip content={<ChartTooltip />} />
                    <Line type="monotone" dataKey="rate" name="Success %" stroke={COLORS.done} strokeWidth={2} dot={{ r: 3, fill: COLORS.done }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
