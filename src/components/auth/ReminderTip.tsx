import { useState } from 'react'
import { useAuth } from '../../features/auth/auth'
import { ButtonSpinner } from '../ui/PageLoader'

// A one-time card for new accounts suggesting email reminders.
// The server only flags accounts created after this feature shipped,
// and clears the flag once the person turns reminders on or dismisses the card.
export default function ReminderTip() {
  const { user } = useAuth()
  const [hidden, setHidden] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  if (!user?.showReminderTip || hidden) return null

  const post = (url: string, body: object) => fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  async function dismiss() {
    setHidden(true)
    await post('/api/auth/reminder-tip-seen', {}).catch(() => {})
  }
  async function turnOn() {
    setBusy(true); setError('')
    try {
      const response = await post('/api/auth/reminders', { enabled: true, zone: Intl.DateTimeFormat().resolvedOptions().timeZone })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Could not turn on reminders.')
      setDone(true)
      setTimeout(() => setHidden(true), 4000)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not turn on reminders.') }
    finally { setBusy(false) }
  }

  return (
    <aside aria-labelledby="reminder-tip-title" className="fixed bottom-4 right-4 z-[60] w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-dark-blue/15 bg-surface p-5 text-dark-blue shadow-xl">
      <button type="button" onClick={() => void dismiss()} aria-label="Close" className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-gray hover:bg-beige hover:text-dark-blue">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><path d="m6 6 12 12M18 6 6 18" /></svg>
      </button>
      <div className="flex items-start gap-3 pr-6">
        <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-light-pink">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>
        </span>
        <div className="min-w-0">
          <h2 id="reminder-tip-title" className="text-lg font-bold leading-tight">{done ? 'Reminders are on' : 'Never miss a deadline'}</h2>
          <p role="status" className="mt-1 text-sm leading-relaxed text-gray">
            {done
              ? "We'll email you when a task is due soon or overdue. You can change this anytime in your profile menu."
              : 'Want an email when a task is due soon? Turn on email reminders. You can change this anytime in your profile menu, under Email reminders.'}
          </p>
          {error && <p role="alert" className="mt-2 text-sm text-red">{error}</p>}
        </div>
      </div>
      {!done && (
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={() => void dismiss()} disabled={busy} className="min-h-10 rounded-lg border border-blue px-3 text-sm text-link hover:bg-lightest-blue/50 disabled:opacity-50">Not now</button>
          <button type="button" onClick={() => void turnOn()} disabled={busy} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-blue px-4 text-sm font-semibold text-white hover:bg-action-hover disabled:opacity-70">
            {busy && <ButtonSpinner />}{busy ? 'Turning on…' : 'Turn on reminders'}
          </button>
        </div>
      )}
    </aside>
  )
}
