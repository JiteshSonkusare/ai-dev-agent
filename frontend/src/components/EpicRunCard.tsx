import { useState } from 'react'
import { ChevronDown, ChevronUp, AlertCircle, ExternalLink, Check, CheckCircle2, XCircle } from 'lucide-react'
import type { EpicRun } from '../hooks/useBatchRun'
import { StepCard } from './StepCard'

interface EpicRunCardProps {
  run: EpicRun
  onResume: (runId: string, decision: string) => void
}

export function EpicRunCard({ run, onResume }: EpicRunCardProps) {
  const [expanded, setExpanded] = useState(false)

  const gateStep    = run.steps.find(s => s.status === 'awaiting_gate')
  const runningStep = run.steps.find(s => s.status === 'running')
  const hasGate     = !!gateStep

  const doneCount  = run.steps.filter(s => s.status === 'done' || s.status === 'auto_approved').length
  const totalCount = run.steps.length

  const currentLabel =
    hasGate     ? (gateStep!.label)
    : runningStep ? runningStep.label
    : run.status === 'done'  ? 'All steps complete'
    : run.status === 'error' ? (run.error || 'Failed')
    : 'Starting…'

  const borderAccent =
    hasGate           ? 'border-amber-400/50 dark:border-amber-500/40' :
    run.status === 'error' ? 'border-red-400/30 dark:border-red-500/25' :
    run.status === 'done'  ? 'border-emerald-400/30 dark:border-emerald-500/25' :
    'border-slate-200 dark:border-slate-700/50'

  return (
    <div className={`rounded-xl bg-[var(--bg-card)] border transition-all overflow-hidden ${borderAccent}`}>
      {/* Collapsed row */}
      <div className="flex items-center gap-3 px-4 py-3 min-h-[52px]">
        {/* Status indicator */}
        <RunStatusDot status={run.status} hasGate={hasGate} />

        {/* Epic key chip */}
        <span className="text-[12px] font-mono font-bold text-[#DA7756] dark:text-[#E8A080] bg-[#DA7756]/10 border border-[#DA7756]/20 px-2 py-0.5 rounded-lg shrink-0 leading-tight">
          {run.epic_key}
        </span>

        {/* Divider */}
        <span className="text-slate-200 dark:text-slate-700 select-none">|</span>

        {/* Current label */}
        <span className={`text-[13px] flex-1 truncate min-w-0 ${
          hasGate           ? 'text-amber-700 dark:text-amber-300 font-medium' :
          run.status === 'done'  ? 'text-slate-500 dark:text-slate-400' :
          run.status === 'error' ? 'text-red-600 dark:text-red-400' :
          'text-slate-700 dark:text-slate-300'
        }`}>
          {hasGate && <span className="text-amber-500 mr-1.5 text-[11px] font-semibold uppercase tracking-wide">Review ·</span>}
          {currentLabel}
        </span>

        {/* Right side */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Inline gate actions — no expand needed */}
          {hasGate && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onResume(run.run_id, 'yes')}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
              >
                <Check size={10} strokeWidth={3} /> Approve
              </button>
              <button
                onClick={() => onResume(run.run_id, 'no')}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-red-500/8 border border-red-400/25 text-red-500 hover:bg-red-500/15 transition-colors"
              >
                <XCircle size={10} /> Cancel
              </button>
            </div>
          )}

          {/* Step progress */}
          {!hasGate && totalCount > 0 && run.status !== 'done' && run.status !== 'error' && (
            <span className="text-[11px] tabular-nums text-slate-400 dark:text-slate-600 font-medium">
              {doneCount}/{totalCount}
            </span>
          )}

          {/* PR count */}
          {run.status === 'done' && run.prUrls.length > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
              <CheckCircle2 size={9} /> {run.prUrls.length} PR{run.prUrls.length > 1 ? 's' : ''}
            </span>
          )}

          {/* Expand toggle */}
          <button
            onClick={() => setExpanded(v => !v)}
            className="text-slate-400 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-400 transition-colors p-0.5 rounded"
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-slate-100 dark:border-slate-800/50 px-5 pt-4 pb-5 space-y-1">
          {run.error && (
            <div className="flex gap-2 text-red-600 dark:text-red-300 text-sm font-medium mb-3">
              <AlertCircle size={15} className="shrink-0 mt-0.5" /> {run.error}
            </div>
          )}
          {run.steps.map((step, i) => (
            <StepCard key={step.id} step={step} index={i} onResume={(d) => onResume(run.run_id, d)} />
          ))}
          {run.status === 'done' && run.prUrls.length > 0 && (
            <div className="pt-3 mt-2 border-t border-emerald-500/15">
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-2">Pull Requests</p>
              <div className="flex flex-wrap gap-2">
                {run.prUrls.map(({ task_key, pr_url }) => (
                  <a key={task_key} href={pr_url} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-[12px] font-mono font-semibold text-[#DA7756] dark:text-[#E8A080] bg-[#DA7756]/10 border border-[#DA7756]/20 px-2.5 py-1 rounded-lg hover:bg-[#DA7756]/20 transition-colors">
                    {task_key} <ExternalLink size={10} />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function RunStatusDot({ status, hasGate }: { status: EpicRun['status']; hasGate: boolean }) {
  if (hasGate) return (
    <span className="relative flex h-4 w-4 items-center justify-center shrink-0">
      <span className="animate-ping absolute h-full w-full rounded-full bg-amber-400/40" />
      <span className="relative h-2.5 w-2.5 rounded-full bg-amber-500" />
    </span>
  )
  if (status === 'running') return (
    <span className="relative flex h-4 w-4 items-center justify-center shrink-0">
      <span className="animate-ping absolute h-full w-full rounded-full bg-blue-400/40" />
      <span className="relative h-2.5 w-2.5 rounded-full bg-blue-500" />
    </span>
  )
  if (status === 'done') return (
    <span className="flex h-4 w-4 items-center justify-center shrink-0 rounded-full bg-emerald-500/15">
      <Check size={9} strokeWidth={3} className="text-emerald-500" />
    </span>
  )
  if (status === 'error') return (
    <span className="flex h-4 w-4 items-center justify-center shrink-0 rounded-full bg-red-500/15">
      <span className="text-red-500 text-[9px] font-bold leading-none">!</span>
    </span>
  )
  return (
    <span className="flex h-4 w-4 items-center justify-center shrink-0">
      <span className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-700" />
    </span>
  )
}
