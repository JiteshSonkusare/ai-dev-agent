import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, CheckCircle2, XCircle, Loader2, GitBranch,
  Terminal, Brain, Shield, GitPullRequest, Rocket, ExternalLink,
  AlertTriangle, ChevronDown,
} from 'lucide-react'
import { api } from '../api/client'
import type { TaskProgress, RunStepData, GateData } from '../api/client'
import { Card, Button } from '../components/ui'

// ── Step config ─────────────────────────────────────────────────────────────

const STEPS = [
  { key: 'plan',      label: 'Plan',        icon: Brain,          desc: 'Analyzing issue and creating implementation plan' },
  { key: 'develop',   label: 'Develop',     icon: Terminal,       desc: 'Writing code following the approved plan' },
  { key: 'review',    label: 'Review',      icon: Shield,         desc: 'Self-reviewing code against standards' },
  { key: 'commit_pr', label: 'Commit & PR', icon: GitPullRequest, desc: 'Committing changes and creating pull request' },
  { key: 'pipeline',  label: 'Pipeline',    icon: Rocket,         desc: 'Monitoring CI/CD and closing issue' },
]

function fmtDuration(seconds: number | null): string {
  if (!seconds) return ''
  if (seconds < 60) return `${Math.round(seconds)}s`
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}m ${s}s`
}

// ── Workflow Timeline ───────────────────────────────────────────────────────

function WorkflowTimeline({ steps, currentStep }: { steps: RunStepData[]; currentStep: string }) {
  const stepMap = new Map(steps.map(s => [s.step_name, s]))

  return (
    <div className="space-y-0">
      {STEPS.map((step, i) => {
        const data = stepMap.get(step.key)
        const status = data?.status ?? 'pending'
        const isCurrent = step.key === currentStep
        const Icon = step.icon

        return (
          <div key={step.key} className="flex gap-3">
            {/* Rail */}
            <div className="flex flex-col items-center">
              {status === 'completed' ? (
                <div className="w-7 h-7 rounded-full bg-emerald-500/15 border-2 border-emerald-500 flex items-center justify-center shrink-0">
                  <CheckCircle2 size={14} className="text-emerald-500" />
                </div>
              ) : status === 'failed' ? (
                <div className="w-7 h-7 rounded-full bg-red-500/15 border-2 border-red-500 flex items-center justify-center shrink-0">
                  <XCircle size={14} className="text-red-500" />
                </div>
              ) : status === 'running' || isCurrent ? (
                <div className="w-7 h-7 rounded-full bg-[#DA7756]/15 border-2 border-[#DA7756] flex items-center justify-center shrink-0">
                  <Loader2 size={14} className="text-[#DA7756] animate-spin" />
                </div>
              ) : (
                <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 flex items-center justify-center shrink-0">
                  <Icon size={12} className="text-slate-400" />
                </div>
              )}
              {i < STEPS.length - 1 && (
                <div className={`w-0.5 flex-1 min-h-[24px] ${
                  status === 'completed' ? 'bg-emerald-500/40' :
                  status === 'failed' ? 'bg-red-500/40' :
                  'bg-slate-200 dark:bg-slate-700'
                }`} />
              )}
            </div>

            {/* Content */}
            <div className="pb-4 flex-1">
              <div className="flex items-center justify-between">
                <p className={`text-[13px] font-semibold ${
                  status === 'completed' ? 'text-emerald-600 dark:text-emerald-400' :
                  status === 'failed' ? 'text-red-500' :
                  status === 'running' || isCurrent ? 'text-[#DA7756]' :
                  'text-slate-400'
                }`}>
                  {step.label}
                </p>
                {data?.duration_seconds && (
                  <span className="text-[10px] text-slate-400">{fmtDuration(data.duration_seconds)}</span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {status === 'running' ? 'In progress...' :
                 status === 'failed' ? (data?.error || 'Step failed') :
                 status === 'completed' ? 'Completed' :
                 step.desc}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Activity Feed ───────────────────────────────────────────────────────────

function ActivityFeed({ steps }: { steps: RunStepData[] }) {
  const feedRef = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(true)

  // Collect all events from all steps, sorted by timestamp
  const events: Array<{ type: string; step: string; data: any; timestamp: string }> = []
  for (const step of steps) {
    for (const tc of (step.tool_calls || [])) {
      events.push({ type: 'tool', step: step.step_name, data: tc, timestamp: tc.timestamp || '' })
    }
    for (const r of (step.reasoning || [])) {
      events.push({ type: 'reasoning', step: step.step_name, data: r, timestamp: r.timestamp || '' })
    }
  }
  events.sort((a, b) => a.timestamp.localeCompare(b.timestamp))

  // Auto-scroll to bottom
  useEffect(() => {
    if (feedRef.current && expanded) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight
    }
  }, [events.length, expanded])

  return (
    <div>
      <button onClick={() => setExpanded(e => !e)}
        className="flex items-center gap-2 text-[12px] font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-2">
        <ChevronDown size={14} className={`transition-transform ${expanded ? '' : '-rotate-90'}`} />
        Activity Feed ({events.length} events)
      </button>
      {expanded && (
        <div ref={feedRef} className="max-h-[300px] overflow-y-auto space-y-1 pr-1">
          {events.length === 0 ? (
            <p className="text-[11px] text-slate-400 italic py-4 text-center">Waiting for agent activity...</p>
          ) : events.map((evt, i) => (
            <div key={i} className="flex items-start gap-2 py-1">
              {evt.type === 'tool' ? (
                <>
                  <Terminal size={11} className="text-blue-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[11px] font-mono font-semibold text-blue-500">{evt.data.tool}</span>
                    <span className="text-[10px] text-slate-400 ml-1.5">
                      {typeof evt.data.input === 'object' ? JSON.stringify(evt.data.input).slice(0, 80) : String(evt.data.input).slice(0, 80)}
                    </span>
                    {evt.data.output && (
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">{evt.data.output.slice(0, 120)}</p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <Brain size={11} className="text-[#DA7756] mt-0.5 shrink-0" />
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 whitespace-pre-wrap line-clamp-3">
                    {evt.data.content?.slice(0, 300)}
                  </p>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Gate Approval Panel ─────────────────────────────────────────────────────

function GatePanel({ gate, runId, onAction }: { gate: GateData; runId: string; onAction: () => void }) {
  const [acting, setActing] = useState(false)

  async function handle(action: 'approve' | 'reject') {
    setActing(true)
    try {
      if (action === 'approve') await api.approveGate(runId, gate.id)
      else await api.rejectGate(runId, gate.id)
      onAction()
    } catch { /* ignore */ }
    finally { setActing(false) }
  }

  const isplan = gate.gate_type === 'plan_approval'

  return (
    <div className="border-2 border-amber-500/30 bg-amber-500/5 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle size={16} className="text-amber-500" />
        <p className="text-[14px] font-semibold text-amber-600 dark:text-amber-400">
          {isplan ? 'Plan Approval Required' : 'Merge Approval Required'}
        </p>
      </div>
      <p className="text-[12px] text-slate-500">
        {isplan
          ? 'The agent has created an implementation plan. Review it and decide whether to proceed.'
          : 'The agent has created a pull request. Review it and decide whether to merge.'}
      </p>

      {/* Payload display */}
      {isplan && gate.payload?.plan && (
        <pre className="text-[11px] text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/40 rounded-lg p-3 max-h-[200px] overflow-y-auto whitespace-pre-wrap font-mono border border-slate-200 dark:border-slate-700/40">
          {gate.payload.plan}
        </pre>
      )}
      {!isplan && gate.payload?.pr_url && (
        <a href={gate.payload.pr_url} target="_blank" rel="noopener noreferrer"
          className="text-[12px] text-[#DA7756] hover:underline flex items-center gap-1">
          <ExternalLink size={12} /> View PR: {gate.payload.pr_url}
        </a>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Button onClick={() => handle('approve')} disabled={acting}>
          <CheckCircle2 size={13} /> Approve
        </Button>
        <Button variant="danger" onClick={() => handle('reject')} disabled={acting}>
          <XCircle size={13} /> Reject
        </Button>
      </div>
    </div>
  )
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function TaskProgressPage() {
  const { taskId } = useParams<{ taskId: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<TaskProgress | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!taskId) return
    let active = true

    async function poll() {
      try {
        const result = await api.getTaskProgress(taskId!)
        if (active) setData(result)
      } catch { /* ignore */ }
      finally { if (active) setLoading(false) }
    }

    poll()
    const interval = setInterval(poll, 2500)

    return () => { active = false; clearInterval(interval) }
  }, [taskId])

  // Stop polling when task is terminal
  const isTerminal = data?.run?.status && ['done', 'error', 'interrupted', 'failed'].includes(data.run.status)

  // Clear active task from sidebar when done
  useEffect(() => {
    if (isTerminal) localStorage.removeItem('cc_active_task')
  }, [isTerminal])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-[#DA7756]" />
      </div>
    )
  }

  if (!data) {
    return (
      <Card className="text-center py-10 max-w-2xl mx-auto">
        <p className="text-[14px] text-slate-500">Task not found</p>
      </Card>
    )
  }

  const { task, run, steps, pending_gate } = data
  const runStatus = run?.status ?? 'unknown'

  return (
    <div className="max-w-3xl space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={() => navigate('/tasks')}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors mt-1">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[12px] font-mono font-bold text-[#DA7756]">#{task.github_issue_number}</span>
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${
              runStatus === 'done' ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' :
              runStatus === 'running' ? 'text-blue-500 bg-blue-500/10 border-blue-500/20' :
              runStatus === 'awaiting_gate' ? 'text-amber-500 bg-amber-500/10 border-amber-500/20' :
              runStatus === 'error' || runStatus === 'failed' ? 'text-red-500 bg-red-500/10 border-red-500/20' :
              runStatus === 'interrupted' ? 'text-slate-500 bg-slate-500/10 border-slate-400/20' :
              'text-slate-500 bg-slate-500/10 border-slate-400/20'
            }`}>
              {runStatus === 'awaiting_gate' ? 'Awaiting Approval' : runStatus}
            </span>
            {(runStatus === 'running' || runStatus === 'awaiting_gate') && (
              <button
                onClick={async () => {
                  if (!confirm('Cancel this task? The agent will stop.')) return
                  try {
                    await api.cancelTask(taskId!)
                    localStorage.removeItem('cc_active_task')
                    api.getTaskProgress(taskId!).then(setData)
                  } catch {}
                }}
                className="text-[10px] font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 px-2 py-0.5 rounded transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
          <h1 className="text-[16px] font-semibold text-slate-900 dark:text-slate-100 leading-snug">{task.title}</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <GitBranch size={10} /> {task.repo_owner}/{task.repo_name}
            </span>
            {run?.branch_name && (
              <span className="text-[11px] text-slate-400 font-mono">{run.branch_name}</span>
            )}
          </div>
        </div>
      </div>

      {/* Timeline + Gate */}
      <Card>
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-3">Workflow Progress</p>
        <WorkflowTimeline steps={steps} currentStep={run?.current_step ?? ''} />
      </Card>

      {/* Gate Panel */}
      {pending_gate && run && (
        <GatePanel
          gate={pending_gate}
          runId={run.id}
          onAction={() => {
            // Refresh immediately after gate action
            api.getTaskProgress(taskId!).then(setData)
          }}
        />
      )}

      {/* Activity Feed */}
      <Card>
        <ActivityFeed steps={steps} />
      </Card>

      {/* Summary (when done) */}
      {isTerminal && run && (
        <Card>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-3">Run Summary</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="text-center">
              <p className="text-[18px] font-bold text-slate-800 dark:text-slate-100">
                {steps.filter(s => s.status === 'completed').length}/{STEPS.length}
              </p>
              <p className="text-[10px] text-slate-400">Steps Done</p>
            </div>
            <div className="text-center">
              <p className="text-[18px] font-bold text-slate-800 dark:text-slate-100">
                {steps.reduce((a, s) => a + (s.tool_calls?.length ?? 0), 0)}
              </p>
              <p className="text-[10px] text-slate-400">Tool Calls</p>
            </div>
            <div className="text-center">
              <p className="text-[18px] font-bold text-slate-800 dark:text-slate-100">
                {((run.total_input_tokens + run.total_output_tokens) / 1000).toFixed(1)}k
              </p>
              <p className="text-[10px] text-slate-400">Tokens</p>
            </div>
            <div className="text-center">
              <p className="text-[18px] font-bold text-slate-800 dark:text-slate-100">
                {fmtDuration(steps.reduce((a, s) => a + (s.duration_seconds ?? 0), 0)) || '—'}
              </p>
              <p className="text-[10px] text-slate-400">Total Time</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
