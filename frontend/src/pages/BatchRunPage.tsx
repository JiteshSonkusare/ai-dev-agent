import { useRef, useState } from 'react'
import { Layers, Play, Plus, X, AlertCircle, FlaskConical, CheckCircle2, Bot, UserCheck, RotateCcw, ExternalLink } from 'lucide-react'
import { useBatchRun, MOCK_EPICS_LIST } from '../hooks/useBatchRun'
import { EpicRunCard } from '../components/EpicRunCard'
import { Card, Label, Input, Button, Spinner, StatusBadge } from '../components/ui'

export default function BatchRunPage() {
  const [epicInput, setEpicInput] = useState('')
  const [epics, setEpics] = useState<string[]>([])
  const [repoPath, setRepoPath] = useState('')
  const [autoApprove, setAutoApprove] = useState(true)
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const resumeRef = useRef<((runId: string, decision: string) => void) | null>(null)

  const { state, start, startMock, reset } = useBatchRun()
  const isIdle = state.status === 'idle'
  const isFinished = state.status === 'done' || state.status === 'error'

  const isMock = epics.length > 0 && epics.every(e => MOCK_EPICS_LIST.includes(e))
  const canStart = epics.length > 0 && (isMock || repoPath.trim()) && !starting && isIdle

  function addEpic() {
    const id = epicInput.trim().toUpperCase()
    if (id && !epics.includes(id)) {
      setEpics(prev => [...prev, id])
    }
    setEpicInput('')
  }

  function removeEpic(id: string) {
    setEpics(prev => prev.filter(e => e !== id))
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); addEpic() }
  }

  async function handleStart() {
    setStartError(null)
    setStarting(true)
    try {
      if (isMock) {
        const { resume } = startMock(epics, autoApprove)
        resumeRef.current = resume
      } else {
        const { resume } = await start(epics, repoPath.trim(), autoApprove)
        resumeRef.current = resume
      }
    } catch (e: unknown) {
      setStartError(e instanceof Error ? e.message : String(e))
    } finally {
      setStarting(false)
    }
  }

  function handleResume(runId: string, decision: string) {
    resumeRef.current?.(runId, decision)
  }

  const doneRuns = state.runs.filter(r => r.status === 'done').length
  const totalPRs = state.runs.reduce((sum, r) => sum + r.prUrls.length, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-9 h-9 rounded-xl bg-[#DA7756]/15 border border-[#DA7756]/25 flex items-center justify-center">
          <Layers size={17} className="text-[#DA7756]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-tight">Batch Run</h1>
          <p className="text-sm text-slate-500">Run multiple epics in parallel — each flow is independent</p>
        </div>
      </div>

      {isIdle && (
        <Card>
          <div className="space-y-5">
            <div>
              <Label>Epic Keys</Label>
              <div className="flex gap-2">
                <Input
                  value={epicInput}
                  onChange={setEpicInput}
                  placeholder="e.g. CCF-1234"
                  className="flex-1"
                  onKeyDown={handleKeyDown}
                />
                <Button variant="secondary" onClick={addEpic} disabled={!epicInput.trim()}>
                  <Plus size={14} /> Add
                </Button>
              </div>
              <p className="text-xs text-slate-500 mt-1.5">Add one or more epics. Each runs its own flow in parallel.</p>
            </div>

            {epics.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {epics.map(id => (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1.5 text-[13px] font-mono font-semibold bg-[#DA7756]/10 border border-[#DA7756]/25 rounded-full px-3 py-1 text-[#DA7756] dark:text-[#E8A080]"
                  >
                    {id}
                    <button onClick={() => removeEpic(id)} className="hover:text-red-500 transition-colors">
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {isMock && epics.length > 0 && (
              <p className="text-xs text-[#DA7756] flex items-center gap-1">
                <FlaskConical size={11} /> Demo mode — {epics.length} epic{epics.length > 1 ? 's' : ''} will run as mock
              </p>
            )}

            {!isMock && epics.length > 0 && (
              <div>
                <Label>Repo Path (server-side)</Label>
                <Input value={repoPath} onChange={setRepoPath} placeholder="/home/runner/repos/my-service" />
                <p className="text-xs text-slate-500 mt-1.5">Shared repo — each epic uses its own git worktree.</p>
              </div>
            )}

            {/* Automation mode toggle */}
            <div
              className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all select-none ${
                autoApprove
                  ? 'bg-[#DA7756]/10 border-[#DA7756]/30'
                  : 'bg-slate-100/80 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-700/40 hover:border-slate-300 dark:hover:border-slate-600/60'
              }`}
              onClick={() => setAutoApprove(v => !v)}
            >
              <div className={`w-10 h-6 rounded-full flex items-center transition-all px-0.5 ${autoApprove ? 'bg-[#DA7756]' : 'bg-slate-300 dark:bg-slate-700'}`}>
                <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${autoApprove ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  {autoApprove
                    ? <Bot size={14} className="text-[#DA7756]" />
                    : <UserCheck size={14} className="text-slate-400" />
                  }
                  <span className={`text-sm font-semibold ${autoApprove ? 'text-[#DA7756] dark:text-[#E8A080]' : 'text-slate-600 dark:text-slate-300'}`}>
                    {autoApprove ? 'Fully Automated' : 'Manual Gates'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {autoApprove
                    ? 'All steps auto-approved — runs epics to PRs without intervention'
                    : 'Pauses at each gate for your review before continuing'
                  }
                </p>
              </div>
            </div>

            {startError && (
              <p className="text-sm text-red-500 dark:text-red-400 flex gap-1.5 items-center">
                <AlertCircle size={13} /> {startError}
              </p>
            )}

            <Button onClick={handleStart} disabled={!canStart} className="w-full justify-center py-3">
              {starting
                ? <><Spinner className="w-4 h-4" /> Starting…</>
                : isMock
                  ? <><FlaskConical size={15} /> Run Demo ({epics.length} epic{epics.length > 1 ? 's' : ''})</>
                  : <><Play size={15} /> {epics.length > 1 ? `Start Batch (${epics.length} epics)` : 'Start Run'}</>}
            </Button>
          </div>
        </Card>
      )}

      {/* Batch progress header */}
      {state.status !== 'idle' && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <StatusBadge status={state.status === 'connecting' ? 'running' : state.status} />
            {(state.status === 'running' || state.status === 'connecting') && (
              <Spinner className="w-4 h-4 text-blue-500 dark:text-blue-400" />
            )}
            <span className="text-sm text-slate-500">
              {doneRuns}/{state.runs.length} epics complete
            </span>
          </div>
          {totalPRs > 0 && (
            <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
              {totalPRs} PR{totalPRs > 1 ? 's' : ''} raised
            </span>
          )}
        </div>
      )}

      {/* Epic run cards */}
      {state.runs.length > 0 && (
        <div className="space-y-3">
          {state.runs.map(run => (
            <EpicRunCard key={run.run_id} run={run} onResume={handleResume} />
          ))}
        </div>
      )}

      {/* Completion summary */}
      {state.status === 'done' && totalPRs > 0 && (
        <div className="rounded-2xl overflow-hidden border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-[var(--bg-card)] to-[#DA7756]/5">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-emerald-500/15 bg-emerald-500/5">
            <div className="w-7 h-7 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <CheckCircle2 size={14} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-[15px] font-bold text-emerald-700 dark:text-emerald-300 leading-tight">Batch complete</p>
              <p className="text-xs text-slate-500">{totalPRs} pull request{totalPRs > 1 ? 's' : ''} across {state.runs.filter(r => r.prUrls.length > 0).length} epic{state.runs.filter(r => r.prUrls.length > 0).length > 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="px-6 py-4 space-y-3">
            {state.runs.filter(r => r.prUrls.length > 0).map(run => (
              <div key={run.run_id}>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">{run.epic_key}</p>
                <div className="flex flex-wrap gap-2">
                  {run.prUrls.map(({ task_key, pr_url }) => (
                    <a
                      key={task_key}
                      href={pr_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-[12px] font-mono font-semibold text-[#DA7756] dark:text-[#E8A080] bg-[#DA7756]/10 border border-[#DA7756]/20 px-3 py-1.5 rounded-lg hover:bg-[#DA7756]/20 transition-colors"
                    >
                      {task_key} <ExternalLink size={10} />
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isFinished && (
        <Button variant="secondary" onClick={reset} className="w-full justify-center py-3">
          <RotateCcw size={15} /> Start Another Batch
        </Button>
      )}
    </div>
  )
}
