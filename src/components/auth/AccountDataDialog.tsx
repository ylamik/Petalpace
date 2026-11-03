import { useEffect, useRef, useState, type FormEvent } from 'react'
import { accountRequest, useAuth } from '../../features/auth/auth'
import { useSpaces } from '../../features/spaces/spaces'

type Props = { mode: 'export' | 'delete'; onClose: () => void }
export default function AccountDataDialog({ mode, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const { ensureSaved } = useSpaces()
  const { logout } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const dialog = ref.current, previous = document.activeElement
    dialog?.showModal()
    return () => { dialog?.close(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus() }
  }, [])
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy || (mode === 'delete' && confirmation !== 'DELETE')) return
    setBusy(true); setError('')
    try {
      if (!(await ensureSaved())) throw new Error('Your planner has unsaved changes. Retry saving before continuing.')
      if (mode === 'delete') {
        await accountRequest('delete-account', { password })
        setPassword('')
        await logout()
      } else {
        const response = await fetch('/api/auth/export', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(30000) })
        if (!response.ok) throw new Error('Could not export your account. Please sign in again and retry.')
        const url = URL.createObjectURL(await response.blob())
        const link = document.createElement('a'); link.href = url; link.download = `petalpace-export-${new Date().toISOString().slice(0,10)}.zip`; link.click()
        window.setTimeout(() => URL.revokeObjectURL(url), 60000)
        onClose()
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to complete this action.'); setBusy(false) }
  }
  const field = 'mt-2 min-h-11 w-full rounded-lg border border-dark-blue/25 bg-surface px-3 text-base'
  return <dialog ref={ref} aria-labelledby="account-data-title" onCancel={event => { event.preventDefault(); if (!busy) onClose() }} className="fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-2xl border border-dark-blue/20 bg-surface p-5 font-serif text-dark-blue shadow-xl backdrop:bg-black/40 sm:p-7">
    <form onSubmit={event => void submit(event)}>
      <h2 id="account-data-title" className="text-2xl font-semibold">{mode === 'delete' ? 'Delete your account forever?' : 'Export your planner?'}</h2>
      <p className="mt-3 text-sm text-gray">{mode === 'delete' ? 'This permanently deletes your account, tasks, Bin, files, photo, and activity. You cannot undo it. Export your planner first if you want a copy. Offline backups expire under the service retention policy.' : 'Download a ZIP file containing a spreadsheet of all your tasks (opens in Excel or Google Sheets) plus all your uploaded files organised by task. Links are included in the spreadsheet. Your password and login tokens are never exported.'}</p>
      {mode === 'delete' && <fieldset disabled={busy} className="mt-5 space-y-4"><label className="block text-sm font-medium">Current password<input autoFocus required autoComplete="current-password" type="password" maxLength={128} value={password} onChange={event => setPassword(event.target.value)} className={field}/></label><label className="block text-sm font-medium">Type DELETE to confirm<input required autoComplete="off" value={confirmation} onChange={event => setConfirmation(event.target.value)} className={field}/></label></fieldset>}
      {error && <p role="alert" className="mt-4 text-sm text-red">{error}</p>}
      <div className="mt-6 flex flex-wrap justify-end gap-3"><button type="button" disabled={busy} onClick={onClose} className="min-h-11 rounded-lg border border-blue px-4 text-link hover:bg-beige disabled:opacity-50">Cancel</button><button autoFocus={mode === 'export'} type="submit" disabled={busy || (mode === 'delete' && (!password || confirmation !== 'DELETE'))} className={`min-h-11 rounded-lg px-4 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 ${mode === 'delete' ? 'bg-danger hover:brightness-90' : 'bg-blue hover:bg-action-hover'}`}>{busy ? 'Please wait…' : mode === 'delete' ? 'Delete account forever' : 'Download my data'}</button></div>
    </form>
  </dialog>
}
