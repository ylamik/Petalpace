import { useEffect } from 'react'
import { applyTheme, subscribeTheme } from './features/theme/theme'
import BinPage from './pages/BinPage'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router'
import AppLayout from './components/layout/AppLayout'
import HomePage from './pages/HomePage'
import SigninPage from './pages/SigninPage'
import SignupPage from './pages/SignupPage'
import TodayPage from './pages/TodayPage'
import PlannerPage from './pages/PlannerPage'
import AllTasksPage from './pages/AllTasksPage'
import SpacePage from './pages/SpacePage'
import CreateSpacePage from './pages/CreateSpacePage'
import NotFoundPage from './pages/NotFoundPage'
import AuthProvider from './features/auth/AuthProvider'
import RequireAccount from './features/auth/RequireAccount'
import AuthPage from './components/auth/AuthPage'
import CollaborationPage from './pages/CollaborationPage'
import CollabTaskPage from './pages/CollabTaskPage'
import CollabJoinPage from './pages/CollabJoinPage'

// Re-applies the theme on navigation, so public pages switch to light and app pages back.
function ThemeForRoute() {
  const { pathname } = useLocation()
  useEffect(() => { applyTheme() }, [pathname])
  return null
}

export default function App() {
  useEffect(()=>{applyTheme();return subscribeTheme(()=>{})},[])
  return (
    <BrowserRouter>
      <ThemeForRoute />
      <AuthProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/sign-in" element={<SigninPage />} />
          <Route path="/sign-up" element={<SignupPage />} />
          <Route path="/verify-email" element={<AuthPage key="verify" mode="verify-email" />} />
          <Route path="/forgot-password" element={<AuthPage key="forgot" mode="forgot-password" />} />
          <Route path="/reset-password" element={<AuthPage key="reset" mode="reset-password" />} />
          {/* Invite accept — public page, no layout wrapper needed */}
          <Route path="/collaboration/join" element={<CollabJoinPage />} />

          <Route element={<RequireAccount />}>
            <Route element={<AppLayout />}>
              <Route path="/spaces/new" element={<CreateSpacePage />} />
              <Route path="/today" element={<TodayPage />} />
              <Route path="/planner" element={<PlannerPage />} />
              <Route path="/upcoming" element={<Navigate to="/planner" replace />} />
              <Route path="/tasks" element={<AllTasksPage />} />
              <Route path="/calendar" element={<Navigate to="/planner?view=month" replace />} />
              <Route path="/bin" element={<BinPage />} />
              <Route path="/spaces/:spaceId" element={<SpacePage />} />
              <Route path="/collaboration" element={<CollaborationPage />} />
              <Route path="/collaboration/:taskId" element={<CollabTaskPage />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
