import { useState } from 'react'
import { Zap, ArrowRight, CheckCircle, Users, AlertCircle, Sparkles, ArrowLeft } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { api } from '../api/client'
import { Button, Input, Label } from '../components/ui'

// ── Onboarding (Register + Create Org → auto-creates default project) ────────

type OnboardStep = 'register' | 'create_org' | 'done'

function OnboardingPanel({ onBack }: { onBack: () => void }) {
  const { register } = useAuth()
  const [step, setStep] = useState<OnboardStep>('register')

  const [regName, setRegName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regError, setRegError] = useState('')
  const [registering, setRegistering] = useState(false)

  const [orgName, setOrgName] = useState('')
  const [orgSlug, setOrgSlug] = useState('')
  const [orgError, setOrgError] = useState('')
  const [creatingOrg, setCreatingOrg] = useState(false)

  function handleOrgNameChange(name: string) {
    setOrgName(name)
    setOrgSlug(name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
  }

  async function handleRegister() {
    if (!regName.trim() || !regEmail.trim() || !regPassword.trim()) {
      setRegError('All fields are required'); return
    }
    setRegistering(true); setRegError('')
    try {
      await register(regEmail.trim(), regPassword, regName.trim())
      setStep('create_org')
    } catch (e: any) {
      setRegError(e.response?.data?.detail || 'Registration failed')
    } finally { setRegistering(false) }
  }

  async function handleCreateOrg() {
    if (!orgName.trim()) { setOrgError('Organization name is required'); return }
    setCreatingOrg(true); setOrgError('')
    try {
      const org = await api.createOrg(orgName.trim(), orgSlug.trim())
      // Store org + default project
      localStorage.setItem('cc_org_id', org.id)
      if (org.default_project_id) {
        localStorage.setItem('cc_project_id', org.default_project_id)
      }
      setStep('done')
    } catch (e: any) {
      setOrgError(e.response?.data?.detail || 'Failed to create organization')
    } finally { setCreatingOrg(false) }
  }

  return (
    <div className="flex flex-col justify-center h-full px-10 max-w-md mx-auto w-full">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 mb-6 transition-colors"
      >
        <ArrowLeft size={14} /> Back to Sign In
      </button>

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-[#DA7756]/15 border border-[#DA7756]/30 flex items-center justify-center">
          <Sparkles size={20} className="text-[#DA7756]" />
        </div>
        <div>
          <p className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-tight">Get Started</p>
          <p className="text-xs text-slate-400">Create your workspace</p>
        </div>
      </div>

      {/* Step indicator */}
      {step !== 'done' && (
        <div className="flex items-center gap-3 mb-6">
          <StepDot active={step === 'register'} done={step === 'create_org'} label="1. Account" />
          <div className={`flex-1 h-px ${step === 'create_org' ? 'bg-emerald-400' : 'bg-slate-200 dark:bg-slate-700'}`} />
          <StepDot active={step === 'create_org'} done={false} label="2. Organization" />
        </div>
      )}

      {/* Register */}
      {step === 'register' && (
        <div className="space-y-4">
          <div><Label>Full Name</Label><Input value={regName} onChange={setRegName} placeholder="Jane Smith" /></div>
          <div><Label>Email</Label><Input value={regEmail} onChange={setRegEmail} placeholder="jane@company.com" onKeyDown={e => e.key === 'Enter' && handleRegister()} /></div>
          <div><Label>Password</Label><Input value={regPassword} onChange={setRegPassword} placeholder="Min 6 characters" onKeyDown={e => e.key === 'Enter' && handleRegister()} /></div>
          {regError && <ErrorMsg msg={regError} />}
          <Button onClick={handleRegister} disabled={registering} className="w-full justify-center">
            {registering ? 'Creating...' : <>Create Account <ArrowRight size={14} /></>}
          </Button>
        </div>
      )}

      {/* Create Org */}
      {step === 'create_org' && (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Create your organization. A default project will be set up automatically.
          </p>
          <div><Label>Organization Name</Label><Input value={orgName} onChange={handleOrgNameChange} placeholder="Acme Corp" onKeyDown={e => e.key === 'Enter' && handleCreateOrg()} /></div>
          <div>
            <Label>Slug</Label>
            <Input value={orgSlug} onChange={setOrgSlug} placeholder="acme-corp" />
            <p className="text-xs text-slate-400 mt-1">URL-friendly identifier (auto-generated)</p>
          </div>
          {orgError && <ErrorMsg msg={orgError} />}
          <Button onClick={handleCreateOrg} disabled={creatingOrg} className="w-full justify-center">
            {creatingOrg ? 'Creating...' : <>Create & Continue <ArrowRight size={14} /></>}
          </Button>
        </div>
      )}

      {/* Done */}
      {step === 'done' && (
        <div className="text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center mx-auto">
            <CheckCircle size={32} className="text-emerald-500" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">You're all set!</h3>
            <p className="text-sm text-slate-500 mt-2 max-w-xs mx-auto">
              Your organization and default project are ready. Next, go to <strong>Settings</strong> to add connections and team members.
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
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    if (!email.trim() || !password) { setError('Email and password required'); return }
    setLoading(true); setError('')
    try { await login(email.trim(), password) }
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
          <p className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-tight">CC Automation</p>
          <p className="text-xs text-slate-400">Agentic AI Development Platform</p>
        </div>
      </div>

      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">Welcome back</h1>
      <p className="text-sm text-slate-500 mb-8">Sign in to your account</p>

      <div className="space-y-4">
        <div><Label>Email</Label><Input value={email} onChange={setEmail} placeholder="you@company.com" onKeyDown={e => e.key === 'Enter' && handleLogin()} /></div>
        <div><Label>Password</Label><Input value={password} onChange={setPassword} placeholder="Your password" onKeyDown={e => e.key === 'Enter' && handleLogin()} /></div>
        {error && <ErrorMsg msg={error} />}
        <Button onClick={handleLogin} disabled={loading} className="w-full justify-center">
          {loading ? 'Signing in...' : 'Sign In'}
        </Button>
      </div>

      {/* Onboard link */}
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

function StepDot({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <span className={`text-[12px] font-semibold px-2.5 py-1 rounded-full transition-all ${
      done
        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25'
        : active
        ? 'bg-[#DA7756]/10 text-[#DA7756] border border-[#DA7756]/25'
        : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700'
    }`}>
      {done ? <><CheckCircle size={10} className="inline mr-1" />{label}</> : label}
    </span>
  )
}

function ErrorMsg({ msg }: { msg: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-red-500">
      <AlertCircle size={14} /> {msg}
    </div>
  )
}

// ── Right Panel Info (shown when login is active) ────────────────────────────

function InfoPanel() {
  return (
    <div className="flex flex-col justify-center items-center h-full px-12 text-center">
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#DA7756]/20 to-[#DA7756]/5 border border-[#DA7756]/15 flex items-center justify-center mb-8">
        <Zap size={36} className="text-[#DA7756]" />
      </div>
      <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">AI-Powered Development</h2>
      <p className="text-sm text-slate-500 max-w-xs leading-relaxed mb-8">
        Automate your development workflow with AI agents. From planning to code review — orchestrated by Claude.
      </p>
      <div className="space-y-3 text-left max-w-xs w-full">
        <FeatureItem text="Multi-step workflow engine (plan, dev, review, test)" />
        <FeatureItem text="Custom skills mapped to each workflow step" />
        <FeatureItem text="Integrated with Jira, Azure DevOps, GitHub" />
        <FeatureItem text="Human-in-the-loop gates for quality control" />
      </div>
    </div>
  )
}

function FeatureItem({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <CheckCircle size={14} className="text-emerald-500 mt-0.5 shrink-0" />
      <p className="text-[13px] text-slate-600 dark:text-slate-300">{text}</p>
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
