import axios from 'axios'

const http = axios.create({ baseURL: '/api' })

// 401 interceptor — clear stale session and redirect to login (skip auth endpoints)
http.interceptors.response.use(
  response => response,
  error => {
    const url = error.config?.url ?? ''
    const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/register')
    if (error.response?.status === 401 && !isAuthEndpoint) {
      localStorage.removeItem('cc_session_token')
      localStorage.removeItem('cc_user')
      window.location.href = '/'
    }
    return Promise.reject(error)
  }
)

let _sessionToken = ''

export function setSessionToken(token: string) {
  _sessionToken = token
  http.defaults.headers.common['Authorization'] = `Bearer ${token}`
}

export function getSessionToken(): string {
  return _sessionToken
}

export function setApiKey(key: string) {
  http.defaults.headers.common['X-API-Key'] = key
}

// ── Auth types ───────────────────────────────────────────────────────────────

export interface AuthResponse {
  token: string
  user_id: string
  email: string
  name: string
  role: string
}

export interface OrgInfo {
  id: string
  name: string
  slug: string
  default_project_id?: string
}

export interface ProjectMemberInfo {
  id: string
  user_id: string
  role: string
}

// ── Connection types ─────────────────────────────────────────────────────────

export type ConnectionType = 'atlassian' | 'azure_devops' | 'github' | 'azure_devops_boards' | 'claude_api'
export type AuthType = 'pat' | 'oauth' | 'api_key'

export interface ConnectionInfo {
  id: string
  type: ConnectionType
  auth_type: AuthType
  base_url: string
  label: string
  status: 'connected' | 'error'
}

export interface CreateConnectionPayload {
  type: ConnectionType
  auth_type: AuthType
  credentials: string
  base_url?: string
  project_name?: string
  extra_config?: Record<string, string>
  label?: string
}

// ── Skills Repo types ────────────────────────────────────────────────────────

export interface SkillsRepoInfo {
  id: string
  connection_id: string
  repo_name: string
  branch: string
  skills_path: string
  rules_path: string
  last_synced_at: string | null
}

export interface CreateSkillsRepoPayload {
  connection_id: string
  repo_name: string
  branch?: string
  skills_path?: string
  rules_path?: string
}

export interface SkillInfo {
  path: string
  name: string
  description: string
  model: string
}

// ── User Profile types ──────────────────────────────────────────────────────

export interface UserProfile {
  id: string
  email: string
  name: string
  role: string
  github_username: string | null
  github_email: string | null
  created_at: string
}

export interface UpdateProfilePayload {
  name?: string
  github_username?: string
  github_email?: string
}

export interface ChangePasswordPayload {
  current_password: string
  new_password: string
}

// ── Admin types ─────────────────────────────────────────────────────────────

export interface CreateUserPayload {
  email: string
  name: string
  password: string
  role: string
}

export interface UserListItem {
  id: string
  email: string
  name: string
  role: string
  github_username: string | null
  created_at: string
}

// ── Skill Content types ─────────────────────────────────────────────────────

export type SkillType = 'develop' | 'review' | 'plan'

