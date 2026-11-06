import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from './auth'
import SpacesProvider from '../spaces/SpacesProvider'
import PageLoader from '../../components/ui/PageLoader'

export default function RequireAccount() {
  const { user, loading, error, refresh } = useAuth()
  const location = useLocation()
  if (loading) return <PageLoader label="Opening your planner…" />
  if (error) return <main className="p-8 text-dark-blue"><p role="alert">{error}</p><button type="button" onClick={() => void refresh()} className="mt-4 rounded bg-blue px-4 py-2 text-white hover:bg-action-hover">Try again</button></main>
  if (!user) return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />
  // Prevent one account's in-memory planner state from surviving an account switch.
  return <SpacesProvider key={user.id}><Outlet /></SpacesProvider>
}
