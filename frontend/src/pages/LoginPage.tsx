import { useState, useEffect } from 'react'
import { Zap, ArrowRight, CheckCircle, Users, AlertCircle, Sparkles, ArrowLeft, XCircle, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { api } from '../api/client'
import { Button, Input, Label } from '../components/ui'

// ── Onboarding (Register + Create Org in one step) ─────────────────────────

function OnboardingPanel({ onBack }: { onBack: () => void }) {
  const { register } = useAuth()

  const [regName, setRegName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [orgName, setOrgName] = useState('')
  const [regError, setRegError] = useState('')
  const [registering, setRegistering] = useState(false)
  const [done, setDone] = useState(false)

  async function handleRegister() {
    if (!regName.trim() || !regEmail.trim() || !regPassword.trim() || !orgName.trim()) {
      setRegError('All fields are required'); return
    }
    if (regPassword.length < 6) { setRegError('Password must be at least 6 characters'); return }
    setRegistering(true); setRegError('')
    try {
      await register(regEmail.trim(), regPassword, regName.trim(), orgName.trim())
      setDone(true)
    } catch (e: any) {
      setRegError(e.response?.data?.detail || 'Registration failed')
    } finally { setRegistering(false) }
  }

  return (
    <div className="flex flex-col justify-center h-full px-10 max-w-md mx-auto w-full">
      <button onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 mb-6 transition-colors">
        <ArrowLeft size={14} /> Back to Sign In
      </button>

      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-[#DA7756]/15 border border-[#DA7756]/30 flex items-center justify-center">
          <Sparkles size={20} className="text-[#DA7756]" />
        </div>
        <div>
          <p className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-tight">Get Started</p>
          <p className="text-xs text-slate-400">Create your organization and admin account</p>
        </div>
      </div>

      {!done ? (
        <div className="space-y-4">
          <div><Label>Organization Name</Label><Input value={orgName} onChange={setOrgName} placeholder="Acme Corp" /></div>
          <div><Label>Your Name</Label><Input value={regName} onChange={setRegName} placeholder="Jitesh Sonkusare" /></div>
          <div><Label>Email</Label><Input value={regEmail} onChange={setRegEmail} placeholder="jitesh@company.com" type="email" /></div>
          <div><Label>Password</Label><Input value={regPassword} onChange={setRegPassword} type="password" placeholder="Min 6 characters" onKeyDown={e => e.key === 'Enter' && handleRegister()} /></div>
          {regError && <ErrorMsg msg={regError} />}
          <Button onClick={handleRegister} disabled={registering} className="w-full justify-center">
            {registering ? 'Creating...' : <>Create Organization <ArrowRight size={14} /></>}
          </Button>
        </div>
      ) : (
        <div className="text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center mx-auto">
            <CheckCircle size={32} className="text-emerald-500" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">You're all set!</h3>
            <p className="text-sm text-slate-500 mt-2 max-w-xs mx-auto">
              Your organization <strong>{orgName}</strong> is ready. Go to <strong>Settings</strong> to add GitHub and Claude connections.
            </p>
          </div>
          <Button onClick={() => window.location.reload()} className="w-full justify-center">
            Go to Dashboard <ArrowRight size={14} />
          </Button>
        </div>
      )}
    </div>
  )
}

// ── Login Panel ──────────────────────────────────────────────────────────────

function LoginPanel({ onOnboard }: { onOnboard: () => void }) {
  const { login } = useAuth()
  const [orgName, setOrgName] = useState('')
  const [orgValid, setOrgValid] = useState<boolean | null>(null)
  const [orgChecking, setOrgChecking] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)

  // Debounced org validation
  useEffect(() => {
    if (!orgName.trim()) { setOrgValid(null); return }
    setOrgChecking(true)
    const timer = setTimeout(async () => {
      try {
        const result = await api.validateOrg(orgName.trim())
        setOrgValid(result.exists)
      } catch { setOrgValid(null) }
      finally { setOrgChecking(false) }
    }, 500)
    return () => { clearTimeout(timer); setOrgChecking(false) }
  }, [orgName])

  async function handleLogin() {
    if (!orgName.trim() || !email.trim() || !password) { setError('All fields are required'); return }
    setLoading(true); setError('')
    try { await login(email.trim(), password, orgName.trim()) }
    catch (e: any) { setError(e.response?.data?.detail || 'Invalid credentials') }
    finally { setLoading(false) }
  }

  return (
    <div className="flex flex-col justify-center h-full px-10 max-w-sm mx-auto w-full">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-10">
        <div className="w-10 h-10 rounded-xl bg-[#DA7756]/15 border border-[#DA7756]/30 flex items-center justify-center">
          <Zap size={20} className="text-[#DA7756]" />
        </div>
        <div>
          <p className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-tight">AI DevAgent</p>
          <p className="text-xs text-slate-400">Agentic AI Development Platform</p>
        </div>
      </div>

      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">Welcome back</h1>
      <p className="text-sm text-slate-500 mb-8">Sign in to your account</p>

      <div className="space-y-4">
        <div>
          <Label>Organization</Label>
          <div className="relative">
            <Input value={orgName} onChange={setOrgName} placeholder="Your organization name" />
            {orgName.trim() && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                {orgChecking ? (
                  <span className="w-4 h-4 border-2 border-slate-300 border-t-[#DA7756] rounded-full animate-spin inline-block" />
                ) : orgValid === true ? (
                  <CheckCircle size={16} className="text-emerald-500" />
                ) : orgValid === false ? (
                  <XCircle size={16} className="text-red-400" />
                ) : null}
              </span>
            )}
          </div>
          {orgValid === false && orgName.trim() && (
            <p className="text-[10px] text-red-400 mt-0.5">Organization not found</p>
          )}
        </div>
        <div><Label>Email</Label><Input value={email} onChange={setEmail} placeholder="you@company.com" /></div>
        <div>
          <Label>Password</Label>
          <div className="relative">
            <Input value={password} onChange={setPassword} type={showPw ? 'text' : 'password'} placeholder="Your password" onKeyDown={e => e.key === 'Enter' && handleLogin()} />
            <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
              {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>
        {error && <ErrorMsg msg={error} />}
        <Button onClick={handleLogin} disabled={loading} className="w-full justify-center">
          {loading ? 'Signing in...' : 'Sign In'}
        </Button>
      </div>

      {/* Create Organization */}
      <div className="mt-10 pt-6 border-t border-slate-200 dark:border-slate-700/40 text-center">
        <p className="text-sm text-slate-500 mb-3">New to the platform?</p>
        <button
          onClick={onOnboard}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-[#DA7756] bg-[#DA7756]/8 hover:bg-[#DA7756]/15 border border-[#DA7756]/20 transition-all"
        >
          <Users size={15} /> Create Organization <ArrowRight size={14} />
        </button>
      </div>
    </div>
  )
}

// ── Shared components ────────────────────────────────────────────────────────

function ErrorMsg({ msg }: { msg: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-red-500">
      <AlertCircle size={14} /> {msg}
    </div>
  )
}

// ── Right Panel Info (shown when login is active) ────────────────────────────

const WORKFLOW_STEPS = [
  { icon: '📋', label: 'Fetch Task', desc: 'Pull assigned issues from GitHub' },
  { icon: '🧠', label: 'Plan', desc: 'AI analyzes codebase & creates implementation plan' },
  { icon: '⚡', label: 'Develop', desc: 'AI writes code following skill instructions' },
  { icon: '🔍', label: 'Review', desc: 'AI self-reviews against coding standards' },
  { icon: '🚀', label: 'Commit & PR', desc: 'Push changes and create pull request' },
  { icon: '✅', label: 'Pipeline', desc: 'Monitor CI/CD and close issue' },
]

function InfoPanel() {
  return (
    <div className="flex flex-col justify-center h-full px-12">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#DA7756] to-[#C86A48] flex items-center justify-center">
          <Zap size={20} className="text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">AI DevAgent</h2>
          <p className="text-[11px] text-slate-400">Agentic AI Development Platform</p>
        </div>
      </div>

      <p className="text-[13px] text-slate-500 leading-relaxed mb-8 max-w-sm">
        An autonomous AI agent that executes the full software development lifecycle — from GitHub issue to deployed code — with human oversight at critical gates.
      </p>

      {/* Workflow Flow */}
      <div className="space-y-0 max-w-sm">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-4">Agent Workflow</p>
        {WORKFLOW_STEPS.map((step, i) => (
          <div key={step.label} className="flex gap-3">
            {/* Rail */}
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-lg bg-[#DA7756]/10 border border-[#DA7756]/20 flex items-center justify-center shrink-0">
                <span className="text-[14px]">{step.icon}</span>
              </div>
              {i < WORKFLOW_STEPS.length - 1 && (
                <div className="w-0.5 flex-1 min-h-[12px] bg-[#DA7756]/20" />
              )}
            </div>
            {/* Content */}
            <div className="pb-4">
              <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100 leading-snug">{step.label}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{step.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Gates callout */}
      <div className="mt-4 p-3 rounded-lg bg-amber-500/5 border border-amber-500/15 max-w-sm">
        <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">🛡️ Human-in-the-loop gates</p>
        <p className="text-[10px] text-slate-400 mt-0.5">Developer approves the plan before coding starts, and reviews the PR before merging.</p>
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'onboard'>('login')

  return (
    <div className="h-screen w-screen overflow-hidden relative bg-[var(--bg-base)]">
      {/* Left panel */}
      <div className="absolute inset-y-0 left-0 w-1/2 overflow-hidden">
        <div
          className="absolute inset-0 bg-[var(--bg-surface)] transition-all duration-600 ease-[cubic-bezier(0.4,0,0.2,1)]"
          style={{
            transform: mode === 'login' ? 'translateX(0%)' : 'translateX(-100%)',
            opacity: mode === 'login' ? 1 : 0,
          }}
        >
          <LoginPanel onOnboard={() => setMode('onboard')} />
        </div>

        <div
          className="absolute inset-0 bg-[var(--bg-surface)] transition-all duration-600 ease-[cubic-bezier(0.4,0,0.2,1)]"
          style={{
            transform: mode === 'onboard' ? 'translateX(0%)' : 'translateX(100%)',
            opacity: mode === 'onboard' ? 1 : 0,
          }}
        >
          <OnboardingPanel onBack={() => setMode('login')} />
        </div>
      </div>

      {/* Right panel — info/branding */}
      <div className="absolute inset-y-0 right-0 w-1/2 bg-[var(--bg-base)]">
        <InfoPanel />
      </div>

      {/* Center divider */}
      <div className="absolute inset-y-0 left-1/2 w-px bg-slate-200 dark:bg-stone-700/50 z-10" />
    </div>
  )
}
