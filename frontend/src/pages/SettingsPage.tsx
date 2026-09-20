import { useEffect, useState } from 'react'
import {
  Settings, Plus, Trash2, CheckCircle, AlertCircle, RefreshCw,
  Database, Bot, GitBranch, TestTube, Eye, EyeOff,
  User, KeyRound, FileCode, Save,
} from 'lucide-react'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import type {
  ConnectionInfo, CreateConnectionPayload, ConnectionType, AuthType,
  UserProfile, SkillContent, SkillType,
} from '../api/client'
import { Card, Label, Input, Button, Textarea } from '../components/ui'

type TabKey = 'profile' | 'connections' | 'skills'

const TABS: { key: TabKey; label: string; icon: typeof User }[] = [
  { key: 'profile', label: 'Profile', icon: User },
  { key: 'connections', label: 'Connections', icon: Database },
  { key: 'skills', label: 'Skills', icon: FileCode },
]

// ══════════════════════════════════════════════════════════════════════════════
// PROFILE TAB
// ══════════════════════════════════════════════════════════════════════════════

function ProfileTab() {
  const { refreshUser } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Editable fields
  const [name, setName] = useState('')
  const [githubUsername, setGithubUsername] = useState('')
  const [githubEmail, setGithubEmail] = useState('')

  // Password change
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMessage, setPwMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const p = await api.getMe()
        setProfile(p)
        setName(p.name)
        setGithubUsername(p.github_username ?? '')
        setGithubEmail(p.github_email ?? '')
      } catch {
        setMessage({ type: 'error', text: 'Failed to load profile' })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function handleSaveProfile() {
    setSaving(true)
    setMessage(null)
    try {
      const updated = await api.updateProfile({
        name: name.trim(),
        github_username: githubUsername.trim() || undefined,
        github_email: githubEmail.trim() || undefined,
      })
      setProfile(updated)
      await refreshUser()
      setMessage({ type: 'success', text: 'Profile updated' })
    } catch (e: any) {
      setMessage({ type: 'error', text: e.response?.data?.detail || 'Failed to update profile' })
    } finally {
      setSaving(false)
    }
  }

  async function handleChangePassword() {
    setPwMessage(null)
    if (newPassword !== confirmPassword) {
      setPwMessage({ type: 'error', text: 'Passwords do not match' })
      return
    }
    if (newPassword.length < 6) {
      setPwMessage({ type: 'error', text: 'Password must be at least 6 characters' })
      return
    }
    setPwSaving(true)
    try {
      await api.changePassword({ current_password: currentPassword, new_password: newPassword })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPwMessage({ type: 'success', text: 'Password changed successfully' })
    } catch (e: any) {
      setPwMessage({ type: 'error', text: e.response?.data?.detail || 'Failed to change password' })
    } finally {
      setPwSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw size={20} className="animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Profile Info */}
      <Card>
        <div className="space-y-3">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Account Information</p>

          <div>
            <Label>Email</Label>
            <Input value={profile?.email ?? ''} onChange={() => {}} disabled placeholder="" />
            <p className="text-xs text-slate-400 mt-1">Email cannot be changed</p>
          </div>

          <div>
            <Label>Display Name</Label>
            <Input value={name} onChange={setName} placeholder="Your name" />
          </div>

          <div className="border-t border-slate-200 dark:border-slate-700/40 pt-3 mt-3">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-3">GitHub Identity</p>
            <p className="text-[11px] text-slate-500 mb-3">
              Used for git commits and pull requests created by the AI agent on your behalf
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>GitHub Username</Label>
                <Input value={githubUsername} onChange={setGithubUsername} placeholder="your-github-username" />
              </div>
              <div>
                <Label>GitHub Email</Label>
                <Input value={githubEmail} onChange={setGithubEmail} placeholder="you@example.com" type="email" />
              </div>
            </div>
          </div>

          {message && (
            <div className={`flex items-center gap-2 text-sm ${message.type === 'success' ? 'text-emerald-500' : 'text-red-500'}`}>
              {message.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
              {message.text}
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={handleSaveProfile} disabled={saving}>
              {saving ? <><RefreshCw size={13} className="animate-spin" /> Saving...</> : <><Save size={14} /> Save Profile</>}
            </Button>
          </div>
        </div>
      </Card>

      {/* Password Change */}
      <Card>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <KeyRound size={14} className="text-slate-400" />
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Change Password</p>
          </div>

          <div>
            <Label>Current Password</Label>
            <Input value={currentPassword} onChange={setCurrentPassword} type="password" placeholder="Enter current password" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>New Password</Label>
              <Input value={newPassword} onChange={setNewPassword} type="password" placeholder="Enter new password" />
            </div>
            <div>
              <Label>Confirm New Password</Label>
              <Input value={confirmPassword} onChange={setConfirmPassword} type="password" placeholder="Confirm new password" />
            </div>
          </div>

          {pwMessage && (
            <div className={`flex items-center gap-2 text-sm ${pwMessage.type === 'success' ? 'text-emerald-500' : 'text-red-500'}`}>
              {pwMessage.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
              {pwMessage.text}
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={handleChangePassword} disabled={pwSaving || !currentPassword || !newPassword}>
              {pwSaving ? <><RefreshCw size={13} className="animate-spin" /> Changing...</> : 'Change Password'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}


// ══════════════════════════════════════════════════════════════════════════════
// CONNECTIONS TAB (existing logic, extracted into a tab component)
// ══════════════════════════════════════════════════════════════════════════════

const CONNECTION_LABELS: Record<ConnectionType, { label: string; description: string }> = {
  claude_api: { label: 'Claude API', description: 'Anthropic API key for AI execution' },
  atlassian: { label: 'Jira (Atlassian)', description: 'Issue tracking — Jira Cloud' },
  azure_devops_boards: { label: 'Azure DevOps Boards', description: 'Issue tracking — Azure Boards' },
  azure_devops: { label: 'Azure DevOps Repos', description: 'Code repository — Azure Repos' },
  github: { label: 'GitHub', description: 'Authentication — works across all repos you have access to' },
}

const CONNECTION_ICONS: Record<ConnectionType, typeof Database> = {
  claude_api: Bot,
  atlassian: Database,
  azure_devops_boards: Database,
  azure_devops: GitBranch,
  github: GitBranch,
}

interface AddConnectionFormProps {
  projectId: string
  onClose: () => void
  onCreated: () => void
}

function AddConnectionForm({ projectId, onClose, onCreated }: AddConnectionFormProps) {
  const [type, setType] = useState<ConnectionType>('claude_api')
  const [authType, setAuthType] = useState<AuthType>('api_key')
  const [credentials, setCredentials] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [projectName, setProjectName] = useState('')
  const [label, setLabel] = useState('')
  const [model, setModel] = useState('claude-sonnet-4-6')
  const [email, setEmail] = useState('')
  const [repoName, setRepoName] = useState('')
  const [owner, setOwner] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showCreds, setShowCreds] = useState(false)

  useEffect(() => {
    if (type === 'claude_api') setAuthType('api_key')
    else if (type === 'github') setAuthType('pat')
    else setAuthType('pat')
  }, [type])

  async function handleSave() {
    if (!credentials.trim()) { setError('Credentials are required'); return }
    setSaving(true)
    setError('')

    const extra_config: Record<string, string> = {}
    if (type === 'claude_api' && model) extra_config.model = model
    if (type === 'atlassian' && email) extra_config.email = email
    if (type === 'azure_devops' && repoName) extra_config.repo_name = repoName
    if (type === 'github' && owner) extra_config.owner = owner

    const payload: CreateConnectionPayload = {
      type,
      auth_type: authType,
      credentials: credentials.trim(),
      base_url: baseUrl.trim(),
      project_name: projectName.trim(),
      extra_config,
      label: label.trim() || undefined,
    }

    try {
      await api.createConnection(projectId, payload)
      onCreated()
      onClose()
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Failed to create connection')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[var(--bg-card)] rounded-xl border border-slate-200 dark:border-slate-700/50 shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-700/40">
          <h3 className="text-[15px] font-bold text-slate-900 dark:text-slate-100">Add Connection</h3>
          <p className="text-xs text-slate-500 mt-0.5">Configure a new service connection</p>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div>
            <Label>Connection Type</Label>
            <select
              value={type}
              onChange={e => setType(e.target.value as ConnectionType)}
              className="w-full bg-[var(--bg-input)] border border-slate-300 dark:border-slate-600/60 rounded-lg px-3 py-2 text-[13px] text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#DA7756] focus:ring-1 focus:ring-[rgba(218,119,86,0.2)]"
            >
              {Object.entries(CONNECTION_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>

          <div>
            <Label>Label (optional)</Label>
            <Input value={label} onChange={setLabel} placeholder={CONNECTION_LABELS[type].label} />
          </div>

          <div>
            <Label>{type === 'claude_api' ? 'API Key' : 'PAT / Token'}</Label>
            <div className="relative">
              <Input
                value={credentials}
                onChange={setCredentials}
                type={showCreds ? 'text' : 'password'}
                placeholder={type === 'claude_api' ? 'sk-ant-...' : 'Personal Access Token'}
              />
              <button
                type="button"
                onClick={() => setShowCreds(!showCreds)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {showCreds ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {type !== 'claude_api' && (
            <div>
              <Label>Base URL</Label>
              <Input
                value={baseUrl}
                onChange={setBaseUrl}
                placeholder={
                  type === 'atlassian' ? 'https://yourorg.atlassian.net' :
                  type === 'github' ? 'https://api.github.com' :
                  'https://dev.azure.com/yourorg'
                }
              />
            </div>
          )}

          {(type === 'azure_devops' || type === 'azure_devops_boards') && (
            <div>
              <Label>Project Name</Label>
              <Input value={projectName} onChange={setProjectName} placeholder="MyProject" />
            </div>
          )}

          {type === 'atlassian' && (
            <div>
              <Label>Email</Label>
              <Input value={email} onChange={setEmail} placeholder="you@company.com" />
            </div>
          )}

          {type === 'azure_devops' && (
            <div>
              <Label>Repository Name</Label>
              <Input value={repoName} onChange={setRepoName} placeholder="my-repo" />
            </div>
          )}

          {type === 'github' && (
            <div>
              <Label>Owner / Organization</Label>
              <Input value={owner} onChange={setOwner} placeholder="my-org or my-username" />
              <p className="text-xs text-slate-400 mt-1">Your GitHub username or organization. Repo is selected per task.</p>
            </div>
          )}

          {type === 'claude_api' && (
            <div>
              <Label>Default Model</Label>
              <select
                value={model}
                onChange={e => setModel(e.target.value)}
                className="w-full bg-[var(--bg-input)] border border-slate-300 dark:border-slate-600/60 rounded-xl px-4 py-3 text-[15px] text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#DA7756] focus:ring-2 focus:ring-[rgba(218,119,86,0.2)]"
              >
                <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
                <option value="claude-opus-4-7">Claude Opus 4.7</option>
                <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5</option>
              </select>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-500">
              <AlertCircle size={14} /> {error}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-700/40 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <><RefreshCw size={12} className="animate-spin" /> Saving...</> : 'Save Connection'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function ConnectionRow({ conn, projectId, onDeleted }: { conn: ConnectionInfo; projectId: string; onDeleted: () => void }) {
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'connected' | 'error' | null>(null)
  const [deleting, setDeleting] = useState(false)
  const Icon = CONNECTION_ICONS[conn.type] || Database

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      const result = await api.testConnection(projectId, conn.id)
      setTestResult(result.status as 'connected' | 'error')
    } catch {
      setTestResult('error')
    } finally {
      setTesting(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete connection "${conn.label}"?`)) return
    setDeleting(true)
    try {
      await api.deleteConnection(projectId, conn.id)
      onDeleted()
    } catch {
      setDeleting(false)
    }
  }

  return (
    <div className="flex items-center gap-4 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700/40 bg-[var(--bg-surface)]">
      <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/40 flex items-center justify-center shrink-0">
        <Icon size={16} className="text-slate-500 dark:text-slate-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-medium text-slate-800 dark:text-slate-100 truncate">{conn.label}</p>
        <p className="text-[12px] text-slate-400 truncate">
          {CONNECTION_LABELS[conn.type]?.description ?? conn.type}
          {conn.base_url && ` — ${conn.base_url}`}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {(testResult || conn.status) && (
          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
            (testResult ?? conn.status) === 'connected'
              ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/25'
              : 'text-red-500 bg-red-500/10 border border-red-500/25'
          }`}>
            {(testResult ?? conn.status) === 'connected'
              ? <><CheckCircle size={10} /> OK</>
              : <><AlertCircle size={10} /> Error</>}
          </span>
        )}
        <button onClick={handleTest} disabled={testing}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-40"
          title="Test connection">
          {testing ? <RefreshCw size={14} className="animate-spin" /> : <TestTube size={14} />}
        </button>
        <button onClick={handleDelete} disabled={deleting}
          className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-40"
          title="Delete">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

function ConnectionsTab() {
  const { user } = useAuth()
  const projectId = user?.project_id ?? ''
  const [connections, setConnections] = useState<ConnectionInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddConn, setShowAddConn] = useState(false)

  async function loadData(pid: string) {
    if (!pid) { setLoading(false); return }
    setLoading(true)
    try {
      const conns = await api.listConnections(pid)
      setConnections(conns)
    } catch {
      setConnections([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData(projectId) }, [projectId])

  return (
    <div className="space-y-6">
      {projectId && !loading && (
        <>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Connections</p>
              <button onClick={() => setShowAddConn(true)}
                className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#DA7756] hover:text-[#E0836A] transition-colors">
                <Plus size={13} /> Add
              </button>
            </div>

            {connections.length === 0 ? (
              <Card className="text-center py-8">
                <p className="text-sm text-slate-400">No connections configured yet</p>
                <p className="text-xs text-slate-400 mt-1">Add Claude API and GitHub connections to start workflows</p>
              </Card>
            ) : (
              <div className="space-y-2">
                {connections.map(c => (
                  <ConnectionRow key={c.id} conn={c} projectId={projectId} onDeleted={() => loadData(projectId)} />
                ))}
              </div>
            )}

            {connections.length > 0 && connections.length < 2 && (
              <p className="text-xs text-amber-500 flex items-center gap-1">
                <AlertCircle size={12} />
                Workflows require at minimum: Claude API + GitHub connection
              </p>
            )}
          </div>
        </>
      )}

      {loading && projectId && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw size={20} className="animate-spin text-slate-400" />
        </div>
      )}

      {showAddConn && (
        <AddConnectionForm projectId={projectId} onClose={() => setShowAddConn(false)} onCreated={() => loadData(projectId)} />
      )}
    </div>
  )
}


// ══════════════════════════════════════════════════════════════════════════════
// SKILLS TAB
// ══════════════════════════════════════════════════════════════════════════════

const SKILL_TYPE_META: Record<SkillType, { label: string; description: string; icon: typeof FileCode }> = {
  develop: {
    label: 'Develop Skill',
    description: 'Coding conventions, architecture rules, and patterns the agent follows when writing code',
    icon: FileCode,
  },
  review: {
    label: 'Review Skill',
    description: 'Review checklists, quality standards, and common violations the agent checks during PR review',
    icon: FileCode,
  },
  plan: {
    label: 'Plan Skill',
    description: 'Planning templates and task decomposition guidelines the agent uses to break down work',
    icon: FileCode,
  },
}

function SkillEditor({ skill, projectId, skillType, onSaved, onClose }: {
  skill: SkillContent | null
  projectId: string
  skillType: SkillType
  onSaved: () => void
  onClose: () => void
}) {
  const [name, setName] = useState(skill?.name ?? `${skillType.charAt(0).toUpperCase() + skillType.slice(1)} Skill`)
  const [description, setDescription] = useState(skill?.description ?? '')
  const [content, setContent] = useState(skill?.content ?? '')
  const [repository, setRepository] = useState(skill?.repository ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (!content.trim()) { setError('Skill content is required'); return }
    setSaving(true)
    setError('')
    try {
      if (skill) {
        await api.updateSkillContent(projectId, skill.id, {
          name, description, content,
          repository: repository.trim() || null,
        })
      } else {
        await api.createSkillContent(projectId, {
          name, skill_type: skillType, content, description,
          repository: repository.trim() || null,
        })
      }
      onSaved()
      onClose()
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Failed to save skill')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[var(--bg-card)] rounded-xl border border-slate-200 dark:border-slate-700/50 shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-700/40">
          <h3 className="text-[15px] font-bold text-slate-900 dark:text-slate-100">
            {skill ? 'Edit' : 'Add'} {SKILL_TYPE_META[skillType].label}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">{SKILL_TYPE_META[skillType].description}</p>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={setName} placeholder="Skill name" />
            </div>
            <div>
              <Label>Repository (optional)</Label>
              <Input value={repository} onChange={setRepository} placeholder="Leave empty for default" />
              <p className="text-[11px] text-slate-400 mt-0.5">
                {repository.trim() ? `Applies only to "${repository.trim()}"` : 'Applies to all repos without a specific skill'}
              </p>
            </div>
          </div>

          <div>
            <Label>Description (optional)</Label>
            <Input value={description} onChange={setDescription} placeholder="Brief description" />
          </div>

          <div>
            <Label>Content (.md)</Label>
            <Textarea
              value={content}
              onChange={setContent}
              placeholder="Paste your SKILL.md content here..."
              rows={12}
              className="font-mono text-[12px]"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-[12px] text-red-500">
              <AlertCircle size={12} /> {error}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-700/40 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <><RefreshCw size={12} className="animate-spin" /> Saving...</> : <><Save size={12} /> Save Skill</>}
          </Button>
        </div>
      </div>
    </div>
  )
}

function SkillsTab() {
  const { user } = useAuth()
  const projectId = user?.project_id ?? ''
  const [skills, setSkills] = useState<SkillContent[]>([])
  const [loading, setLoading] = useState(true)
  const [editingSkill, setEditingSkill] = useState<{ type: SkillType; skill: SkillContent | null } | null>(null)

  async function loadSkills() {
    if (!projectId) { setLoading(false); return }
    setLoading(true)
    try {
      const result = await api.listSkillContent(projectId)
      setSkills(result)
    } catch {
      setSkills([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadSkills() }, [projectId])

  function getSkillsForType(type: SkillType): SkillContent[] {
    return skills.filter(s => s.skill_type === type && s.is_active)
  }

  async function handleDelete(skillId: string) {
    if (!confirm('Delete this skill?')) return
    try {
      await api.deleteSkillContent(projectId, skillId)
      await loadSkills()
    } catch { /* ignore */ }
  }

  if (!projectId) {
    return (
      <Card className="text-center py-8">
        <p className="text-sm text-slate-400">No project found. Please log out and register again.</p>
      </Card>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw size={20} className="animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Agent Skills</p>
        <p className="text-sm text-slate-500">
          Paste your .md skill files here. Add repo-specific skills to override the default for a particular repository.
        </p>
      </div>

      {(Object.keys(SKILL_TYPE_META) as SkillType[]).map(type => {
        const meta = SKILL_TYPE_META[type]
        const typeSkills = getSkillsForType(type)
        const Icon = meta.icon

        return (
          <Card key={type}>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#DA7756]/10 border border-[#DA7756]/20 flex items-center justify-center shrink-0">
                    <Icon size={16} className="text-[#DA7756]" />
                  </div>
                  <div>
                    <p className="text-[15px] font-semibold text-slate-800 dark:text-slate-100">{meta.label}</p>
                    <p className="text-xs text-slate-400">{meta.description}</p>
                  </div>
                </div>
                <button
                  onClick={() => setEditingSkill({ type, skill: null })}
                  className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#DA7756] hover:text-[#E0836A] transition-colors"
                >
                  <Plus size={13} /> Add
                </button>
              </div>

              {typeSkills.length === 0 ? (
                <p className="text-xs text-slate-400 italic pl-12">No {type} skill configured — click Add to paste your .md content</p>
              ) : (
                <div className="space-y-2 pl-12">
                  {typeSkills.map(skill => (
                    <div key={skill.id} className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700/40">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-medium text-slate-600 dark:text-slate-300">{skill.name}</p>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                            skill.repository
                              ? 'text-blue-600 dark:text-blue-400 bg-blue-500/10 border border-blue-500/25'
                              : 'text-slate-500 bg-slate-500/10 border border-slate-400/25'
                          }`}>
                            {skill.repository ?? 'default'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setEditingSkill({ type, skill })}
                            className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            title="Edit">
                            <FileCode size={13} />
                          </button>
                          <button
                            onClick={() => handleDelete(skill.id)}
                            className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                            title="Delete">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                      <pre className="text-xs text-slate-400 whitespace-pre-wrap line-clamp-3 font-mono">{skill.content}</pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        )
      })}

      {editingSkill && (
        <SkillEditor
          skill={editingSkill.skill}
          projectId={projectId}
          skillType={editingSkill.type}
          onSaved={loadSkills}
          onClose={() => setEditingSkill(null)}
        />
      )}
    </div>
  )
}


// ══════════════════════════════════════════════════════════════════════════════
// MAIN SETTINGS PAGE
// ══════════════════════════════════════════════════════════════════════════════

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('profile')

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#DA7756]/15 border border-[#DA7756]/25 flex items-center justify-center">
          <Settings size={17} className="text-[#DA7756]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-tight">Settings</h1>
          <p className="text-sm text-slate-500">Profile, connections, and skill configuration</p>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex border-b border-slate-200 dark:border-slate-700/50">
        {TABS.map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative
                ${isActive
                  ? 'text-[#DA7756]'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
            >
              <Icon size={15} />
              {tab.label}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#DA7756] rounded-full" />
              )}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'profile' && <ProfileTab />}
      {activeTab === 'connections' && <ConnectionsTab />}
      {activeTab === 'skills' && <SkillsTab />}
    </div>
  )
}
