import { useCallback, useReducer, useRef } from 'react'
import type { RunRecord, StepRecord } from '../api/client'

export type StepType = 'plan_tech' | 'dev'
export type StepStatus = 'pending' | 'running' | 'awaiting_gate' | 'auto_approved' | 'done' | 'error'

export interface Step {
  id: string
  type: StepType
  label: string
  task_key?: string
  status: StepStatus
  gate?: Record<string, unknown>
  started_at?: number
  duration_s?: number
  summary?: {
    created_tasks?: string[]
    skipped_issues?: string[]
    pr_url?: string
    build_status?: string
    git_branch?: string
    plan_files?: string[]
    input_tokens?: number
    output_tokens?: number
  }
}

export interface EpicRun {
  run_id: string
  epic_key: string
  status: 'running' | 'done' | 'error'
  steps: Step[]
  prUrls: Array<{ task_key: string; pr_url: string }>
  error?: string
}

export interface BatchState {
  status: 'idle' | 'connecting' | 'running' | 'done' | 'error'
  batch_id?: string
  runs: EpicRun[]
  startedAt?: number
}

type Action =
  | { type: 'CONNECT'; batch_id: string; runs: Array<{ run_id: string; epic_key: string }> }
  | { type: 'RESET' }
  | { type: 'STEP_START'; run_id: string; step_id: string; step_type: StepType; label: string; task_key?: string }
  | { type: 'STEP_GATE'; run_id: string; step_id: string; gate: Record<string, unknown> }
  | { type: 'STEP_GATE_AUTO'; run_id: string; step_id: string; gate: Record<string, unknown> }
  | { type: 'STEP_DONE'; run_id: string; step_id: string; summary: Step['summary']; duration_s?: number }
  | { type: 'RUN_DONE'; run_id: string; pr_urls: Array<{ task_key: string; pr_url: string }> }
  | { type: 'RUN_ERROR'; run_id: string; error: string }
  | { type: 'BATCH_DONE' }

function updateRun(runs: EpicRun[], run_id: string, fn: (r: EpicRun) => EpicRun): EpicRun[] {
  return runs.map(r => r.run_id === run_id ? fn(r) : r)
}

function reducer(state: BatchState, action: Action): BatchState {
  switch (action.type) {
    case 'CONNECT':
      return {
        status: 'connecting',
        batch_id: action.batch_id,
        runs: action.runs.map(r => ({ run_id: r.run_id, epic_key: r.epic_key, status: 'running', steps: [], prUrls: [] })),
        startedAt: Date.now(),
      }
    case 'RESET':
      return INIT
    case 'STEP_START':
      return {
        ...state,
        status: 'running',
        runs: updateRun(state.runs, action.run_id, r => ({
          ...r,
          steps: [
            ...r.steps.map(s => s.status === 'running' ? { ...s, status: 'done' as StepStatus } : s),
            { id: action.step_id, type: action.step_type, label: action.label, task_key: action.task_key, status: 'running', started_at: Date.now() },
          ],
        })),
      }
    case 'STEP_GATE':
      return {
        ...state,
        runs: updateRun(state.runs, action.run_id, r => ({
          ...r,
          steps: r.steps.map(s => s.id === action.step_id ? { ...s, status: 'awaiting_gate', gate: action.gate } : s),
        })),
      }
    case 'STEP_GATE_AUTO':
      return {
        ...state,
        runs: updateRun(state.runs, action.run_id, r => ({
          ...r,
          steps: r.steps.map(s => s.id === action.step_id ? { ...s, status: 'auto_approved', gate: action.gate } : s),
        })),
      }
    case 'STEP_DONE': {
      const now = Date.now()
      return {
        ...state,
        runs: updateRun(state.runs, action.run_id, r => ({
          ...r,
          steps: r.steps.map(s => {
            if (s.id !== action.step_id) return s
            const duration_s = action.duration_s ?? (s.started_at ? Math.round((now - s.started_at) / 100) / 10 : undefined)
            return { ...s, status: 'done', gate: undefined, summary: action.summary, duration_s }
          }),
        })),
      }
    }
    case 'RUN_DONE':
      return {
        ...state,
        runs: updateRun(state.runs, action.run_id, r => ({
          ...r,
          status: 'done',
          prUrls: action.pr_urls,
          steps: r.steps.map(s => s.status === 'running' ? { ...s, status: 'done' } : s),
        })),
      }
    case 'RUN_ERROR':
      return {
        ...state,
        runs: updateRun(state.runs, action.run_id, r => ({
          ...r,
          status: 'error',
          error: action.error,
          steps: r.steps.map(s => s.status === 'running' ? { ...s, status: 'error' } : s),
        })),
      }
    case 'BATCH_DONE':
      return {
        ...state,
        status: state.runs.some(r => r.status === 'error') ? 'error' : 'done',
      }
    default:
      return state
  }
}

const INIT: BatchState = { status: 'idle', runs: [] }

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ── localStorage run history ─────────────────────────────────────────────────

