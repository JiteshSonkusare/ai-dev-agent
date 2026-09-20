import { useState } from 'react'
import { CheckCircle, ChevronDown, ChevronUp, Circle, Clock, AlertCircle, ExternalLink, Edit2, XCircle, Bot } from 'lucide-react'
import type { Step } from '../hooks/useBatchRun'
import { Button, Textarea, Card } from './ui'

interface StepCardProps {
  step: Step
  index: number
  onResume: (decision: string) => void
}

export function StepCard({ step, index, onResume }: StepCardProps) {
  const [open, setOpen] = useState(true)

  const isRunning      = step.status === 'running'
  const isGate         = step.status === 'awaiting_gate'
  const isAutoApproved = step.status === 'auto_approved'
  const isDone         = step.status === 'done'
  const isError        = step.status === 'error'

  return (
    <div className="flex gap-5">
      <div className="flex flex-col items-center pt-0.5">
        <StepDot status={step.status} />
        <div className="w-px flex-1 bg-slate-200 dark:bg-slate-800 mt-2" />
      </div>

      <div className="flex-1 pb-7 min-w-0">
        <button
          className="flex items-center gap-3 w-full text-left mb-3 group py-0.5"
          onClick={() => setOpen(v => !v)}
        >
          <span className="text-[13px] font-medium text-slate-400 w-5 shrink-0">{index + 1}.</span>
          <span className={`text-[15px] font-semibold ${
            isRunning      ? 'text-slate-900 dark:text-slate-100' :
            isDone         ? 'text-slate-700 dark:text-slate-200' :
            isGate         ? 'text-amber-700 dark:text-amber-200' :
            isAutoApproved ? 'text-slate-600 dark:text-slate-300' :
                             'text-slate-400'
          }`}>
            {step.label}
          </span>
          {step.type === 'dev' && step.task_key && (
            <span className="text-[12px] font-mono font-bold text-[#DA7756] dark:text-[#E8A080] bg-[#DA7756]/10 border border-[#DA7756]/20 px-2.5 py-0.5 rounded-lg">
              {step.task_key}
            </span>
          )}
          <span className="ml-auto text-slate-400 dark:text-slate-700 group-hover:text-slate-500 dark:group-hover:text-slate-500 transition-colors">
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        </button>

        {open && (
          <Card className={`${
            isGate         ? 'border-amber-400/40 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/5' :
            isAutoApproved ? 'border-[#DA7756]/30 dark:border-[#DA7756]/20 bg-orange-50 dark:bg-[#DA7756]/5' :
            isError        ? 'border-red-400/30 dark:border-red-500/25 bg-red-50 dark:bg-red-500/5' :
                             ''
          }`}>
            {isRunning && (
              <div className="flex items-center gap-2">
                <span className="inline-flex gap-[3px] items-end h-4">
                  <span className="w-1 h-2 bg-[#DA7756] rounded-sm animate-bounce [animation-delay:0ms]" />
                  <span className="w-1 h-3 bg-[#DA7756] rounded-sm animate-bounce [animation-delay:150ms]" />
                  <span className="w-1 h-2 bg-[#DA7756] rounded-sm animate-bounce [animation-delay:300ms]" />
                </span>
                <p className="text-sm text-slate-500 dark:text-slate-400">Claude is working…</p>
              </div>
            )}
            {isAutoApproved && step.gate && <AutoApprovedPanel gate={step.gate} />}
            {isGate         && step.gate && <GatePanel gate={step.gate} stepType={step.type} onResume={onResume} />}
            {isDone         && step.summary && <DoneSummary summary={step.summary} stepType={step.type} />}
            {isError && (
              <div className="flex gap-2 text-red-600 dark:text-red-300 text-sm font-medium">
                <AlertCircle size={15} className="shrink-0 mt-0.5" /> An error occurred in this step.
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  )
}

function StepDot({ status }: { status: Step['status'] }) {
  if (status === 'running') return (
    <span className="relative flex h-5 w-5 items-center justify-center">
      <span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400/50" />
      <span className="animate-ping absolute h-3 w-3 rounded-full bg-emerald-400/60 [animation-delay:200ms]" />
      <span className="relative h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.7)]" />
    </span>
  )
  if (status === 'awaiting_gate')  return <Clock       size={20} className="text-amber-500" />
  if (status === 'auto_approved')  return <Bot         size={20} className="text-[#DA7756]" />
  if (status === 'done')           return <CheckCircle size={20} className="text-emerald-500" />
  if (status === 'error')          return <AlertCircle size={20} className="text-red-500" />
  return <Circle size={20} className="text-slate-300 dark:text-slate-700" />
}

function AutoApprovedPanel({ gate }: { gate: Record<string, unknown> }) {
  const labels: Record<string, string> = {
    gate: 'Task proposals', gate_proposal: 'Task proposals', gate_plan: 'Implementation plan',
    gate_review:   'Architecture review', gate_pr: 'Pull request',
  }
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-6 h-6 rounded-full bg-[#DA7756]/15 border border-[#DA7756]/30 flex items-center justify-center shrink-0">
        <Bot size={12} className="text-[#DA7756]" />
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        <span className="text-[#DA7756] dark:text-[#E8A080] font-medium">
          {labels[gate.type as string] ?? 'Gate'}
        </span>
        {' '}auto-approved and continuing
      </p>
    </div>
  )
}

function DoneSummary({ summary, stepType }: { summary: Step['summary']; stepType: Step['type'] }) {
  if (!summary) return null

  if (stepType === 'plan_tech') return (
    <div className="space-y-3">
      {summary.created_tasks && summary.created_tasks.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Tasks Created</p>
          <div className="flex flex-wrap gap-2">
            {summary.created_tasks.map(k => (
              <span key={k} className="text-[13px] font-mono font-semibold bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-300 rounded-lg px-3 py-1">
                {k}
              </span>
            ))}
          </div>
        </div>
      )}
      {summary.skipped_issues && summary.skipped_issues.length > 0 && (
        <p className="text-sm text-slate-500">Skipped: {summary.skipped_issues.join(', ')}</p>
      )}
    </div>
  )

  return (
    <div className="space-y-3">
      {summary.git_branch && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Branch</span>
          <span className="text-[13px] font-mono text-[#DA7756] dark:text-[#E8A080] bg-[#DA7756]/10 px-2.5 py-0.5 rounded-lg">{summary.git_branch}</span>
        </div>
      )}
      {summary.build_status && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Build</span>
          <span className={`text-[13px] font-semibold ${summary.build_status === 'pass' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {summary.build_status}
          </span>
        </div>
      )}
      {summary.plan_files && summary.plan_files.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">{summary.plan_files.length} Files</p>
          <div className="flex flex-wrap gap-1.5">
            {summary.plan_files.slice(0, 6).map(f => (
              <span key={f} className="text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 rounded-lg px-2.5 py-1">
                {f.split('/').pop()}
              </span>
            ))}
            {summary.plan_files.length > 6 && (
              <span className="text-[11px] text-slate-400 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 rounded-lg px-2.5 py-1">
                +{summary.plan_files.length - 6} more
              </span>
            )}
          </div>
        </div>
      )}
      {summary.pr_url && (
        <a href={summary.pr_url} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#DA7756] dark:text-[#E8A080] hover:text-[#DA7756] transition-colors">
          <ExternalLink size={13} /> View Pull Request
        </a>
      )}
    </div>
  )
}

function GatePanel({ gate, stepType, onResume }: {
  gate: Record<string, unknown>; stepType: Step['type']; onResume: (d: string) => void
}) {
  const [editMode, setEditMode]     = useState(false)
  const [editText, setEditText]     = useState('')
  const [showContent, setShowContent] = useState(false)
  const gateType = gate.type as string

  const content      = (gate.plan_content || gate.pr_description || gate.review_output) as string | undefined
  const contentLabel = gate.plan_content ? 'Show full plan' : gate.pr_description ? 'Show PR description' : 'Show details'
  const message      = gate.message as string

  const preClass = 'bg-[var(--bg-code)] border border-slate-200 dark:border-slate-700/50 rounded-xl p-4 text-[13px] text-slate-700 dark:text-slate-300 overflow-auto whitespace-pre-wrap font-mono leading-relaxed'
  const toggleBtn = (label: string) => (
    <button className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 mb-2 transition-colors font-medium"
      onClick={() => setShowContent(v => !v)}>
      {showContent ? <ChevronUp size={13} /> : <ChevronDown size={13} />} {label}
    </button>
  )
  const gateLabel = (t: string) => ({ gate_proposal: 'Task Proposals', gate_plan: 'Implementation Plan', gate_review: 'Architecture Review', gate_pr: 'Pull Request Ready' }[t] ?? 'Review')

  if (gateType === 'gate_review') {
    const violations = gate.violations as string[] | undefined
    return (
      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-1">Architecture Review</p>
          <p className="text-sm text-slate-600 dark:text-slate-300">{message}</p>
        </div>
        {violations && violations.length > 0 && (
          <ul className="space-y-1.5 bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/20 rounded-xl p-4">
            {violations.map((v, i) => (
              <li key={i} className="text-sm text-red-700 dark:text-red-300 flex gap-2.5">
                <span className="text-red-500 shrink-0 mt-0.5">•</span> {v}
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2.5">
          <Button onClick={() => onResume('yes')}>Auto-fix</Button>
          <Button variant="secondary" onClick={() => onResume('no')}>Proceed anyway</Button>
        </div>
      </div>
    )
  }

  if (gateType === 'gate_pr') return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-1">{gateLabel(gateType)}</p>
        <p className="text-sm text-slate-600 dark:text-slate-300">{message}</p>
      </div>
      {gate.branch != null && (
        <span className="inline-block text-[13px] font-mono font-semibold text-[#DA7756] dark:text-[#E8A080] bg-[#DA7756]/10 border border-[#DA7756]/20 px-3 py-1.5 rounded-xl">
          {String(gate.branch)}
        </span>
      )}
      {content && <div>{toggleBtn(contentLabel)}{showContent && <pre className={`${preClass} max-h-52`}>{content}</pre>}</div>}
      <div className="flex gap-2.5">
        <Button onClick={() => onResume('yes')}><CheckCircle size={14} /> Push PR</Button>
        <Button variant="danger" onClick={() => onResume('no')}><XCircle size={14} /> Cancel</Button>
      </div>
    </div>
  )

  const planFiles = gate.plan_files as Array<{ path: string; action: string }> | undefined
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-1">{gateLabel(gateType)}</p>
        <p className="text-sm text-slate-600 dark:text-slate-300">{message}</p>
      </div>
      {planFiles && planFiles.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {planFiles.map(f => (
            <span key={f.path} className="text-[12px] font-mono bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 rounded-lg px-2.5 py-1 text-slate-600 dark:text-slate-300">
              <span className={`mr-1 ${f.action === 'create' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {f.action === 'create' ? '+' : '~'}
              </span>
              {f.path}
            </span>
          ))}
        </div>
      )}
      {stepType === 'plan_tech' && (gate.proposal_text as string | undefined) && (
        <pre className={`${preClass} max-h-64`}>{gate.proposal_text as string}</pre>
      )}
      {content && gateType !== 'gate_proposal' && (
        <div>{toggleBtn(contentLabel)}{showContent && <pre className={`${preClass} max-h-52`}>{content}</pre>}</div>
      )}
      {editMode && <Textarea value={editText} onChange={setEditText} placeholder="Describe your changes…" rows={3} />}
      <div className="flex gap-2.5 flex-wrap">
        <Button onClick={() => onResume('yes')}><CheckCircle size={14} /> Approve</Button>
        {editMode
          ? <Button variant="secondary" onClick={() => onResume(`edit: ${editText}`)} disabled={!editText.trim()}><Edit2 size={14} /> Submit Edit</Button>
          : <Button variant="secondary" onClick={() => setEditMode(true)}><Edit2 size={14} /> Request Edit</Button>
        }
        <Button variant="danger" onClick={() => onResume('no')}><XCircle size={14} /> Cancel</Button>
      </div>
    </div>
  )
}
