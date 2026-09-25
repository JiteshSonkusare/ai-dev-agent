import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { api, setSessionToken, type AuthResponse } from '../api/client'

interface AuthUser {
  id: string
  email: string
  name: string
  role: string
  org_name: string | null
  github_username: string | null
  github_email: string | null
}

interface AuthContextValue {
  user: AuthUser | null
  token: string
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string, orgName: string) => Promise<AuthResponse>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const TOKEN_KEY = 'cc_session_token'
const USER_KEY = 'cc_user'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const stored = localStorage.getItem(USER_KEY)
    return stored ? JSON.parse(stored) : null
  })
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) ?? '')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (token) setSessionToken(token)
  }, [token])

  useEffect(() => {
    async function validateSession() {
      const storedToken = localStorage.getItem(TOKEN_KEY)
      if (!storedToken) {
        setLoading(false)
        return
      }
      setSessionToken(storedToken)
      try {
        const profile = await api.getMe()
        const u: AuthUser = {
          id: profile.id, email: profile.email, name: profile.name,
          role: profile.role, org_name: profile.org_name,
          github_username: profile.github_username, github_email: profile.github_email,
        }
        setUser(u)
        localStorage.setItem(USER_KEY, JSON.stringify(u))
      } catch {
        setUser(null)
        setToken('')
        setSessionToken('')
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(USER_KEY)
      } finally {
        setLoading(false)
      }
    }
    validateSession()
  }, [])

  function persist(resp: AuthResponse) {
    const u: AuthUser = {
      id: resp.user_id, email: resp.email, name: resp.name,
      role: resp.role, org_name: null, github_username: null, github_email: null,
    }
    setUser(u)
    setToken(resp.token)
    setSessionToken(resp.token)
    localStorage.setItem(TOKEN_KEY, resp.token)
    localStorage.setItem(USER_KEY, JSON.stringify(u))
  }

  async function login(email: string, password: string) {
    setLoading(true)
    try {
      persist(await api.login(email, password))
    } finally {
      setLoading(false)
    }
  }

  async function register(email: string, password: string, name: string, orgName: string) {
    setLoading(true)
    try {
      const resp = await api.register(email, password, name, orgName)
      persist(resp)
      return resp
    } finally {
      setLoading(false)
    }
  }

  async function refreshUser() {
    try {
      const profile = await api.getMe()
      const u: AuthUser = {
        id: profile.id, email: profile.email, name: profile.name,
        role: profile.role, github_username: profile.github_username,
        github_email: profile.github_email,
      }
      setUser(u)
      localStorage.setItem(USER_KEY, JSON.stringify(u))
    } catch { /* ignore */ }
  }

  function logout() {
    setUser(null)
    setToken('')
    setSessionToken('')
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
