import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { accountRequest, AuthContext, type Account } from './auth'

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Account | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const revision = useRef(0)
  const signingIn = useRef(false)
  const navigate = useNavigate()

  const endingSession = useRef<Promise<unknown> | null>(null)
  const revokeSession = useCallback(() => {
    if (!endingSession.current) endingSession.current = accountRequest('logout', {}).finally(() => { endingSession.current = null })
    return endingSession.current
  }, [])
  const refresh = useCallback(async () => {
    if (signingIn.current) return
    const current = ++revision.current
    try {
      // After signing out in this tab, don't trust a cached session until the person signs in again.
      const mustSignIn = sessionStorage.getItem('petalpace-require-signin') === '1'
      const result = mustSignIn ? { user: null } : await accountRequest('me')
      if (current !== revision.current) return
      setUser(result.user ?? null)
      setError('')
    } catch (error) {
      if (current !== revision.current) return
      setUser(null)
      setError(error instanceof Error ? error.message : 'Unable to check your session.')
    } finally { if (current === revision.current) setLoading(false) }
  }, [])
  // Visiting the home page no longer signs you out, so "Remember me" keeps working when you come back.
  useEffect(() => {
    const generation = revision
    // The request resolves asynchronously; there are no synchronous state updates.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh()
    // Recheck after returning to this tab, including a logout in another tab.
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh() }
    document.addEventListener('visibilitychange', onVisible)
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh() }, 60000)
    // Recheck when bfcache restores the page (browser back/forward).
    // This ensures a logged-out user can't see a cached authenticated view.
    const onPageShow = (event: PageTransitionEvent) => { if (event.persisted) void refresh() }
    window.addEventListener('pageshow', onPageShow)
    return () => { generation.current++; window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('pageshow', onPageShow) }
  }, [refresh])
  async function signIn(email: string, password: string, remember = false) {
    signingIn.current = true
    revision.current++
    try {
      if (endingSession.current) await endingSession.current
      const result = await accountRequest('login', { email, password, remember: remember ? '1' : '0' })
      sessionStorage.removeItem('petalpace-require-signin')
      revision.current++
      setUser(result.user ?? null)
      setError('')
    } finally { signingIn.current = false; setLoading(false) }
  }
  async function logout() {
    sessionStorage.setItem('petalpace-require-signin', '1')
    await revokeSession()
    revision.current++
    setUser(null)
    setError('')
    // Replace current history entry so protected pages are not reachable via Forward.
    navigate('/', { replace: true })
  }
  return <AuthContext.Provider value={{ user: sessionStorage.getItem('petalpace-require-signin') === '1' ? null : user, loading, error, refresh, signIn, logout }}>{children}</AuthContext.Provider>
}
