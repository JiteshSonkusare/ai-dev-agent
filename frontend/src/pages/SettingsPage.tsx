import { useEffect, useState } from 'react'
import {
  Settings, Plus, Trash2, CheckCircle, AlertCircle, RefreshCw,
  Database, Bot, GitBranch, TestTube, Eye, EyeOff,
  User as UserIcon, KeyRound, FileCode, Save, Users,
} from 'lucide-react'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import type {
  ConnectionInfo, CreateConnectionPayload, ConnectionType, AuthType,
  UserProfile, SkillContent, SkillType, UserListItem, CreateUserPayload,
} from '../api/client'
import { Card, Label, Input, Button, Textarea } from '../components/ui'

type TabKey = 'profile' | 'connections' | 'skills' | 'users'

const TABS: { key: TabKey; label: string; icon: typeof UserIcon; adminOnly?: boolean }[] = [
  { key: 'profile', label: 'Profile', icon: UserIcon },
  { key: 'connections', label: 'Connections', icon: Database },
  { key: 'skills', label: 'Skills', icon: FileCode },
  { key: 'users', label: 'Manage Users', icon: Users, adminOnly: true },
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
  const [name, setName] = useState('')
  const [githubUsername, setGithubUsername] = useState('')
  const [githubEmail, setGithubEmail] = useState('')
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
      } finally { setLoading(false) }
    }
    load()
  }, [])

  async function handleSaveProfile() {
    setSaving(true); setMessage(null)
    try {
      const updated = await api.updateProfile({ name: name.trim(), github_username: githubUsername.trim() || undefined, github_email: githubEmail.trim() || undefined })
      setProfile(updated); await refreshUser()
      setMessage({ type: 'success', text: 'Profile updated' })
    } catch (e: any) { setMessage({ type: 'error', text: e.response?.data?.detail || 'Failed' }) }
    finally { setSaving(false) }
  }

  async function handleChangePassword() {
    setPwMessage(null)
    if (newPassword !== confirmPassword) { setPwMessage({ type: 'error', text: 'Passwords do not match' }); return }
    if (newPassword.length < 6) { setPwMessage({ type: 'error', text: 'Min 6 characters' }); return }
    setPwSaving(true)
    try {
      await api.changePassword({ current_password: currentPassword, new_password: newPassword })
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
      setPwMessage({ type: 'success', text: 'Password changed' })
    } catch (e: any) { setPwMessage({ type: 'error', text: e.response?.data?.detail || 'Failed' }) }
    finally { setPwSaving(false) }
  }

  if (loading) return <div className="flex justify-center py-12"><RefreshCw size={20} className="animate-spin text-slate-400" /></div>

  return (
    <div className="space-y-4">
      <Card>
        <div className="space-y-3">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Account</p>
          <div>
            <Label>Email</Label>
            <Input value={profile?.email ?? ''} onChange={() => {}} disabled />
          </div>
          <div>
            <Label>Display Name</Label>
            <Input value={name} onChange={setName} placeholder="Your name" />
          </div>
          <div className="border-t border-slate-200 dark:border-slate-700/40 pt-3 mt-3">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-3">GitHub Identity</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>GitHub Username</Label><Input value={githubUsername} onChange={setGithubUsername} placeholder="your-github-username" /></div>
              <div><Label>GitHub Email</Label><Input value={githubEmail} onChange={setGithubEmail} placeholder="you@example.com" type="email" /></div>
            </div>
          </div>
          {message && <div className={`flex items-center gap-2 text-[12px] ${message.type === 'success' ? 'text-emerald-500' : 'text-red-500'}`}>{message.type === 'success' ? <CheckCircle size={13} /> : <AlertCircle size={13} />}{message.text}</div>}
          <div className="flex justify-end"><Button onClick={handleSaveProfile} disabled={saving}>{saving ? <><RefreshCw size={12} className="animate-spin" /> Saving...</> : <><Save size={12} /> Save</>}</Button></div>
        </div>
      </Card>
      <Card>
        <div className="space-y-3">
          <div className="flex items-center gap-2"><KeyRound size={14} className="text-slate-400" /><p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Change Password</p></div>
          <div><Label>Current Password</Label><Input value={currentPassword} onChange={setCurrentPassword} type="password" placeholder="Current password" /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>New Password</Label><Input value={newPassword} onChange={setNewPassword} type="password" placeholder="New password" /></div>
            <div><Label>Confirm</Label><Input value={confirmPassword} onChange={setConfirmPassword} type="password" placeholder="Confirm" /></div>
          </div>
          {pwMessage && <div className={`flex items-center gap-2 text-[12px] ${pwMessage.type === 'success' ? 'text-emerald-500' : 'text-red-500'}`}>{pwMessage.type === 'success' ? <CheckCircle size={13} /> : <AlertCircle size={13} />}{pwMessage.text}</div>}
          <div className="flex justify-end"><Button onClick={handleChangePassword} disabled={pwSaving || !currentPassword || !newPassword}>{pwSaving ? 'Changing...' : 'Change Password'}</Button></div>
        </div>
      </Card>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// CONNECTIONS TAB — GitHub + Claude only
// ══════════════════════════════════════════════════════════════════════════════

function ConnectionCard({ type, title, icon: Icon, iconBg, connections, onSave, onDelete, onTest, children }: {
  type: string; title: string; icon: typeof Bot; iconBg: string
  connections: ConnectionInfo[]; onSave: () => void; onDelete: (id: string) => void; onTest: (id: string) => Promise<string>
  children: (props: { saving: boolean; error: string; setError: (e: string) => void; setSaving: (s: boolean) => void }) => React.ReactNode
}) {
  const existing = connections.find(c => c.type === type)
  const [editing, setEditing] = useState(!existing)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)

  useEffect(() => { setEditing(!existing) }, [existing])

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center`}>
            <Icon size={18} className="text-white" />
          </div>
          <div>
            <p className="text-[14px] font-semibold text-slate-800 dark:text-slate-100">{title}</p>
            {existing && !editing && (
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${
                  (testResult ?? existing.status) === 'connected' ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' : 'text-amber-500 bg-amber-500/10 border-amber-500/20'
                }`}>{(testResult ?? existing.status) === 'connected' ? '● Connected' : '● Not tested'}</span>
              </div>
            )}
          </div>
        </div>
        {existing && !editing && (
          <div className="flex items-center gap-1">
            <button onClick={async () => { setTesting(true); try { const r = await onTest(existing.id); setTestResult(r) } catch { setTestResult('error') } finally { setTesting(false) }}}
              disabled={testing} className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              {testing ? <RefreshCw size={12} className="animate-spin" /> : 'Test'}
            </button>
            <button onClick={() => setEditing(true)}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-[#DA7756] hover:bg-[#DA7756]/10 transition-colors">Edit</button>
            <button onClick={() => { if (confirm('Delete this connection?')) onDelete(existing.id) }}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">Delete</button>
          </div>
        )}
      </div>

      {editing && (
        <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-700/40">
          {children({ saving, error, setError, setSaving })}
          {error && <div className="flex items-center gap-2 text-[12px] text-red-500"><AlertCircle size={12} />{error}</div>}
          <div className="flex justify-end gap-2">
            {existing && <Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>}
            <Button onClick={() => {}} disabled={saving}>{saving ? 'Saving...' : existing ? 'Update' : 'Save'}</Button>
          </div>
        </div>
      )}

      {!existing && !editing && (
        <p className="text-[12px] text-slate-400 italic">Not configured — click to set up</p>
      )}
    </Card>
  )
}

