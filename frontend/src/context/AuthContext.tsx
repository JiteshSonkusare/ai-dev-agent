import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { api, setSessionToken, type AuthResponse } from '../api/client'

interface AuthUser {
  id: string
  email: string
  name: string
  project_id: string
  github_username: string | null
  github_email: string | null
}

interface AuthContextValue {
  user: AuthUser | null
  token: string
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string) => Promise<AuthResponse>
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

  // Validate session on app load
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
          id: profile.id,
          email: profile.email,
          name: profile.name,
          project_id: profile.project_id ?? '',
          github_username: profile.github_username,
          github_email: profile.github_email,
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
      id: resp.user_id,
      email: resp.email,
      name: resp.name,
      project_id: resp.project_id,
      github_username: null,
      github_email: null,
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
      const resp = await api.login(email, password)
      persist(resp)
    } finally {
      setLoading(false)
    }
  }

  async function register(email: string, password: string, name: string) {
    setLoading(true)
    try {
      const resp = await api.register(email, password, name)
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
        id: profile.id,
        email: profile.email,
        name: profile.name,
        project_id: profile.project_id ?? '',
        github_username: profile.github_username,
        github_email: profile.github_email,
      }
      setUser(u)
      localStorage.setItem(USER_KEY, JSON.stringify(u))
    } catch {
      // ignore
    }
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
