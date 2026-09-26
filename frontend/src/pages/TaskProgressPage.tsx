import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, CheckCircle2, XCircle, Loader2, GitBranch,
  Terminal, Brain, Shield, GitPullRequest, Rocket, ExternalLink,
  AlertTriangle, ChevronDown, Clock, Zap,
} from 'lucide-react'
import { api } from '../api/client'
import type { TaskProgress, RunStepData, GateData, TaskLogEntry } from '../api/client'
import { Button } from '../components/ui'

// ── Step config ─────────────────────────────────────────────────────────────

const STEPS = [
  { key: 'plan',      label: 'Plan',        icon: Brain,          desc: 'Analyzing issue and creating plan' },
  { key: 'develop',   label: 'Develop',     icon: Terminal,       desc: 'Writing code following the plan' },
  { key: 'review',    label: 'Review',      icon: Shield,         desc: 'Self-reviewing code quality' },
  { key: 'commit_pr', label: 'Commit & PR', icon: GitPullRequest, desc: 'Committing and creating PR' },
  { key: 'pipeline',  label: 'Pipeline',    icon: Rocket,         desc: 'Monitoring CI/CD pipeline' },
]

function fmtDuration(seconds: number | null): string {
  if (!seconds) return ''
  if (seconds < 60) return `${Math.round(seconds)}s`
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}m ${s}s`
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

// ── Step Sidebar (Left Panel) ──────────────────────────────────────────────

function StepSidebar({
  steps, currentStep, selectedStep, onSelect,
}: {
  steps: RunStepData[]
  currentStep: string
  selectedStep: string
  onSelect: (key: string) => void
}) {
  const stepMap = new Map(steps.map(s => [s.step_name, s]))

  return (
    <div className="py-3 space-y-0.5">
      <p className="px-4 pb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Steps</p>
      {STEPS.map((step) => {
        const data = stepMap.get(step.key)
        const status = data?.status ?? 'pending'
        const isCurrent = step.key === currentStep
        const isSelected = step.key === selectedStep
        const Icon = step.icon

        return (
          <button
            key={step.key}
            onClick={() => onSelect(step.key)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all ${
              isSelected
                ? 'bg-[var(--accent)]/8 border-l-[3px] border-[var(--accent)]'
                : 'border-l-[3px] border-transparent hover:bg-slate-100 dark:hover:bg-slate-800/40'
            }`}
          >
            {/* Status icon */}
            {status === 'completed' ? (
              <div className="w-6 h-6 rounded-full bg-emerald-500/15 border border-emerald-500/50 flex items-center justify-center shrink-0">
                <CheckCircle2 size={12} className="text-emerald-500" />
              </div>
            ) : status === 'failed' ? (
              <div className="w-6 h-6 rounded-full bg-red-500/15 border border-red-500/50 flex items-center justify-center shrink-0">
                <XCircle size={12} className="text-red-500" />
              </div>
            ) : status === 'running' || isCurrent ? (
              <div className="w-6 h-6 rounded-full bg-blue-500/10 border border-blue-500/40 flex items-center justify-center shrink-0">
                <Loader2 size={12} className="text-blue-500 animate-spin" />
              </div>
            ) : (
              <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 flex items-center justify-center shrink-0">
                <Icon size={10} className="text-slate-400" />
              </div>
            )}

            {/* Label + duration */}
            <div className="flex-1 min-w-0">
              <p className={`text-[12px] font-semibold leading-tight ${
                isSelected ? 'text-[var(--accent)]' :
                status === 'completed' ? 'text-slate-700 dark:text-slate-200' :
                status === 'failed' ? 'text-red-500' :
                status === 'running' ? 'text-blue-500' :
                'text-slate-400'
              }`}>
                {step.label}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {status === 'running' ? 'Running...' :
                 status === 'completed' ? fmtDuration(data?.duration_seconds ?? null) || 'Done' :
                 status === 'failed' ? 'Failed' :
                 '—'}
              </p>
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ── Run Error Banner ───────────────────────────────────────────────────────