function saveRunsToHistory(runs: EpicRun[]): void {
  try {
    const existing: RunRecord[] = JSON.parse(localStorage.getItem('cc_run_history') ?? '[]')
    const newRecords: RunRecord[] = runs.map(r => {
      const steps: StepRecord[] = r.steps.map(s => ({
        step_id: s.id, label: s.label, step_type: s.type, task_key: s.task_key,
        duration_s: s.duration_s, input_tokens: s.summary?.input_tokens,
        output_tokens: s.summary?.output_tokens, build_status: s.summary?.build_status,
        pr_url: s.summary?.pr_url, git_branch: s.summary?.git_branch,
        plan_files: s.summary?.plan_files, created_tasks: s.summary?.created_tasks,
        skipped_issues: s.summary?.skipped_issues,
      }))
      return {
        run_id: r.run_id, epic_key: r.epic_key,
        started_at: Date.now() / 1000, finished_at: Date.now() / 1000,
        status: r.status === 'done' ? 'done' : 'error',
        auto_approve: true, steps, pr_urls: r.prUrls,
        total_input_tokens: steps.reduce((a, s) => a + (s.input_tokens ?? 0), 0),
        total_output_tokens: steps.reduce((a, s) => a + (s.output_tokens ?? 0), 0),
        model: 'claude-opus-4-7',
      }
    })
    const updated = [...newRecords, ...existing].slice(0, 30)
    localStorage.setItem('cc_run_history', JSON.stringify(updated))
  } catch { /* silently ignore */ }
}

// ── Mock runner ──────────────────────────────────────────────────────────────

const MOCK_EPICS: Record<string, { tasks: string[]; proposal: string }> = {
  'CCF-1234': {
    tasks: ['CCF-1111', 'CCF-2222'],
    proposal: '## CCF-1111 — Implement Customer Profile API\n**App type:** dotnet-api\n\n## CCF-2222 — Build Customer Profile UI\n**App type:** react-app',
  },
  'CCF-5678': {
    tasks: ['CCF-3333'],
    proposal: '## CCF-3333 — Add Payment Integration\n**App type:** dotnet-api',
  },
  'CCF-9999': {
    tasks: ['CCF-4444', 'CCF-5555'],
    proposal: '## CCF-4444 — Audit Log Service\n**App type:** dotnet-api\n\n## CCF-5555 — Audit Dashboard\n**App type:** react-app',
  },
}

