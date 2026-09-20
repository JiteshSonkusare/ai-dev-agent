import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, RefreshCw, GitBranch, Kanban, Search, AlertCircle,
  ExternalLink, Tag, Clock, ListTodo, Play, CheckCircle2,
} from 'lucide-react'
import { api } from '../api/client'
import type { TaskItem, SourceItem } from '../api/client'
import { Card, Button } from '../components/ui'

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

const PRIORITY_STYLES: Record<string, string> = {
  critical: 'text-red-600 bg-red-500/10', high: 'text-orange-500 bg-orange-500/10',
  p0: 'text-red-600 bg-red-500/10', p1: 'text-orange-500 bg-orange-500/10',
  medium: 'text-yellow-600 bg-yellow-500/10', p2: 'text-yellow-600 bg-yellow-500/10',
  low: 'text-slate-500 bg-slate-400/10', p3: 'text-slate-500 bg-slate-400/10',
}

export default function PullTasksPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<'source' | 'results'>('source')

  // Source selection
  const [repos, setRepos] = useState<SourceItem[]>([])
  const [projects, setProjects] = useState<SourceItem[]>([])
  const [sourcesLoading, setSourcesLoading] = useState(true)
  const [sourcesError, setSourcesError] = useState('')
  const [selected, setSelected] = useState<{ type: string; id?: string; label: string }>({ type: 'all', label: 'All assigned issues' })
  const [repoSearch, setRepoSearch] = useState('')

  // Pull results
  const [pulling, setPulling] = useState(false)
  const [pullError, setPullError] = useState('')
  const [pulledTasks, setPulledTasks] = useState<TaskItem[]>([])
  const [startingId, setStartingId] = useState<string | null>(null)

  useEffect(() => {
    async function loadSources() {
      try {
        const result = await api.getTaskSources()
        setRepos(result.repos)
        setProjects(result.projects)
      } catch (e: any) {
        setSourcesError(e.response?.data?.detail || 'Failed to connect to GitHub')
      } finally {
        setSourcesLoading(false)
      }
    }
    loadSources()
  }, [])

  async function handlePull() {
    setPulling(true)
    setPullError('')
    try {
      const tasks = await api.pullTasks(selected.type, selected.id)
      setPulledTasks(tasks)
      setStep('results')
    } catch (e: any) {
      setPullError(e.response?.data?.detail || 'Failed to pull tasks from GitHub')
    } finally {
      setPulling(false)
    }
  }

  const filteredRepos = repoSearch
    ? repos.filter(r => r.name.toLowerCase().includes(repoSearch.toLowerCase()))
    : repos

  // ── Source Selection View ──────────────────────────────────────────────────

  if (step === 'source') {
    return (
      <div className="max-w-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/tasks')}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-tight">Pull Backlog Tasks</h1>
            <p className="text-sm text-slate-500">Select a source to fetch your assigned issues that haven't been started</p>
          </div>
        </div>

        {/* Error state */}
        {sourcesError ? (
          <Card className="py-8">
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center mb-3">
                <AlertCircle size={24} className="text-red-500" />
              </div>
              <p className="text-[14px] font-medium text-slate-700 dark:text-slate-200">GitHub Not Configured</p>
              <p className="text-[12px] text-slate-400 mt-1 max-w-sm">{sourcesError}</p>
              <div className="mt-4">
                <Button variant="secondary" onClick={() => navigate('/settings')}>Go to Settings</Button>
              </div>
            </div>
          </Card>
        ) : sourcesLoading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw size={20} className="animate-spin text-slate-400" />
          </div>
        ) : (
          <>
            {/* All issues */}
            <div>
              <button
                onClick={() => setSelected({ type: 'all', label: 'All assigned issues' })}
                className={`w-full text-left px-4 py-3.5 rounded-xl border-2 transition-all ${
                  selected.type === 'all'
                    ? 'border-[#DA7756] bg-[#DA7756]/5 shadow-sm'
                    : 'border-slate-200 dark:border-slate-700/40 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#DA7756]/10 flex items-center justify-center shrink-0">
                    <ListTodo size={16} className="text-[#DA7756]" />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">All Assigned Issues</p>
                    <p className="text-[11px] text-slate-400">Open backlog items across all your repositories</p>
                  </div>
                </div>
              </button>
            </div>

            {/* GitHub Projects */}
            {projects.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest px-1 flex items-center gap-1.5">
                  <Kanban size={10} /> GitHub Projects
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {projects.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setSelected({ type: 'project', id: p.id, label: p.name })}
                      className={`text-left px-3 py-2.5 rounded-xl border-2 transition-all ${
                        selected.type === 'project' && selected.id === p.id
                          ? 'border-[#DA7756] bg-[#DA7756]/5 shadow-sm'
                          : 'border-slate-200 dark:border-slate-700/40 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Kanban size={14} className="text-purple-400 shrink-0" />
                        <p className="text-[13px] font-medium text-slate-800 dark:text-slate-100 truncate">{p.name}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Repositories */}
            {repos.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest px-1 flex items-center gap-1.5">
                  <GitBranch size={10} /> Repositories ({repos.length})
                </p>
                {repos.length > 6 && (
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={repoSearch}
                      onChange={e => setRepoSearch(e.target.value)}
                      placeholder="Filter repositories..."
                      className="w-full bg-[var(--bg-input)] border border-slate-300 dark:border-slate-600/60 rounded-lg pl-9 pr-3 py-1.5 text-[12px] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-[#DA7756]"
                    />
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-[40vh] overflow-y-auto">
                  {filteredRepos.map(r => (
                    <button
                      key={r.id}
                      onClick={() => setSelected({ type: 'repo', id: r.id, label: r.name })}
                      className={`text-left px-3 py-2 rounded-lg border transition-all ${
                        selected.type === 'repo' && selected.id === r.id
                          ? 'border-[#DA7756] bg-[#DA7756]/5'
                          : 'border-slate-200 dark:border-slate-700/40 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <GitBranch size={12} className="text-slate-400 shrink-0" />
                        <p className="text-[12px] font-medium text-slate-700 dark:text-slate-200 truncate">{r.name}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Pull button */}
            {pullError && (
              <div className="flex items-center gap-2 text-[12px] text-red-500 bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2">
                <AlertCircle size={13} /> {pullError}
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700/40">
              <p className="text-[11px] text-slate-400">
                Source: <span className="font-medium text-slate-600 dark:text-slate-300">{selected.label}</span>
              </p>
              <Button onClick={handlePull} disabled={pulling}>
                {pulling ? <><RefreshCw size={12} className="animate-spin" /> Pulling...</> : <><RefreshCw size={12} /> Pull Backlog Tasks</>}
              </Button>
            </div>
          </>
        )}
      </div>
    )
  }

  // ── Results View ──────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setStep('source')}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-tight">
              Pulled {pulledTasks.length} Task{pulledTasks.length !== 1 ? 's' : ''}
            </h1>
            <p className="text-sm text-slate-500">From: {selected.label}</p>
          </div>
        </div>
        <Button variant="secondary" onClick={() => navigate('/tasks')}>
          <ListTodo size={12} /> Back to My Tasks
        </Button>
      </div>

      {/* Results */}
      {pulledTasks.length === 0 ? (
        <Card className="text-center py-10">
          <CheckCircle2 size={32} className="mx-auto text-emerald-400 mb-3" />
          <p className="text-[14px] font-medium text-slate-600 dark:text-slate-300">No new backlog tasks found</p>
          <p className="text-[12px] text-slate-400 mt-1">All assigned issues are either already pulled or in progress</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {pulledTasks.map(task => (
            <div key={task.id} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700/40 bg-[var(--bg-card)]">
              <a href={task.github_url} target="_blank" rel="noopener noreferrer"
                className="text-[12px] font-mono font-bold text-[#DA7756] hover:underline shrink-0">
                #{task.github_issue_number}
              </a>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-slate-800 dark:text-slate-100 truncate">{task.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <GitBranch size={9} /> {task.repo_name}
                  </span>
                  {task.priority && (
                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${PRIORITY_STYLES[task.priority.toLowerCase()] ?? 'text-slate-500 bg-slate-400/10'}`}>
                      {task.priority}
                    </span>
                  )}
                  {task.story_points != null && (
                    <span className="text-[9px] text-slate-400"><Tag size={8} className="inline" /> {task.story_points}sp</span>
                  )}
                  {task.github_created_at && (
                    <span className="text-[9px] text-slate-400 ml-auto"><Clock size={8} className="inline" /> {fmtDate(task.github_created_at)}</span>
                  )}
                </div>
              </div>
              <a href={task.github_url} target="_blank" rel="noopener noreferrer"
                className="p-1.5 rounded-lg text-slate-400 hover:text-[#DA7756] transition-colors shrink-0" title="Open in GitHub">
                <ExternalLink size={12} />
              </a>
              <Button
                className="text-[10px] px-2 py-1"
                disabled={startingId === task.id}
                onClick={async () => {
                  setStartingId(task.id)
                  try {
                    await api.startTask(task.id)
                    navigate(`/tasks/${task.id}/progress`)
                  } catch { setStartingId(null) }
                }}
              >
                {startingId === task.id ? <RefreshCw size={10} className="animate-spin" /> : <Play size={10} />}
                Start
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
