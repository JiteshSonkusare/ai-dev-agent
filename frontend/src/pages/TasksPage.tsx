import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ListTodo, RefreshCw, ExternalLink, Clock, FolderCode, Play,
  CheckCircle2, XCircle, AlertTriangle, Pause, ChevronLeft, ChevronRight,
  Search, X, Tag, Loader2,
} from 'lucide-react'
import { api } from '../api/client'
import type { TaskItem } from '../api/client'
import { Card, Button } from '../components/ui'

// ── Constants ────────────────────────────────────────────────────────────────

const STATUSES = [
  { value: 'all',         label: 'All Statuses' },
  { value: 'done',        label: 'Done' },
  { value: 'pending',     label: 'Pending Approval' },
  { value: 'failed',      label: 'Failed' },
  { value: 'error',       label: 'Error' },
  { value: 'interrupted', label: 'Interrupted' },
] as const

type TaskStatus = typeof STATUSES[number]['value']

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; color: string; bg: string; label: string }> = {
  done:        { icon: CheckCircle2,  color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/20', label: 'Done' },
  in_progress: { icon: Loader2,       color: 'text-blue-500',    bg: 'bg-blue-500/10 border-blue-500/20',       label: 'In Progress' },
  pending:     { icon: Pause,         color: 'text-amber-500',   bg: 'bg-amber-500/10 border-amber-500/20',    label: 'Pending Approval' },
  failed:      { icon: XCircle,       color: 'text-red-500',     bg: 'bg-red-500/10 border-red-500/20',        label: 'Failed' },
  error:       { icon: AlertTriangle, color: 'text-red-400',     bg: 'bg-red-400/10 border-red-400/20',        label: 'Error' },
  interrupted: { icon: AlertTriangle, color: 'text-slate-500',   bg: 'bg-slate-500/10 border-slate-400/20',    label: 'Interrupted' },
}

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtDateShort(dateStr: string): string {
  const d = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

// ── Workflow Timeline ────────────────────────────────────────────────────────

type StepStatus = 'success' | 'failed' | 'skipped' | 'pending'

const WORKFLOW_STEPS = [
  { key: 'plan',     name: 'Plan',        desc: 'Analyze issue and create implementation plan' },
  { key: 'develop',  name: 'Develop',     desc: 'Write code following skill instructions' },
  { key: 'review',   name: 'Review',      desc: 'Self-review against coding standards' },
  { key: 'commit',   name: 'Commit & PR', desc: 'Push changes and create pull request' },
  { key: 'pipeline', name: 'Pipeline',    desc: 'Monitor CI/CD build status' },
]

function getStepStatuses(taskStatus: string): StepStatus[] {
  // Simulate step results based on task status — will be replaced with real data from agent runs
  switch (taskStatus) {
    case 'done':        return ['success', 'success', 'success', 'success', 'success']
    case 'pending':     return ['success', 'success', 'success', 'success', 'pending']
    case 'failed':      return ['success', 'success', 'failed', 'skipped', 'skipped']
    case 'error':       return ['success', 'failed', 'skipped', 'skipped', 'skipped']
    case 'interrupted': return ['success', 'success', 'success', 'skipped', 'skipped']
    default:            return ['pending', 'pending', 'pending', 'pending', 'pending']
  }
}

// Demo durations — will come from real agent data later
function getDemoDuration(stepStatus: StepStatus): string | null {
  if (stepStatus === 'success') {
    const durations = ['12s', '45s', '1m 23s', '2m 05s', '38s', '1m 47s', '55s']
    return durations[Math.floor(Math.random() * durations.length)]
  }
  if (stepStatus === 'failed') return '1m 12s'
  return null
}

function WorkflowTimeline({ taskStatus }: { taskStatus: string }) {
  const statuses = getStepStatuses(taskStatus)

  return (
    <div className="relative">
      {WORKFLOW_STEPS.map((step, i) => {
        const status = statuses[i]
        const isLast = i === WORKFLOW_STEPS.length - 1
        const duration = getDemoDuration(status)

        return (
          <div key={step.key} className="flex gap-3">
            {/* Timeline rail */}
            <div className="flex flex-col items-center">
              {/* Node */}
              {status === 'success' ? (
                <div className="w-6 h-6 rounded-full bg-emerald-500/15 border-2 border-emerald-500 flex items-center justify-center shrink-0">
                  <CheckCircle2 size={12} className="text-emerald-500" />
                </div>
              ) : status === 'failed' ? (
                <div className="w-6 h-6 rounded-full bg-red-500/15 border-2 border-red-500 flex items-center justify-center shrink-0">
                  <XCircle size={12} className="text-red-500" />
                </div>
              ) : status === 'pending' ? (
                <div className="w-6 h-6 rounded-full bg-amber-500/15 border-2 border-amber-400 flex items-center justify-center shrink-0">
                  <div className="w-2 h-2 rounded-full bg-amber-400" />
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 flex items-center justify-center shrink-0">
                  <div className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600" />
                </div>
              )}

              {/* Connector line */}
              {!isLast && (
                <div className={`w-0.5 flex-1 min-h-[20px] ${
                  status === 'success' ? 'bg-emerald-500/40' :
                  status === 'failed' ? 'bg-red-500/40' :
                  'bg-slate-200 dark:bg-slate-700'
                }`} />
              )}
            </div>

            {/* Content */}
            <div className={`pb-4 flex-1 min-w-0 ${isLast ? 'pb-0' : ''}`}>
              <div className="flex items-center justify-between gap-2">
                <p className={`text-[12px] font-semibold leading-snug ${
                  status === 'success' ? 'text-slate-700 dark:text-slate-200' :
                  status === 'failed' ? 'text-red-500' :
                  status === 'pending' ? 'text-amber-500' :
                  'text-slate-400'
                }`}>
                  {step.name}
                </p>
                {duration && (
                  <span className={`text-[10px] font-medium shrink-0 ${
                    status === 'failed' ? 'text-red-400' : 'text-slate-400'
                  }`}>
                    {duration}
                  </span>
                )}
              </div>
              <p className={`text-[10px] mt-0.5 ${
                status === 'skipped' ? 'text-slate-300 dark:text-slate-600' : 'text-slate-400'
              }`}>
                {status === 'failed' ? 'Step failed — check logs for details' :
                 status === 'skipped' ? 'Skipped' :
                 status === 'pending' ? 'Awaiting execution' :
                 step.desc}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Detail Drawer ───────────────────────────────────────────────────────────

function TaskDrawer({ task, onClose }: { task: TaskItem; onClose: () => void }) {
  const cfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.done
  const StatusIcon = cfg.icon

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-40" />

      {/* Drawer */}
      <div className="fixed top-0 right-0 h-full w-[420px] max-w-[90vw] bg-[var(--bg-surface)] border-l border-slate-200 dark:border-slate-700/50 shadow-2xl z-50 flex flex-col animate-slide-in">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-700/40 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[12px] font-mono font-bold text-[#DA7756]">#{task.github_issue_number}</span>
              <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-md border ${cfg.bg} ${cfg.color}`}>
                {cfg.label}
              </span>
            </div>
            <h2 className="text-[15px] font-semibold text-slate-900 dark:text-slate-100 leading-snug">{task.title}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 mt-0.5">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Info grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/40">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Repository</p>
              <div className="flex items-center gap-1.5">
                <FolderCode size={12} className="text-slate-400" />
                <p className="text-[12px] font-medium text-slate-700 dark:text-slate-200 truncate">{task.repo_owner}/{task.repo_name}</p>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/40">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Status</p>
              <div className="flex items-center gap-1.5">
                <StatusIcon size={12} className={cfg.color} />
                <p className={`text-[12px] font-medium ${cfg.color}`}>{cfg.label}</p>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/40">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">GitHub Issue</p>
              <div className="flex items-center gap-1.5">
                <span className={`text-[12px] font-medium ${task.github_status === 'closed' ? 'text-purple-500' : 'text-emerald-500'}`}>
                  {task.github_status === 'closed' ? '● Closed' : '● Open'}
                </span>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/40">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Created</p>
              <div className="flex items-center gap-1.5">
                <Clock size={12} className="text-slate-400" />
                <p className="text-[12px] font-medium text-slate-700 dark:text-slate-200">{fmtDate(task.github_created_at)}</p>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/40">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Due Date</p>
              <p className="text-[12px] font-medium text-slate-700 dark:text-slate-200">{fmtDate(task.due_date) || '—'}</p>
            </div>
          </div>

          {/* Priority + Story Points */}
          <div className="flex items-center gap-3">
            {task.priority && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-400">Priority:</span>
                <span className="text-[10px] font-bold uppercase text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded">{task.priority}</span>
              </div>
            )}
            {task.story_points != null && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-400">Story Points:</span>
                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">{task.story_points}</span>
              </div>
            )}
          </div>

          {/* Labels */}
          {task.labels.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Labels</p>
              <div className="flex flex-wrap gap-1.5">
                {task.labels.map(l => (
                  <span key={l.name} className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/60 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700/40">
                    {l.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Workflow Timeline */}
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-3">Workflow Timeline</p>
            <WorkflowTimeline taskStatus={task.status} />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700/40">
          <a
            href={task.github_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2 rounded-lg text-[12px] font-semibold text-[#DA7756] bg-[#DA7756]/10 border border-[#DA7756]/20 hover:bg-[#DA7756]/15 transition-colors"
          >
            <ExternalLink size={13} /> View on GitHub
          </a>
        </div>
      </div>
    </>
  )
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function TasksPage() {
  const navigate = useNavigate()
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<TaskStatus>('all')
  const [searchText, setSearchText] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [datePreset, setDatePreset] = useState<'all' | 'week' | 'month'>('all')
  const [page, setPage] = useState(1)
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null)
  const PAGE_SIZE = 10

  useEffect(() => { loadTasks() }, [])

  async function loadTasks() {
    setLoading(true)
    try {
      setTasks(await api.listTasks(undefined, undefined, 'backlog'))
    } catch {
      setTasks([])
    } finally {
      setLoading(false)
    }
  }

  function applyDatePreset(preset: 'all' | 'week' | 'month') {
    setDatePreset(preset)
    setPage(1)
    if (preset === 'all') {
      setFromDate('')
      setToDate('')
      return
    }
    const now = new Date()
    const to = now.toISOString().split('T')[0]
    setToDate(to)
    if (preset === 'week') {
      const from = new Date(now)
      from.setDate(from.getDate() - 7)
      setFromDate(from.toISOString().split('T')[0])
    } else {
      const from = new Date(now)
      from.setMonth(from.getMonth() - 1)
      setFromDate(from.toISOString().split('T')[0])
    }
  }

  const filtered = tasks.filter(t => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false
    if (searchText) {
      const q = searchText.toLowerCase()
      if (!t.title.toLowerCase().includes(q) && !`#${t.github_issue_number}`.includes(q) && !`${t.github_issue_number}`.includes(q)) return false
    }
    if (fromDate) {
      const taskDate = new Date(t.pulled_at).toISOString().split('T')[0]
      if (taskDate < fromDate) return false
    }
    if (toDate) {
      const taskDate = new Date(t.pulled_at).toISOString().split('T')[0]
      if (taskDate > toDate) return false
    }
    return true
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#DA7756]/15 border border-[#DA7756]/25 flex items-center justify-center">
            <ListTodo size={17} className="text-[#DA7756]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-tight">My Tasks</h1>
            <p className="text-sm text-slate-500">Processed tasks and their workflow results</p>
          </div>
        </div>
        <Button onClick={() => navigate('/tasks/pull')}>
          <Play size={12} /> Pull Tasks
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-[var(--bg-card)] border border-slate-200 dark:border-slate-700/40 rounded-xl p-3 space-y-2.5">
        {/* Row 1: Search + Status + Refresh */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchText}
              onChange={e => { setSearchText(e.target.value); setPage(1) }}
              placeholder="Search by title or #number..."
              className="w-full bg-[var(--bg-base)] border border-slate-200 dark:border-slate-600/50 rounded-lg pl-9 pr-8 py-2 text-[12px] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-[#DA7756] focus:ring-1 focus:ring-[rgba(218,119,86,0.15)]"
            />
            {searchText && (
              <button onClick={() => setSearchText('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X size={13} />
              </button>
            )}
          </div>
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value as TaskStatus); setPage(1) }}
            className="bg-[var(--bg-base)] border border-slate-200 dark:border-slate-600/50 rounded-lg px-3 py-2 text-[12px] text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#DA7756] focus:ring-1 focus:ring-[rgba(218,119,86,0.15)] w-40 shrink-0"
          >
            {STATUSES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <button
            onClick={loadTasks}
            disabled={loading}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-600/50 bg-[var(--bg-base)] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-40 shrink-0"
            title="Refresh"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Row 2: Date range + presets */}
        <div className="flex items-center gap-2">
          <Clock size={13} className="text-slate-400 shrink-0" />
          <input
            type="date"
            value={fromDate}
            onChange={e => { setFromDate(e.target.value); setDatePreset('all'); setPage(1) }}
            className="date-input bg-[var(--bg-base)] border border-slate-200 dark:border-slate-600/50 rounded-lg px-2.5 py-1.5 text-[12px] text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#DA7756] focus:ring-1 focus:ring-[rgba(218,119,86,0.15)] w-[125px]"
          />
          <span className="text-[11px] text-slate-400">—</span>
          <input
            type="date"
            value={toDate}
            onChange={e => { setToDate(e.target.value); setDatePreset('all'); setPage(1) }}
            className="date-input bg-[var(--bg-base)] border border-slate-200 dark:border-slate-600/50 rounded-lg px-2.5 py-1.5 text-[12px] text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#DA7756] focus:ring-1 focus:ring-[rgba(218,119,86,0.15)] w-[125px]"
          />
          <div className="flex items-center gap-1 ml-auto">
            {([
              { key: 'week' as const, label: 'Week' },
              { key: 'month' as const, label: 'Month' },
              { key: 'all' as const, label: 'All' },
            ]).map(p => (
              <button
                key={p.key}
                onClick={() => applyDatePreset(p.key)}
                className={`px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all ${
                  datePreset === p.key
                    ? 'bg-[#DA7756]/10 text-[#DA7756] shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Task List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw size={20} className="animate-spin text-slate-400" />
        </div>
      ) : tasks.length === 0 ? (
        <Card className="text-center py-14">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800/60 flex items-center justify-center mx-auto mb-4">
            <ListTodo size={24} className="text-slate-300 dark:text-slate-600" />
          </div>
          <p className="text-[14px] font-medium text-slate-600 dark:text-slate-300">No processed tasks yet</p>
          <p className="text-[12px] text-slate-400 mt-1 max-w-sm mx-auto">
            Pull backlog tasks from GitHub and start them to see results here.
          </p>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="text-center py-8">
          <p className="text-[13px] text-slate-400">No tasks match your search or filter</p>
        </Card>
      ) : (
        <div className="space-y-1.5">
          {paginated.map(task => {
            const cfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.done
            const StatusIcon = cfg.icon
            const isSelected = selectedTask?.id === task.id

            return (
              <button
                key={task.id}
                onClick={() => {
                  if (task.status === 'in_progress') {
                    navigate(`/running-jobs/${task.id}`)
                  } else {
                    setSelectedTask(task)
                  }
                }}
                className={`w-full text-left rounded-xl px-4 py-3 transition-all duration-150 group
                  ${isSelected
                    ? 'bg-[#DA7756]/[0.06] border border-[#DA7756]/20 shadow-sm'
                    : 'bg-[var(--bg-card)] border border-slate-200 dark:border-slate-700/40 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm'
                  }`}
              >
                <div className="flex items-center gap-3">
                  {/* Status indicator */}
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${cfg.bg}`}>
                    <StatusIcon size={14} className={cfg.color} />
                  </div>

                  {/* Main content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-mono font-bold text-[#DA7756]">#{task.github_issue_number}</span>
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${task.github_status === 'closed' ? 'bg-purple-500' : 'bg-emerald-500'}`}
                        title={`GitHub: ${task.github_status || 'open'}`} />
                      <span className="text-[13px] font-medium text-slate-800 dark:text-slate-100 truncate">{task.title}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <FolderCode size={11} className="text-slate-400" /> {task.repo_name}
                      </span>
                      {task.priority && (
                        <span className="text-[10px] font-semibold uppercase text-orange-500 bg-orange-500/8 px-1.5 py-0.5 rounded">{task.priority}</span>
                      )}
                      {task.story_points != null && (
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-0.5">
                          <Tag size={9} /> {task.story_points} pts
                        </span>
                      )}
                      {task.labels.slice(0, 1).map(l => (
                        <span key={l.name} className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/50 px-1.5 py-0.5 rounded hidden sm:inline">{l.name}</span>
                      ))}
                    </div>
                  </div>

                  {/* Right side */}
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-[9px] font-bold uppercase px-2 py-1 rounded-md border hidden sm:block ${cfg.bg} ${cfg.color}`}>
                      {cfg.label}
                    </span>
                    {task.status === 'in_progress' ? (
                      <span className="text-[10px] font-medium text-[#DA7756] flex items-center gap-1">
                        <Loader2 size={10} className="animate-spin" /> View
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 w-14 text-right hidden sm:block">{fmtDateShort(task.pulled_at)}</span>
                    )}
                    <ExternalLink size={12} className="text-slate-300 dark:text-slate-600 group-hover:text-slate-400 transition-colors" />
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft size={12} /> Previous
          </button>
          <span className="text-[11px] text-slate-400">
            Page {page} of {totalPages} · {filtered.length} task{filtered.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50 disabled:opacity-30 transition-colors"
          >
            Next <ChevronRight size={12} />
          </button>
        </div>
      )}

      {/* Detail Drawer */}
      {selectedTask && (
        <TaskDrawer task={selectedTask} onClose={() => setSelectedTask(null)} />
      )}
    </div>
  )
}
