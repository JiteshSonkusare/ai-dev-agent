import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, Loader2, RefreshCw, GitBranch, Clock, CheckCircle2, AlertTriangle, Pause } from 'lucide-react'
import { api } from '../api/client'
import { Card } from '../components/ui'

type ActiveTask = {
  id: string
  github_issue_number: number
  title: string
  repo_name: string
  status: string
  run_status: string
  current_step: string
  started_at: string | null
}

const STEP_LABELS: Record<string, string> = {
  setup: 'Setup', plan: 'Plan', develop: 'Develop', review: 'Review',
  commit_pr: 'Commit & PR', pipeline: 'Pipeline', done: 'Done',
}

function fmtElapsed(started: string | null): string {
  if (!started) return ''
  const s = Math.round((Date.now() - new Date(started).getTime()) / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  return `${m}m ${s % 60}s`
}

export default function RunningJobsPage() {
  const navigate = useNavigate()
  const [jobs, setJobs] = useState<ActiveTask[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    try { setJobs(await api.getActiveTasks()) }
    catch { setJobs([]) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="max-w-3xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
            <Activity size={17} className="text-blue-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-tight">Running Jobs</h1>
            <p className="text-sm text-slate-500">Active agent tasks currently in progress</p>
          </div>
        </div>
        <button onClick={load} disabled={loading}
          className="p-2 rounded-lg border border-slate-200 dark:border-slate-600/50 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Jobs list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={20} className="animate-spin text-slate-400" />
        </div>
      ) : jobs.length === 0 ? (
        <Card className="text-center py-14">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800/60 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={24} className="text-slate-300 dark:text-slate-600" />
          </div>
          <p className="text-[14px] font-medium text-slate-600 dark:text-slate-300">No active jobs</p>
          <p className="text-[12px] text-slate-400 mt-1">Start a task from My Tasks → Pull Tasks to see it here</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {jobs.map(job => (
            <button
              key={job.id}
              onClick={() => navigate(`/tasks/${job.id}/progress`)}
              className="w-full text-left rounded-xl px-4 py-3.5 bg-[var(--bg-card)] border border-slate-200 dark:border-slate-700/40 hover:border-blue-400/40 hover:shadow-sm transition-all group"
            >
              <div className="flex items-center gap-3">
                {/* Status indicator */}
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${
                  job.run_status === 'awaiting_gate'
                    ? 'bg-amber-500/10 border-amber-500/20'
                    : 'bg-blue-500/10 border-blue-500/20'
                }`}>
                  {job.run_status === 'awaiting_gate' ? (
                    <Pause size={15} className="text-amber-500" />
                  ) : (
                    <Loader2 size={15} className="text-blue-500 animate-spin" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-mono font-bold text-[var(--accent)]">#{job.github_issue_number}</span>
                    <span className="text-[13px] font-medium text-slate-800 dark:text-slate-100 truncate">{job.title}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <GitBranch size={10} /> {job.repo_name}
                    </span>
                    <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                      job.run_status === 'awaiting_gate'
                        ? 'text-amber-500 bg-amber-500/10'
                        : 'text-blue-500 bg-blue-500/10'
                    }`}>
                      {job.run_status === 'awaiting_gate' ? 'Awaiting Approval' : STEP_LABELS[job.current_step] || job.current_step}
                    </span>
                  </div>
                </div>

                {/* Right */}
                <div className="flex items-center gap-3 shrink-0">
                  {job.started_at && (
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Clock size={10} /> {fmtElapsed(job.started_at)}
                    </span>
                  )}
                  <span className="text-[10px] text-slate-400 group-hover:text-blue-500 transition-colors">
                    View →
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