function ConnectionsTab() {
  const [connections, setConnections] = useState<ConnectionInfo[]>([])
  const [loading, setLoading] = useState(true)

  // GitHub form state
  const [ghToken, setGhToken] = useState('')
  const [ghUrl, setGhUrl] = useState('')
  const [ghShowToken, setGhShowToken] = useState(false)

  // Parse owner + base URL from GitHub URL
  function parseGitHubUrl(url: string): { owner: string; baseUrl: string } {
    const trimmed = url.trim().replace(/\/+$/, '')
    try {
      const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
      const owner = parsed.pathname.split('/').filter(Boolean)[0] || ''
      const isEnterprise = parsed.hostname !== 'github.com'
      const baseUrl = isEnterprise ? `${parsed.origin}/api/v3` : 'https://api.github.com'
      return { owner, baseUrl }
    } catch {
      return { owner: trimmed, baseUrl: 'https://api.github.com' }
    }
  }

  const ghParsed = parseGitHubUrl(ghUrl)

  // Claude form state
  const [claudeKey, setClaudeKey] = useState('')
  const [claudeModel, setClaudeModel] = useState('claude-sonnet-4-6')
  const [claudeShowKey, setClaudeShowKey] = useState(false)

  async function load() {
    setLoading(true)
    try { setConnections(await api.listConnections()) } catch { setConnections([]) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  async function handleTest(id: string): Promise<string> {
    const r = await api.testConnection(id)
    await load()
    return r.status
  }

  async function handleDelete(id: string) {
    await api.deleteConnection(id)
    await load()
  }

  async function saveGitHub(setSaving: (s: boolean) => void, setError: (e: string) => void) {
    if (!ghToken.trim()) { setError('GitHub PAT is required'); return }
    if (!ghParsed.owner) { setError('GitHub URL is required'); return }
    setSaving(true); setError('')
    try {
      const existing = connections.find(c => c.type === 'github')
      if (existing) await api.deleteConnection(existing.id)
      await api.createConnection({
        type: 'github', auth_type: 'pat', credentials: ghToken.trim(),
        base_url: ghParsed.baseUrl, extra_config: { owner: ghParsed.owner }, label: 'GitHub',
      })
      setGhToken(''); setGhUrl(''); await load()
    } catch (e: any) { setError(e.response?.data?.detail || 'Failed') }
    finally { setSaving(false) }
  }

  async function saveClaude(setSaving: (s: boolean) => void, setError: (e: string) => void) {
    if (!claudeKey.trim()) { setError('API key is required'); return }
    setSaving(true); setError('')
    try {
      const existing = connections.find(c => c.type === 'claude_api')
      if (existing) await api.deleteConnection(existing.id)
      await api.createConnection({
        type: 'claude_api', auth_type: 'api_key', credentials: claudeKey.trim(),
        extra_config: { model: claudeModel }, label: 'Claude API',
      })
      setClaudeKey(''); await load()
    } catch (e: any) { setError(e.response?.data?.detail || 'Failed') }
    finally { setSaving(false) }
  }

  if (loading) return <div className="flex justify-center py-8"><RefreshCw size={18} className="animate-spin text-slate-400" /></div>

  const ghConn = connections.find(c => c.type === 'github')
  const claudeConn = connections.find(c => c.type === 'claude_api')

  return (
    <div className="space-y-4">
      <p className="text-[12px] text-slate-500">Configure your GitHub and Claude API connections. Both are required to run the AI agent.</p>

      {/* GitHub */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-800 dark:bg-slate-700 flex items-center justify-center">
              <GitBranch size={18} className="text-white" />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-slate-800 dark:text-slate-100">GitHub</p>
              <p className="text-[11px] text-slate-400">Pull tasks, clone repos, create PRs, monitor pipelines</p>
            </div>
          </div>
          {ghConn && (
            <div className="flex items-center gap-1">
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${ghConn.status === 'connected' ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' : 'text-amber-500 bg-amber-500/10 border-amber-500/20'}`}>
                {ghConn.status === 'connected' ? '● Connected' : '● Pending'}
              </span>
              <button onClick={() => handleTest(ghConn.id)} className="px-2 py-1 rounded text-[11px] text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">Test</button>
              <button onClick={() => handleDelete(ghConn.id)} className="px-2 py-1 rounded text-[11px] text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10">Remove</button>
            </div>
          )}
        </div>
        {!ghConn && (
          <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-700/40">
            <div>
              <Label>Personal Access Token (PAT)</Label>
              <div className="relative">
                <Input value={ghToken} onChange={setGhToken} type={ghShowToken ? 'text' : 'password'} placeholder="ghp_xxxxxxxxxxxxxxxxxxxx" />
                <button type="button" onClick={() => setGhShowToken(!ghShowToken)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {ghShowToken ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Create at <a href="https://github.com/settings/tokens/new" target="_blank" className="text-[#DA7756] hover:underline">github.com/settings/tokens</a> → select <strong>repo</strong> + <strong>workflow</strong> scopes</p>
            </div>
            <div>
              <Label>GitHub URL</Label>
              <Input value={ghUrl} onChange={setGhUrl} placeholder="https://github.com/JiteshSonkusare" />
              {ghParsed.owner && (
                <p className="text-[10px] text-emerald-500 mt-1 flex items-center gap-1">
                  <CheckCircle size={10} /> Owner: <strong>{ghParsed.owner}</strong> · API: {ghParsed.baseUrl}
                </p>
              )}
              <p className="text-[10px] text-slate-400 mt-0.5">
                Public: <code className="text-[10px]">https://github.com/username</code> · Enterprise: <code className="text-[10px]">https://company.ghe.com/org</code>
              </p>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => saveGitHub(s => {}, e => {})} disabled={!ghToken.trim() || !ghParsed.owner}>Save GitHub Connection</Button>
            </div>
          </div>
        )}
      </Card>

      {/* Claude API */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#DA7756] flex items-center justify-center">
              <Bot size={18} className="text-white" />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-slate-800 dark:text-slate-100">Claude API</p>
              <p className="text-[11px] text-slate-400">Powers the AI agent for planning, coding, and reviewing</p>
            </div>
          </div>
          {claudeConn && (
            <div className="flex items-center gap-1">
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${claudeConn.status === 'connected' ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' : 'text-amber-500 bg-amber-500/10 border-amber-500/20'}`}>
                {claudeConn.status === 'connected' ? '● Connected' : '● Pending'}
              </span>
              <button onClick={() => handleTest(claudeConn.id)} className="px-2 py-1 rounded text-[11px] text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">Test</button>
              <button onClick={() => handleDelete(claudeConn.id)} className="px-2 py-1 rounded text-[11px] text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10">Remove</button>
            </div>
          )}
        </div>
        {!claudeConn && (
          <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-700/40">
            <div>
              <Label>Anthropic API Key</Label>
              <div className="relative">
                <Input value={claudeKey} onChange={setClaudeKey} type={claudeShowKey ? 'text' : 'password'} placeholder="sk-ant-api03-xxxxxxxxxxxx" />
                <button type="button" onClick={() => setClaudeShowKey(!claudeShowKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {claudeShowKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Get your key from <a href="https://console.anthropic.com/settings/keys" target="_blank" className="text-[#DA7756] hover:underline">console.anthropic.com</a></p>
            </div>
            <div>
              <Label>Default Model</Label>
              <select value={claudeModel} onChange={e => setClaudeModel(e.target.value)}
                className="w-full bg-[var(--bg-input)] border border-slate-300 dark:border-slate-600/60 rounded-lg px-3 py-2 text-[13px] text-slate-900 dark:text-slate-100">
                <option value="claude-sonnet-4-6">Claude Sonnet 4.6 (recommended)</option>
                <option value="claude-opus-4-7">Claude Opus 4.7 (most capable)</option>
                <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5 (fastest, cheapest)</option>
              </select>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => saveClaude(s => {}, e => {})} disabled={!claudeKey.trim()}>Save Claude Connection</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// SKILLS TAB
// ══════════════════════════════════════════════════════════════════════════════

const SKILL_META: Record<SkillType, { label: string; desc: string }> = {
  develop: { label: 'Develop Skill', desc: 'Coding conventions and patterns' },
  review: { label: 'Review Skill', desc: 'Review checklists and standards' },
  plan: { label: 'Plan Skill', desc: 'Planning and decomposition guidelines' },
}

function SkillEditor({ skill, skillType, onSaved, onClose }: {
  skill: SkillContent | null; skillType: SkillType; onSaved: () => void; onClose: () => void
}) {
  const [name, setName] = useState(skill?.name ?? `${skillType.charAt(0).toUpperCase() + skillType.slice(1)} Skill`)
  const [description, setDescription] = useState(skill?.description ?? '')
  const [content, setContent] = useState(skill?.content ?? '')
  const [repository, setRepository] = useState(skill?.repository ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (!content.trim()) { setError('Content required'); return }
    setSaving(true); setError('')
    try {
      if (skill) await api.updateSkillContent(skill.id, { name, description, content, repository: repository.trim() || null })
      else await api.createSkillContent({ name, skill_type: skillType, content, description, repository: repository.trim() || null })
      onSaved(); onClose()
    } catch (e: any) { setError(e.response?.data?.detail || 'Failed') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--bg-card)] rounded-xl border border-slate-200 dark:border-slate-700/50 shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-700/40">
          <h3 className="text-[15px] font-bold text-slate-900 dark:text-slate-100">{skill ? 'Edit' : 'Add'} {SKILL_META[skillType].label}</h3>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>Name</Label><Input value={name} onChange={setName} placeholder="Skill name" /></div>
            <div><Label>Repository (optional)</Label><Input value={repository} onChange={setRepository} placeholder="Leave empty for default" /><p className="text-[11px] text-slate-400 mt-0.5">{repository.trim() ? `For "${repository.trim()}" only` : 'All repos'}</p></div>
          </div>
          <div><Label>Description</Label><Input value={description} onChange={setDescription} placeholder="Brief description" /></div>
          <div><Label>Content (.md)</Label><Textarea value={content} onChange={setContent} placeholder="Paste SKILL.md..." rows={12} className="font-mono text-[12px]" /></div>
          {error && <div className="text-[12px] text-red-500 flex items-center gap-1"><AlertCircle size={12} />{error}</div>}
        </div>
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-700/40 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : <><Save size={12} /> Save</>}</Button>
        </div>
      </div>
    </div>
  )
}

function SkillsTab() {
  const [skills, setSkills] = useState<SkillContent[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<{ type: SkillType; skill: SkillContent | null } | null>(null)

  async function load() {
    setLoading(true)
    try { setSkills(await api.listSkillContent()) } catch { setSkills([]) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  function getSkills(type: SkillType) { return skills.filter(s => s.skill_type === type && s.is_active) }

  if (loading) return <div className="flex justify-center py-8"><RefreshCw size={18} className="animate-spin text-slate-400" /></div>

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-slate-500">Paste .md skill files. Repo-specific skills override the default.</p>
      {(Object.keys(SKILL_META) as SkillType[]).map(type => {
        const items = getSkills(type)
        return (
          <Card key={type}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FileCode size={14} className="text-[#DA7756]" />
                <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">{SKILL_META[type].label}</p>
              </div>
              <button onClick={() => setEditing({ type, skill: null })} className="text-[11px] font-semibold text-[#DA7756] flex items-center gap-1"><Plus size={12} /> Add</button>
            </div>
            {items.length === 0 ? <p className="text-[11px] text-slate-400 italic">No {type} skill — click Add</p>
             : <div className="space-y-1.5">{items.map(s => (
                <div key={s.id} className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700/40">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">{s.name}</span>
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${s.repository ? 'text-blue-500 bg-blue-500/10' : 'text-slate-500 bg-slate-400/10'}`}>{s.repository ?? 'default'}</span>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => setEditing({ type, skill: s })} className="p-1 rounded text-slate-400 hover:text-slate-600"><FileCode size={12} /></button>
                      <button onClick={async () => { if (confirm('Delete?')) { await api.deleteSkillContent(s.id); load() }}} className="p-1 rounded text-slate-400 hover:text-red-500"><Trash2 size={12} /></button>
                    </div>
                  </div>
                  <pre className="text-[10px] text-slate-400 whitespace-pre-wrap line-clamp-2 font-mono">{s.content}</pre>
                </div>
              ))}</div>}
          </Card>
        )
      })}
      {editing && <SkillEditor skill={editing.skill} skillType={editing.type} onSaved={load} onClose={() => setEditing(null)} />}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// USERS TAB (admin only)
// ══════════════════════════════════════════════════════════════════════════════

function UsersTab() {
  const [users, setUsers] = useState<UserListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('developer')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    try { setUsers(await api.listUsers()) } catch { setUsers([]) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  async function handleCreate() {
    if (!email.trim() || !name.trim() || !password) { setError('All fields required'); return }
    setSaving(true); setError('')
    try {
      await api.createUser({ email: email.trim(), name: name.trim(), password, role: role.trim() || 'developer' })
      setEmail(''); setName(''); setPassword(''); setRole('developer'); setShowAdd(false); load()
    } catch (e: any) { setError(e.response?.data?.detail || 'Failed') }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Organization Users</p>
        <button onClick={() => setShowAdd(!showAdd)} className="text-[12px] font-semibold text-[#DA7756] flex items-center gap-1"><Plus size={13} /> Add User</button>
      </div>

      {showAdd && (
        <Card>
          <div className="space-y-3">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Create User</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>Email</Label><Input value={email} onChange={setEmail} placeholder="user@company.com" type="email" /></div>
              <div><Label>Name</Label><Input value={name} onChange={setName} placeholder="Full name" /></div>
              <div><Label>Password</Label><Input value={password} onChange={setPassword} type="password" placeholder="Min 6 characters" /></div>
              <div><Label>Role</Label><Input value={role} onChange={setRole} placeholder="developer, architect, etc." /></div>
            </div>
            {error && <div className="text-[12px] text-red-500 flex items-center gap-1"><AlertCircle size={12} />{error}</div>}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={saving}>{saving ? 'Creating...' : 'Create User'}</Button>
            </div>
          </div>
        </Card>
      )}

      {loading ? <div className="flex justify-center py-8"><RefreshCw size={18} className="animate-spin text-slate-400" /></div>
       : users.length === 0 ? <Card className="text-center py-6"><p className="text-[12px] text-slate-400">No users</p></Card>
       : <div className="space-y-2">{users.map(u => (
          <div key={u.id} className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700/40 bg-[var(--bg-surface)]">
            <div className="w-8 h-8 rounded-full bg-[#DA7756]/10 flex items-center justify-center shrink-0">
              <span className="text-[12px] font-bold text-[#DA7756]">{u.name.charAt(0).toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-slate-800 dark:text-slate-100">{u.name}</p>
              <p className="text-[11px] text-slate-400">{u.email}</p>
            </div>
            <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">{u.role}</span>
            <button onClick={async () => { if (confirm(`Delete ${u.name}?`)) { try { await api.deleteUser(u.id); load() } catch {} }}} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 transition-colors" title="Delete"><Trash2 size={13} /></button>
          </div>
        ))}</div>}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════════

export default function SettingsPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [activeTab, setActiveTab] = useState<TabKey>('profile')

  const visibleTabs = TABS.filter(t => !t.adminOnly || isAdmin)

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#DA7756]/15 border border-[#DA7756]/25 flex items-center justify-center">
          <Settings size={17} className="text-[#DA7756]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-tight">Settings</h1>
          <p className="text-sm text-slate-500">Profile, connections, skills{isAdmin ? ', and user management' : ''}</p>
        </div>
      </div>

      <div className="flex border-b border-slate-200 dark:border-slate-700/50">
        {visibleTabs.map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative ${isActive ? 'text-[#DA7756]' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
              <Icon size={15} />{tab.label}
              {isActive && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#DA7756] rounded-full" />}
            </button>
          )
        })}
      </div>

      {activeTab === 'profile' && <ProfileTab />}
      {activeTab === 'connections' && <ConnectionsTab />}
      {activeTab === 'skills' && <SkillsTab />}
      {activeTab === 'users' && isAdmin && <UsersTab />}
    </div>
  )
}