async function runMockEpic(
  epic_key: string,
  run_id: string,
  dispatch: React.Dispatch<Action>,
  waitForGate: (runId: string) => Promise<string>,
  autoApprove: boolean,
  delay: number,
) {
  await sleep(delay)
  const mock = MOCK_EPICS[epic_key] ?? { tasks: ['MOCK-001'], proposal: '## MOCK-001 — Default Task\n**App type:** unknown' }

  dispatch({ type: 'STEP_START', run_id, step_id: 'plan_tech', step_type: 'plan_tech', label: `Plan Tech — ${epic_key}` })
  await sleep(1500 + Math.random() * 1000)

  const gate0 = { type: 'gate_proposal', message: 'Review the proposed tasks.', proposal_text: mock.proposal }
  dispatch({ type: autoApprove ? 'STEP_GATE_AUTO' : 'STEP_GATE', run_id, step_id: 'plan_tech', gate: gate0 })
  const d0 = autoApprove ? (await sleep(500), 'yes') : await waitForGate(run_id)
  if (d0 === 'no') { dispatch({ type: 'RUN_ERROR', run_id, error: 'Cancelled.' }); return }

  await sleep(400)
  dispatch({ type: 'STEP_DONE', run_id, step_id: 'plan_tech', summary: { created_tasks: mock.tasks, skipped_issues: [], input_tokens: 3800, output_tokens: 720 } })
  await sleep(300)

  for (const task of mock.tasks) {
    dispatch({ type: 'STEP_START', run_id, step_id: `dev_${task}`, step_type: 'dev', label: `Dev — ${task}`, task_key: task })
    await sleep(1200 + Math.random() * 1500)

    const gate1 = { type: 'gate_plan', message: 'Review implementation plan.', plan_files: [{ path: `src/${task}.cs`, action: 'create' }] }
    dispatch({ type: autoApprove ? 'STEP_GATE_AUTO' : 'STEP_GATE', run_id, step_id: `dev_${task}`, gate: gate1 })
    const d1 = autoApprove ? (await sleep(400), 'yes') : await waitForGate(run_id)
    if (d1 === 'no') {
      dispatch({ type: 'STEP_DONE', run_id, step_id: `dev_${task}`, summary: { build_status: 'cancelled' } })
      continue
    }

    await sleep(800 + Math.random() * 1000)
    const gate2 = { type: 'gate_pr', message: 'PR ready. Push?', branch: `feature/${task}-impl`, pr_description: `## ${task}\nImplementation complete.` }
    dispatch({ type: autoApprove ? 'STEP_GATE_AUTO' : 'STEP_GATE', run_id, step_id: `dev_${task}`, gate: gate2 })
    const d2 = autoApprove ? (await sleep(300), 'yes') : await waitForGate(run_id)

    await sleep(300)
    dispatch({
      type: 'STEP_DONE', run_id, step_id: `dev_${task}`,
      summary: {
        pr_url: d2 === 'yes' ? `https://dev.azure.com/example/_git/repo/pullrequest/${Math.floor(Math.random() * 200)}` : undefined,
        build_status: 'pass', git_branch: `feature/${task}-impl`,
        plan_files: [`src/${task}.cs`], input_tokens: 7000, output_tokens: 1800,
      },
    })
  }

  const prUrls = mock.tasks.map(t => ({ task_key: t, pr_url: `https://dev.azure.com/example/_git/repo/pullrequest/${Math.floor(Math.random() * 200)}` }))
  dispatch({ type: 'RUN_DONE', run_id, pr_urls: prUrls })
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export const MOCK_EPICS_LIST = Object.keys(MOCK_EPICS)

export function useBatchRun() {
  const [state, dispatch] = useReducer(reducer, INIT)
  const stateRef = useRef(state)
  stateRef.current = state

  const abortRef = useRef<AbortController | null>(null)
  const gateResolversRef = useRef<Map<string, (d: string) => void>>(new Map())

  const reset = useCallback(() => dispatch({ type: 'RESET' }), [])

  const startMock = useCallback((epics: string[], autoApprove: boolean) => {
    const runs = epics.map(e => ({ run_id: `mock-${e}-${Date.now()}`, epic_key: e.trim().toUpperCase() }))
    dispatch({ type: 'CONNECT', batch_id: `mock-batch-${Date.now()}`, runs })

    const waitForGate = (runId: string) =>
      new Promise<string>(resolve => { gateResolversRef.current.set(runId, resolve) })

    const resume = (runId: string, decision: string) => {
      const resolver = gateResolversRef.current.get(runId)
      if (resolver) { resolver(decision); gateResolversRef.current.delete(runId) }
    }

    Promise.all(
      runs.map((r, i) => runMockEpic(r.epic_key, r.run_id, dispatch, waitForGate, autoApprove, i * 300))
    ).then(() => {
      dispatch({ type: 'BATCH_DONE' })
      saveRunsToHistory(stateRef.current.runs)
    })

    return { batch_id: 'mock-batch', resume }
  }, [])

  const start = useCallback(async (epics: string[], repoPath: string, autoApprove: boolean) => {
    abortRef.current?.abort()

    const apiKey = localStorage.getItem('cc_api_key') ?? ''
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (apiKey) headers['X-API-Key'] = apiKey

    const res = await fetch('/api/workflow/batch-run', {
      method: 'POST',
      headers,
      body: JSON.stringify({ epics, repo_path: repoPath, auto_approve: autoApprove }),
    })
    if (!res.ok) throw new Error(`Failed to start batch: ${res.status}`)
    const { batch_id, runs } = await res.json()

    dispatch({ type: 'CONNECT', batch_id, runs })

    const ac = new AbortController()
    abortRef.current = ac

    const stream = await fetch(`/api/workflow/batch-run/${batch_id}/stream`, {
      headers: apiKey ? { 'X-API-Key': apiKey } : {},
      signal: ac.signal,
    })
    if (!stream.body) throw new Error('No stream body')

    const resume = async (runId: string, decision: string) => {
      await fetch(`/api/workflow/batch-run/${batch_id}/runs/${runId}/resume`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ decision }),
      })
    }

    const reader = stream.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''

    ;(async () => {
      try {
        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          buf += decoder.decode(value, { stream: true })
          const lines = buf.split('\n')
          buf = lines.pop() ?? ''
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const event = JSON.parse(line.slice(6))
            const run_id = event.run_id as string
            if (event.type === 'step_start')
              dispatch({ type: 'STEP_START', run_id, step_id: event.step_id, step_type: event.step_type, label: event.label, task_key: event.task_key })
            else if (event.type === 'step_gate')
              dispatch({ type: 'STEP_GATE', run_id, step_id: event.step_id, gate: event.gate })
            else if (event.type === 'step_gate_auto')
              dispatch({ type: 'STEP_GATE_AUTO', run_id, step_id: event.step_id, gate: event.gate })
            else if (event.type === 'step_done')
              dispatch({ type: 'STEP_DONE', run_id, step_id: event.step_id, summary: { ...event.summary, input_tokens: event.input_tokens, output_tokens: event.output_tokens }, duration_s: event.duration_s })
            else if (event.type === 'run_done')
              dispatch({ type: 'RUN_DONE', run_id, pr_urls: event.pr_urls ?? [] })
            else if (event.type === 'run_error')
              dispatch({ type: 'RUN_ERROR', run_id, error: event.error })
            else if (event.type === 'batch_done')
              dispatch({ type: 'BATCH_DONE' })
          }
        }
      } catch (e: unknown) {
        if (e instanceof Error && e.name !== 'AbortError')
          dispatch({ type: 'BATCH_DONE' })
      }
    })()

    return { batch_id, resume }
  }, [])

  return { state, start, startMock, reset }
}