function RunErrorBanner({ error }: { error: string }) {
  if (!error) return null
  return (
    <div className="mx-4 mt-3 flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
      <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
      <div>
        <p className="text-[11px] font-semibold text-red-500">Run Error</p>
        <p className="text-[11px] text-red-400 mt-0.5">{error}</p>
      </div>
    </div>
  )
}

// ── Step Header ────────────────────────────────────────────────────────────

function StepHeader({ step, data }: { step: typeof STEPS[0]; data: RunStepData | undefined }) {
  const status = data?.status ?? 'pending'
  const Icon = step.icon

  return (
    <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700/40">
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
          status === 'completed' ? 'bg-emerald-500/10' :
          status === 'failed' ? 'bg-red-500/10' :
          status === 'running' ? 'bg-blue-500/10' :
          'bg-slate-100 dark:bg-slate-800'
        }`}>
          <Icon size={16} className={
            status === 'completed' ? 'text-emerald-500' :
            status === 'failed' ? 'text-red-500' :
            status === 'running' ? 'text-blue-500' :
            'text-slate-400'
          } />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-[14px] font-bold text-slate-800 dark:text-slate-100">{step.label}</h2>
            <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-md border ${
              status === 'completed' ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' :
              status === 'failed' ? 'text-red-500 bg-red-500/10 border-red-500/20' :
              status === 'running' ? 'text-blue-500 bg-blue-500/10 border-blue-500/20' :
              'text-slate-400 bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600'
            }`}>
              {status === 'running' ? 'Running' : status}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">{step.desc}</p>
        </div>
      </div>
      <div className="flex items-center gap-4 text-[10px] text-slate-400">
        {data?.duration_seconds && (
          <span className="flex items-center gap-1"><Clock size={10} /> {fmtDuration(data.duration_seconds)}</span>
        )}
        {(data?.tokens_in || data?.tokens_out) ? (
          <span className="flex items-center gap-1"><Zap size={10} /> {((data.tokens_in + data.tokens_out) / 1000).toFixed(1)}k tokens</span>
        ) : null}
      </div>
    </div>
  )
}

// ── Step Error Panel ───────────────────────────────────────────────────────

function StepErrorPanel({ error }: { error: string | null }) {
  if (!error) return null
  return (
    <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-500/8 border border-red-500/20">
      <XCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
      <div>
        <p className="text-[11px] font-semibold text-red-500">Step Failed</p>
        <p className="text-[11px] text-red-400 mt-0.5 whitespace-pre-wrap">{error}</p>
      </div>
    </div>
  )
}

// ── Gate Panel ─────────────────────────────────────────────────────────────

function GatePanel({ gate, runId, onAction }: { gate: GateData; runId: string; onAction: () => void }) {
  const [acting, setActing] = useState(false)
  const isPending = gate.status === 'pending'
  const isplan = gate.gate_type === 'plan_approval'

  async function handle(action: 'approve' | 'reject') {
    setActing(true)
    try {
      if (action === 'approve') await api.approveGate(runId, gate.id)
      else await api.rejectGate(runId, gate.id)
      onAction()
    } catch { /* ignore */ }
    finally { setActing(false) }
  }

  return (
    <div className={`rounded-lg border-2 p-3.5 space-y-2.5 ${
      isPending ? 'border-amber-500/30 bg-amber-500/5' : 'border-slate-200 dark:border-slate-700/40 bg-slate-50 dark:bg-slate-800/30'
    }`}>
      <div className="flex items-center gap-2">
        {isPending ? (
          <AlertTriangle size={14} className="text-amber-500" />
        ) : gate.status === 'approved' ? (
          <CheckCircle2 size={14} className="text-emerald-500" />
        ) : (
          <XCircle size={14} className="text-red-500" />
        )}
        <p className={`text-[12px] font-semibold ${
          isPending ? 'text-amber-600 dark:text-amber-400' :
          gate.status === 'approved' ? 'text-emerald-600 dark:text-emerald-400' :
          'text-red-500'
        }`}>
          {isplan ? 'Plan Approval' : 'Merge Approval'}
          {!isPending && ` — ${gate.status}`}
        </p>
      </div>

      {/* Payload */}
      {isplan && gate.payload?.plan && (
        <pre className="text-[10px] text-slate-600 dark:text-slate-300 bg-[var(--bg-code)] rounded-lg p-3 max-h-[200px] overflow-y-auto whitespace-pre-wrap font-mono border border-slate-200 dark:border-slate-700/40">
          {gate.payload.plan}
        </pre>
      )}
      {!isplan && gate.payload?.pr_url && (
        <a href={gate.payload.pr_url} target="_blank" rel="noopener noreferrer"
          className="text-[11px] text-[var(--accent)] hover:underline flex items-center gap-1">
          <ExternalLink size={11} /> {gate.payload.pr_url}
        </a>
      )}

      {isPending && (
        <div className="flex items-center gap-2 pt-1">
          <Button onClick={() => handle('approve')} disabled={acting}>
            <CheckCircle2 size={12} /> Approve
          </Button>
          <Button variant="danger" onClick={() => handle('reject')} disabled={acting}>
            <XCircle size={12} /> Reject
          </Button>
        </div>
      )}
    </div>
  )
}

