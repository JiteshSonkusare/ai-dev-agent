import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import TasksPage from './pages/TasksPage'
import PullTasksPage from './pages/PullTasksPage'
import TaskProgressPage from './pages/TaskProgressPage'
import DashboardPage from './pages/DashboardPage'
import SettingsPage from './pages/SettingsPage'
import BatchRunPage from './pages/BatchRunPage'

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1 } } })

const savedTheme = localStorage.getItem('cc_theme')
if (savedTheme !== 'light') document.documentElement.classList.add('dark')

function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--bg-main)]">
        <div className="w-8 h-8 border-2 border-[#DA7756] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="tasks/pull" element={<PullTasksPage />} />
        <Route path="tasks/:taskId/progress" element={<TaskProgressPage />} />
        <Route path="batch-run" element={<BatchRunPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <QueryClientProvider client={qc}>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
