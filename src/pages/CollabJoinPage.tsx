import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { collabApi } from '../features/collab/collab'
import { useAuth } from '../features/auth/auth'

export default function CollabJoinPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const token = new URLSearchParams(location.hash.slice(1)).get('token') ?? ''
  const [preview, setPreview] = useState<{ taskTitle: string; ownerName: string; email: string } | null>(null)
  const [error, setError] = useState('')
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    if (!token) return
    collabApi.previewJoin(token)
      .then(data => { setError(''); setPreview(data) })
      .catch(e => setError(e instanceof Error ? e.message : 'Invalid invite.'))
  }, [token])

  // Show invalid message if no token after mount
  const showInvalid = !token

  async function accept() {
    if (!user) { sessionStorage.setItem('petalpace-pending-invite',location.pathname+location.hash);navigate('/sign-in', { state: { from: location.pathname + location.hash } }); return }
    setJoining(true)
    try {
      const { taskId } = await collabApi.acceptJoin(token)
      sessionStorage.removeItem('petalpace-pending-invite')
      navigate(`/collaboration/${taskId}`, { replace: true })
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not join.'); setJoining(false) }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-page p-6 font-serif text-dark-blue">
      <div className="w-full max-w-[440px] rounded-2xl border border-dark-blue/15 bg-surface p-7 shadow-xl">
        <img src="/images/petalpace-logo.png" alt="Petalpace" className="mb-6 h-auto w-32" />

        {(error || showInvalid) ? (
          <>
            <h1 className="text-2xl font-bold">Invite not found</h1>
            <p className="mt-3 text-sm text-gray">{error || 'This invite link is invalid.'}</p>
            <button type="button" onClick={() => navigate('/')} className="mt-5 min-h-11 w-full rounded-lg bg-blue px-4 font-semibold text-white hover:bg-action-hover">Back to home</button>
          </>
        ) : !preview ? (
          <p className="text-sm text-gray">Checking your invite…</p>
        ) : (
          <>
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-lightest-blue" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-blue">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <h1 className="text-2xl font-bold leading-tight">You've been invited</h1>
            <p className="mt-3 text-sm leading-relaxed text-gray">
              <strong className="text-dark-blue">{preview.ownerName}</strong> has invited{' '}
              <strong className="text-dark-blue">{preview.email}</strong> to collaborate on:
            </p>
            <div className="mt-3 rounded-lg border border-dark-blue/15 bg-beige/40 px-4 py-3">
              <p className="font-semibold">{preview.taskTitle}</p>
            </div>
            <p className="mt-4 text-xs text-gray">
              {user
                ? user.email.toLowerCase() === preview.email.toLowerCase()
                  ? 'Click below to join this shared task.'
                  : `This invite was sent to ${preview.email}. You're signed in as ${user.email}. Please sign in with the correct account.`
                : 'You\'ll need a Petalpace account to join. Sign in or create one below.'}
            </p>
            {(!user || user.email.toLowerCase() === preview.email.toLowerCase()) && (
              <button
                type="button"
                onClick={() => void accept()}
                disabled={joining}
                className="mt-5 min-h-11 w-full rounded-lg bg-blue px-4 font-semibold text-white hover:bg-action-hover disabled:opacity-70"
              >
                {joining ? 'Joining…' : user ? 'Accept and open task' : 'Sign in to accept'}
              </button>
            )}
            {!user && (
              <p className="mt-3 text-center text-sm">
                New to Petalpace?{' '}
                <a onClick={()=>sessionStorage.setItem('petalpace-pending-invite',location.pathname+location.hash)} href={`/sign-up`} className="text-link hover:underline">Create an account</a>
              </p>
            )}
          </>
        )}
      </div>
    </main>
  )
}