export interface SkillContent {
  id: string
  name: string
  skill_type: SkillType
  content: string
  description: string
  repository: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CreateSkillPayload {
  name: string
  skill_type: SkillType
  content: string
  description?: string
  repository?: string | null
}

export interface UpdateSkillPayload {
  name?: string
  skill_type?: string
  content?: string
  description?: string
  repository?: string | null
  is_active?: boolean
}

// ── Task types ──────────────────────────────────────────────────────────────

export interface SourceItem {
  type: string
  name: string
  id: string
}

export interface SourcesResponse {
  repos: SourceItem[]
  projects: SourceItem[]
}

export interface TaskItem {
  id: string
  github_issue_number: number
  github_url: string
  title: string
  body: string
  repo_owner: string
  repo_name: string
  status: string
  priority: string | null
  labels: Array<{ name: string; color: string }>
  story_points: number | null
  due_date: string | null
  github_created_at: string | null
  pulled_at: string
}

export interface DashboardData {
  counts: Record<string, number>
  by_date: Array<{ date: string; done: number; failed: number; pending: number; error: number; interrupted: number }>
  by_repo: Array<{ repo: string; count: number }>
  by_status: Array<{ status: string; count: number }>
  by_priority: Array<{ priority: string; count: number }>
  success_rate_trend: Array<{ date: string; rate: number }>
}

// ── Agent Progress types ────────────────────────────────────────────────────

export interface RunStepData {
  id: string
  step_name: string
  status: string
  started_at: string | null
  completed_at: string | null
  duration_seconds: number | null
  tool_calls: Array<{ tool: string; input: any; output: string; timestamp: string }>
  reasoning: Array<{ content: string; timestamp: string }>
  tokens_in: number
  tokens_out: number
  error: string | null
}

export interface GateData {
  id: string
  gate_type: string
  step_name: string
  status: string
  payload: any
  created_at: string
}

export interface TaskProgress {
  task: TaskItem
  run: {
    id: string
    status: string
    current_step: string
    branch_name: string
    started_at: string | null
    finished_at: string | null
    total_input_tokens: number
    total_output_tokens: number
    error: string
  } | null
  steps: RunStepData[]
  pending_gate: GateData | null
}

// ── Workflow types ────────────────────────────────────────────────────────────

export interface WorkflowStep {
  order: number
  type: 'plan' | 'dev' | 'review' | 'test'
  skill_path: string
  gate_after: boolean
  model_override?: string | null
}

export interface WorkflowTemplate {
  id: string
  name: string
  steps: WorkflowStep[]
  gate_policy: string
  is_default: boolean
}

export interface CreateWorkflowPayload {
  name: string
  steps: WorkflowStep[]
  gate_policy?: string
  is_default?: boolean
}

export interface StepTypeContract {
  type: string
  execution_mode: string
  input: string
  output: string
  description: string
}

// ── Project types ────────────────────────────────────────────────────────────

export interface ProjectInfo {
  id: string
  name: string
  description: string
  org_id: string
}

// ── Run types ────────────────────────────────────────────────────────────────

export interface StepRecord {
  step_id: string
  label: string
  step_type: string
  task_key?: string
  duration_s?: number
  input_tokens?: number
  output_tokens?: number
  build_status?: string
  pr_url?: string
  git_branch?: string
  plan_files?: string[]
  created_tasks?: string[]
  skipped_issues?: string[]
  app_type?: string
}

export interface RunRecord {
  run_id: string
  epic_key: string
  started_at: number
  finished_at: number
  status: string
  auto_approve: boolean
  steps: StepRecord[]
  pr_urls: Array<{ task_key: string; pr_url: string }>
  total_input_tokens: number
  total_output_tokens: number
  model: string
}

export interface BatchResponse {
  batch_id: string
  runs: Array<{ run_id: string; epic_key: string }>
}

export interface RunInfo {
  id: string
  epic_key: string
  status: string
  auto_approve: boolean
  model: string
  started_at: string
  finished_at: string | null
  pr_urls: string[]
  tokens: { input: number; output: number }
  error: string | null
}

export interface DashboardStats {
  stats: {
    total_runs: number
    completed: number
    errors: number
    success_rate: number
    total_tokens: { input: number; output: number }
  }
  recent_runs: Array<{
    id: string
    epic_key: string
    status: string
    started_at: string
    pr_urls: string[]
  }>
}

// ── API client ───────────────────────────────────────────────────────────────

export const api = {
  // Auth
  canRegister: () =>
    http.get<{ can_register: boolean }>('/auth/can-register').then(r => r.data),

  login: (email: string, password: string) =>
    http.post<AuthResponse>('/auth/login', { email, password }).then(r => r.data),

  register: (email: string, password: string, name: string, org_name: string) =>
    http.post<AuthResponse>('/auth/register', { email, password, name, org_name }).then(r => r.data),

  // User profile
  getMe: () =>
    http.get<UserProfile>('/auth/me').then(r => r.data),

  updateProfile: (payload: UpdateProfilePayload) =>
    http.put<UserProfile>('/auth/me/profile', payload).then(r => r.data),

  changePassword: (payload: ChangePasswordPayload) =>
    http.post('/auth/me/password', payload).then(r => r.data),

  // Admin user management
  listUsers: () =>
    http.get<UserListItem[]>('/auth/admin/users').then(r => r.data),

  createUser: (payload: CreateUserPayload) =>
    http.post<UserListItem>('/auth/admin/users', payload).then(r => r.data),

  deleteUser: (userId: string) =>
    http.delete(`/auth/admin/users/${userId}`).then(r => r.data),

  // Connections (user-scoped)
  listConnections: () =>
    http.get<ConnectionInfo[]>('/connections').then(r => r.data),

  createConnection: (payload: CreateConnectionPayload) =>
    http.post('/connections', payload).then(r => r.data),

  deleteConnection: (connId: string) =>
    http.delete(`/connections/${connId}`).then(r => r.data),

  testConnection: (connId: string) =>
    http.get<{ status: string; detail?: string }>(`/connections/${connId}/test`).then(r => r.data),

  // Skills Repos
  listSkillsRepos: (projectId: string) =>
    http.get<SkillsRepoInfo[]>(`/projects/${projectId}/skills-repos`).then(r => r.data),

  createSkillsRepo: (projectId: string, payload: CreateSkillsRepoPayload) =>
    http.post<SkillsRepoInfo>(`/projects/${projectId}/skills-repos`, payload).then(r => r.data),

  deleteSkillsRepo: (projectId: string, repoId: string) =>
    http.delete(`/projects/${projectId}/skills-repos/${repoId}`).then(r => r.data),

  discoverSkills: (projectId: string, repoId: string) =>
    http.get<{ skills: SkillInfo[] }>(`/projects/${projectId}/skills-repos/${repoId}/skills`).then(r => r.data),

  // Skills Content (user-scoped)
  listSkillContent: () =>
    http.get<SkillContent[]>('/skills').then(r => r.data),

  createSkillContent: (payload: CreateSkillPayload) =>
    http.post<SkillContent>('/skills', payload).then(r => r.data),

  updateSkillContent: (skillId: string, payload: UpdateSkillPayload) =>
    http.put<SkillContent>(`/skills/${skillId}`, payload).then(r => r.data),

  deleteSkillContent: (skillId: string) =>
    http.delete(`/skills/${skillId}`).then(r => r.data),

  // Tasks
  getTaskSources: () =>
    http.get<SourcesResponse>('/tasks/sources').then(r => r.data),

  pullTasks: (sourceType: string = 'all', sourceId?: string) =>
    http.post<TaskItem[]>('/tasks/pull', { source_type: sourceType, source_id: sourceId }).then(r => r.data),

  listTasks: (status?: string, repo?: string) => {
    const params = new URLSearchParams()
    if (status) params.append('status', status)
    if (repo) params.append('repo', repo)
    const qs = params.toString()
    return http.get<TaskItem[]>(`/tasks${qs ? `?${qs}` : ''}`).then(r => r.data)
  },

  getDashboardStats: (period: string = 'month', fromDate?: string, toDate?: string) => {
    const params = new URLSearchParams({ period })
    if (fromDate) params.append('from_date', fromDate)
    if (toDate) params.append('to_date', toDate)
    return http.get<DashboardData>(`/dashboard?${params.toString()}`).then(r => r.data)
  },

  // Agent — start, progress, gates
  startTask: (taskId: string) =>
    http.post<{ run_id: string; status: string }>(`/tasks/${taskId}/start`).then(r => r.data),

  getTaskProgress: (taskId: string) =>
    http.get<TaskProgress>(`/tasks/${taskId}/progress`).then(r => r.data),

  approveGate: (runId: string, gateId: string) =>
    http.post<{ status: string }>(`/runs/${runId}/gates/${gateId}/approve`).then(r => r.data),

  rejectGate: (runId: string, gateId: string) =>
    http.post<{ status: string }>(`/runs/${runId}/gates/${gateId}/reject`).then(r => r.data),

  // Workflow Templates
  listWorkflows: (projectId: string) =>
    http.get<WorkflowTemplate[]>(`/projects/${projectId}/workflow-templates`).then(r => r.data),

  createWorkflow: (projectId: string, payload: CreateWorkflowPayload) =>
    http.post<WorkflowTemplate>(`/projects/${projectId}/workflow-templates`, payload).then(r => r.data),

  deleteWorkflow: (projectId: string, templateId: string) =>
    http.delete(`/projects/${projectId}/workflow-templates/${templateId}`).then(r => r.data),

  getStepTypes: (projectId: string) =>
    http.get<{ step_types: StepTypeContract[] }>(`/projects/${projectId}/workflow-templates/step-types`).then(r => r.data),

  // Runs
  startRun: (projectId: string, epicKey: string, workflowTemplateId?: string, autoApprove?: boolean) =>
    http.post<{ run_id: string; status: string }>(`/projects/${projectId}/runs`, {
      epic_key: epicKey,
      workflow_template_id: workflowTemplateId,
      auto_approve: autoApprove ?? false,
    }).then(r => r.data),

  listRuns: (projectId: string) =>
    http.get<RunInfo[]>(`/projects/${projectId}/runs`).then(r => r.data),

  getDashboard: (projectId: string) =>
    http.get<DashboardStats>(`/projects/${projectId}/dashboard`).then(r => r.data),

  resumeGate: (runId: string, decision: string, stepOrder?: number) =>
    http.post(`/runs/${runId}/resume`, { decision, step_order: stepOrder }).then(r => r.data),

  getGate: (runId: string) =>
    http.get(`/runs/${runId}/gate`).then(r => r.data),

  // Batch Run
  startBatch: (epics: string[], repoPath: string, autoApprove: boolean) =>
    http.post<BatchResponse>('/workflow/batch-run', { epics, repo_path: repoPath, auto_approve: autoApprove }).then(r => r.data),
}
