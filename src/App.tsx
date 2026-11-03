import { useEffect } from 'react'
import { applyTheme, subscribeTheme } from './features/theme/theme'
import CalendarPage from './pages/CalendarPage'
import BinPage from './pages/BinPage'
import { BrowserRouter, Route, Routes } from 'react-router'
import AppLayout from './components/layout/AppLayout'
import HomePage from './pages/HomePage'
import SigninPage from './pages/SigninPage'
import SignupPage from './pages/SignupPage'
import TodayPage from './pages/TodayPage'
import UpcomingPage from './pages/UpcomingPage'
import AllTasksPage from './pages/AllTasksPage'
import SpacePage from './pages/SpacePage'
import CreateSpacePage from './pages/CreateSpacePage'
import NotFoundPage from './pages/NotFoundPage'
import AuthProvider from './features/auth/AuthProvider'
import RequireAccount from './features/auth/RequireAccount'
import AuthPage from './components/auth/AuthPage'

export default function App() {
  useEffect(()=>{applyTheme();return subscribeTheme(()=>{})},[])
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/sign-in" element={<SigninPage />} />
          <Route path="/sign-up" element={<SignupPage />} />
          <Route path="/verify-email" element={<AuthPage key="verify" mode="verify-email" />} />
          <Route path="/forgot-password" element={<AuthPage key="forgot" mode="forgot-password" />} />
          <Route path="/reset-password" element={<AuthPage key="reset" mode="reset-password" />} />

          <Route element={<RequireAccount />}>
            <Route element={<AppLayout />}>
              <Route path="/spaces/new" element={<CreateSpacePage />} />
              <Route path="/today" element={<TodayPage />} />
              <Route path="/upcoming" element={<UpcomingPage />} />
              <Route path="/tasks" element={<AllTasksPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/bin" element={<BinPage />} />
              <Route path="/spaces/:spaceId" element={<SpacePage />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