// ── Step Activity Feed ─────────────────────────────────────────────────────

function StepActivityFeed({ data }: { data: RunStepData | undefined }) {
  const feedRef = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(true)

  const events: Array<{ type: string; data: any; timestamp: string }> = []
  if (data) {
    for (const tc of (data.tool_calls || [])) {
      events.push({ type: 'tool', data: tc, timestamp: tc.timestamp || '' })
    }
    for (const r of (data.reasoning || [])) {
      events.push({ type: 'reasoning', data: r, timestamp: r.timestamp || '' })
    }
  }
  events.sort((a, b) => a.timestamp.localeCompare(b.timestamp))

  useEffect(() => {
    if (feedRef.current && expanded) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight
    }
  }, [events.length, expanded])

  return (
    <div>
      <button onClick={() => setExpanded(e => !e)}
        className="flex items-center gap-2 text-[11px] font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-2">
        <ChevronDown size={13} className={`transition-transform ${expanded ? '' : '-rotate-90'}`} />
        Activity ({events.length} events)
      </button>
      {expanded && (
        <div ref={feedRef} className="max-h-[350px] overflow-y-auto space-y-1 pr-1">
          {events.length === 0 ? (
            <p className="text-[10px] text-slate-400 italic py-4 text-center">No activity yet...</p>
          ) : events.map((evt, i) => (
            <div key={i} className="flex items-start gap-2 py-1 px-2 rounded hover:bg-slate-50 dark:hover:bg-slate-800/30">
              {evt.type === 'tool' ? (
                <>
                  <Terminal size={10} className="text-blue-400 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono font-bold text-blue-500">{evt.data.tool}</span>
                      <span className="text-[9px] text-slate-400">{fmtTime(evt.timestamp)}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                      {typeof evt.data.input === 'object' ? JSON.stringify(evt.data.input).slice(0, 100) : String(evt.data.input).slice(0, 100)}
                    </p>
                    {evt.data.output && (
                      <p className="text-[9px] text-slate-400 mt-0.5 truncate">→ {evt.data.output.slice(0, 150)}</p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <Brain size={10} className="text-[var(--accent)] mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="text-[9px] text-slate-400">{fmtTime(evt.timestamp)}</span>
                    <p className="text-[10px] text-slate-600 dark:text-slate-300 whitespace-pre-wrap line-clamp-4">
                      {evt.data.content?.slice(0, 400)}
                    </p>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Step Logs ──────────────────────────────────────────────────────────────

function StepLogs({ logs, stepName }: { logs: TaskLogEntry[]; stepName: string }) {
  const filtered = logs.filter(l => l.step_name === stepName || !l.step_name)
  const [expanded, setExpanded] = useState(true)

  if (filtered.length === 0) return null

  const levelStyles: Record<string, string> = {
    info: 'text-blue-500 bg-blue-500/10',
    warning: 'text-amber-500 bg-amber-500/10',
    error: 'text-red-500 bg-red-500/10',
  }

  return (
    <div>
      <button onClick={() => setExpanded(e => !e)}
        className="flex items-center gap-2 text-[11px] font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-2">
        <ChevronDown size={13} className={`transition-transform ${expanded ? '' : '-rotate-90'}`} />
        Logs ({filtered.length})
      </button>
      {expanded && (
        <div className="space-y-0.5 max-h-[200px] overflow-y-auto">
          {filtered.map(log => (
            <div key={log.id} className="flex items-start gap-2 py-1 px-2 rounded hover:bg-slate-50 dark:hover:bg-slate-800/30">
              <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0 mt-0.5 ${levelStyles[log.level] ?? levelStyles.info}`}>
                {log.level}
              </span>
              <p className="text-[10px] text-slate-600 dark:text-slate-300 font-mono flex-1">{log.message}</p>
              <span className="text-[9px] text-slate-400 shrink-0">{log.created_at ? fmtTime(log.created_at) : ''}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Step Detail (Right Panel) ──────────────────────────────────────────────

function StepDetail({
  selectedStep, steps, gates, logs, pendingGate, runId, onGateAction,
}: {
  selectedStep: string
  steps: RunStepData[]
  gates: GateData[]
  logs: TaskLogEntry[]
  pendingGate: GateData | null
  runId: string
  onGateAction: () => void
}) {
  const stepConfig = STEPS.find(s => s.key === selectedStep) ?? STEPS[0]
  const data = steps.find(s => s.step_name === selectedStep)
  const stepGates = gates.filter(g => g.step_name === selectedStep)
  const activePendingGate = pendingGate?.step_name === selectedStep ? pendingGate : null

  return (
    <div className="p-5 space-y-4 h-full overflow-y-auto">
      <StepHeader step={stepConfig} data={data} />

      {/* Error */}
      {data?.error && <StepErrorPanel error={data.error} />}

      {/* Gate — pending takes priority, then show resolved gates */}
      {activePendingGate && (
        <GatePanel gate={activePendingGate} runId={runId} onAction={onGateAction} />
      )}
      {!activePendingGate && stepGates.filter(g => g.status !== 'pending').map(g => (
        <GatePanel key={g.id} gate={g} runId={runId} onAction={onGateAction} />
      ))}

      {/* Activity */}
      <StepActivityFeed data={data} />

      {/* Logs */}
      <StepLogs logs={logs} stepName={selectedStep} />
    </div>
  )
}

// ── Run Summary Bar ────────────────────────────────────────────────────────

function RunSummaryBar({ steps, run }: { steps: RunStepData[]; run: TaskProgress['run'] }) {
  if (!run) return null
  return (
    <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-700/40 bg-[var(--bg-surface)] flex items-center justify-between">
      <div className="flex items-center gap-6 text-[11px] text-slate-500">
        <span className="font-semibold text-slate-700 dark:text-slate-200">
          {steps.filter(s => s.status === 'completed').length}/{STEPS.length} steps
        </span>
        <span>{steps.reduce((a, s) => a + (s.tool_calls?.length ?? 0), 0)} tool calls</span>
        <span>{((run.total_input_tokens + run.total_output_tokens) / 1000).toFixed(1)}k tokens</span>
        <span>{fmtDuration(steps.reduce((a, s) => a + (s.duration_seconds ?? 0), 0)) || '—'} total</span>
      </div>
      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${
        run.status === 'done' ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' :
        run.status === 'error' || run.status === 'failed' ? 'text-red-500 bg-red-500/10 border-red-500/20' :
        'text-slate-500 bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600'
      }`}>
        {run.status}
      </span>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function TaskProgressPage() {
  const { taskId } = useParams<{ taskId: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<TaskProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedStep, setSelectedStep] = useState('plan')
  const [userPinned, setUserPinned] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Polling
  useEffect(() => {
    if (!taskId) return
    let active = true

    async function poll() {
      try {
        const result = await api.getTaskProgress(taskId!)
        if (active) {
          setData(result)
          // Stop polling on terminal state
          const st = result?.run?.status
          if (st && ['done', 'error', 'interrupted', 'failed'].includes(st)) {
            if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
          }
        }
      } catch { /* ignore */ }
      finally { if (active) setLoading(false) }
    }

    poll()
    intervalRef.current = setInterval(poll, 2500)
    return () => { active = false; if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [taskId])

  // Auto-follow current step (unless user pinned)
  useEffect(() => {
    if (!data?.run?.current_step || userPinned) return
    setSelectedStep(data.run.current_step)
  }, [data?.run?.current_step, userPinned])

  // Terminal state
  const isTerminal = data?.run?.status && ['done', 'error', 'interrupted', 'failed'].includes(data.run.status)

  useEffect(() => {
    if (isTerminal) {
      setUserPinned(false) // unpin to show final state
    }
  }, [isTerminal])

  function handleSelectStep(key: string) {
    setSelectedStep(key)
    setUserPinned(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-[var(--accent)]" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-10">
        <p className="text-[14px] text-slate-500">Task not found</p>
      </div>
    )
  }

  const { task, run, steps, pending_gate, gates, logs } = data
  const runStatus = run?.status ?? 'unknown'

  return (
    <div className="flex flex-col h-[calc(100vh-7.5rem)]">
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex items-start gap-3 pb-4 border-b border-slate-200 dark:border-slate-700/40">
        <button onClick={() => navigate('/running-jobs')}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors mt-0.5">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[12px] font-mono font-bold text-[var(--accent)]">#{task.github_issue_number}</span>
            <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-md border ${
              runStatus === 'done' ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' :
              runStatus === 'running' ? 'text-blue-500 bg-blue-500/10 border-blue-500/20' :
              runStatus === 'awaiting_gate' ? 'text-amber-500 bg-amber-500/10 border-amber-500/20' :
              runStatus === 'error' || runStatus === 'failed' ? 'text-red-500 bg-red-500/10 border-red-500/20' :
              'text-slate-500 bg-slate-100 dark:bg-slate-800 border-slate-400/20'
            }`}>
              {runStatus === 'awaiting_gate' ? 'Awaiting Approval' : runStatus}
            </span>
            {(runStatus === 'running' || runStatus === 'awaiting_gate') && (
              <button
                onClick={async () => {
                  if (!confirm('Cancel this task? The agent will stop.')) return
                  try {
                    await api.cancelTask(taskId!)
                    api.getTaskProgress(taskId!).then(setData)
                  } catch {}
                }}
                className="text-[10px] font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 px-2 py-0.5 rounded transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
          <h1 className="text-[15px] font-semibold text-slate-900 dark:text-slate-100 leading-snug">{task.title}</h1>
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

      {/* ── Run Error Banner ─────────────────────────────────────── */}
      {run?.error && <RunErrorBanner error={run.error} />}

      {/* ── Split Panel ──────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 mt-3 rounded-xl border border-slate-200 dark:border-slate-700/40 overflow-hidden bg-[var(--bg-card)]">
        {/* Left: Step List */}
        <div className="w-56 shrink-0 border-r border-slate-200 dark:border-slate-700/40 bg-[var(--bg-surface)] overflow-y-auto">
          <StepSidebar
            steps={steps}
            currentStep={run?.current_step ?? ''}
            selectedStep={selectedStep}
            onSelect={handleSelectStep}
          />
        </div>

        {/* Right: Step Detail */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <StepDetail
            selectedStep={selectedStep}
            steps={steps}
            gates={gates || []}
            logs={logs || []}
            pendingGate={pending_gate}
            runId={run?.id ?? ''}
            onGateAction={() => api.getTaskProgress(taskId!).then(setData)}
          />
        </div>
      </div>

      {/* ── Summary Bar ──────────────────────────────────────────── */}
      {isTerminal && run && <RunSummaryBar steps={steps} run={run} />}
    </div>
  )
}
