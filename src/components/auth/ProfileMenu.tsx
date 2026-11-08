import ReminderSettings from './ReminderSettings'
import AccountDataDialog from './AccountDataDialog'
import PhotoCropDialog from './PhotoCropDialog'
import ConfirmTaskDialog from '../../features/tasks/components/ConfirmTaskDialog'
import { useSpaces } from '../../features/spaces/spaces'
import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router'
import { accountRequest, useAuth } from '../../features/auth/auth'
import ThemeControl from '../ui/ThemeControl'
import { ButtonSpinner } from '../ui/PageLoader'

function initials(name: string) {
  const words = name.trim().split(/\s+/).map(word => word.match(/\p{L}/u)?.[0]).filter(Boolean)
  const letters = words.length > 1 ? `${words[0]}${words.at(-1)}` : words[0] || 'U'
  return Array.from(letters.toLocaleUpperCase()).slice(0, 2).join('')
}

export default function ProfileMenu({ variant = 'avatar' }: { variant?: 'avatar' | 'sidebar' }) {
  const { user, refresh, logout } = useAuth()
  const {ensureSaved}=useSpaces()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [cropFile, setCropFile] = useState<File | null>(null)
  const [signingOut, setSigningOut] = useState(false)
  const [confirmation, setConfirmation] = useState<'remove' | 'reset' | 'logout' | null>(null)
  const [remindersOpen,setRemindersOpen]=useState(false)
  const [reminders,setReminders]=useState<{enabled:boolean;zone:string}|null>(null)
  const [dataAction, setDataAction] = useState<'export' | 'delete' | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const firstAction = useRef<HTMLButtonElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const menuId = useId()
  useEffect(() => {
    if (!open) return
    firstAction.current?.focus()
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus() } }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) }
  }, [open])

  useEffect(() => {
    if (!open) return
    let alive = true
    fetch('/api/auth/reminders')
      .then(response => response.ok ? response.json() : null)
      .then(data => { if (alive && data) setReminders({ enabled: !!data.enabled, zone: data.zone || Intl.DateTimeFormat().resolvedOptions().timeZone }) })
      .catch(() => { /* The switch stays hidden if preferences can't load. */ })
    return () => { alive = false }
  }, [open])

  async function toggleReminders() {
    if (!reminders) return
    const previous = reminders
    const next = { ...reminders, enabled: !reminders.enabled }
    setReminders(next)
    try {
      const response = await fetch('/api/auth/reminders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) })
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error)
    } catch (error) {
      setReminders(previous)
      setNotice(error instanceof Error && error.message ? error.message : 'Could not save your reminder preference.')
    }
  }

  function changePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 12 * 1024 * 1024 || !file.size) {
      setNotice('Choose a JPG, PNG, or WebP photo up to 12 MB.')
      return
    }
    setNotice('')
    setOpen(false)
    setCropFile(file)
  }
  async function savePhoto(image: string) {
    await accountRequest('photo', { image })
    await refresh()
    setFailedPhoto(null)
    setCropFile(null)
    setNotice('Your profile photo is updated.')
    setOpen(true)
  }
  function ask(action: 'remove' | 'reset' | 'logout') { setOpen(false); setConfirmation(action) }
  function confirmAction() {
    const action = confirmation
    setConfirmation(null)
    if (action === 'reset') navigate('/forgot-password')
    else { setOpen(true); if (action === 'remove') void removePhoto(); if (action === 'logout') void signOut() }
  }
  async function removePhoto() {
    setBusy(true)
    try { await accountRequest('photo-remove', {}); await refresh(); setNotice('Photo removed. Your initials are back.') }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Could not remove your photo.') }
    finally { setBusy(false) }
  }
  async function signOut() {
    setBusy(true); setSigningOut(true)
    try { if (!(await ensureSaved())) { setNotice('Your planner changes are not saved yet. Retry saving before signing out.'); setBusy(false); setSigningOut(false); return } await logout() }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Could not sign out. Please try again.'); setBusy(false); setSigningOut(false) }
  }
  if (!user) return null
  const hasPhoto = !!user.photoUrl && failedPhoto !== user.photoUrl
  const sidebar = variant === 'sidebar'
  const item = 'flex min-h-9 w-full cursor-pointer items-center rounded-lg px-2 text-left text-[0.9375rem] hover:bg-beige disabled:opacity-60'
  const avatar = (size: string, text: string) => <span className={`${size} ${text} relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#FF686C] font-semibold text-white`}>
    {hasPhoto ? <img src={user.photoUrl!} alt="" className="h-full w-full object-cover" onError={() => setFailedPhoto(user.photoUrl!)} /> : initials(user.name)}
  </span>
  return <div ref={root} className={sidebar ? 'relative min-w-0 flex-1' : 'relative shrink-0'} onBlur={event => {
    if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false)
  }}>
    <button ref={trigger} type="button" aria-label={`Profile for ${user.name}`} aria-expanded={open} aria-controls={menuId} aria-haspopup="dialog" onClick={() => setOpen(value => !value)} className={sidebar ? 'flex min-h-12 w-full min-w-0 cursor-pointer items-center gap-2.5 rounded-xl px-1.5 text-left hover:bg-nav-active focus-visible:outline-2 focus-visible:outline-blue' : 'flex cursor-pointer rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue'}>
      {avatar('h-9 w-9', 'text-base')}
      {sidebar && <span className="min-w-0"><span className="block truncate text-[0.9375rem] font-semibold leading-tight">{user.name}</span><span className="block truncate text-xs text-gray">Account &amp; settings</span></span>}
    </button>
    {open && <div id={menuId} role="dialog" aria-label="Your profile" className={`absolute z-50 w-[min(276px,calc(100vw-2.5rem))] rounded-2xl border border-dark-blue/10 bg-surface p-4 text-dark-blue shadow-[0_8px_30px_rgb(0_0_0_/_0.18)] ${sidebar ? 'bottom-full left-0 mb-2' : 'right-0 top-full mt-3'}`}>
      <div className="mb-3 flex items-center gap-3">
        {avatar('h-11 w-11', 'text-lg')}
        <div className="min-w-0">
          <p className="break-words font-serif text-lg font-semibold leading-tight">{user.name}</p>
          <p className="break-all text-sm text-gray">{user.email}</p>
        </div>
      </div>
      <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choose profile photo" className="hidden" onChange={event => void changePhoto(event)} />
      <ThemeControl />
      <div className="mt-3 border-t border-dark-blue/10 pt-2">
        <button ref={firstAction} disabled={busy} type="button" onClick={() => fileInput.current?.click()} className={item}>{user.photoUrl ? 'Change profile photo' : 'Add profile photo'}</button>
        {user.photoUrl && <button type="button" disabled={busy} onClick={() => ask('remove')} className={item}>Remove photo</button>}
        <div className="flex min-h-9 items-center gap-2 rounded-lg hover:bg-beige">
          <button type="button" onClick={() => { setOpen(false); setRemindersOpen(true) }} className={`${item} min-w-0 flex-1 hover:bg-transparent`}>Email reminders</button>
          {reminders && <button type="button" role="switch" aria-checked={reminders.enabled} aria-label="Send email reminders" onClick={() => void toggleReminders()} className={`relative mr-2 h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue ${reminders.enabled ? 'bg-blue' : 'bg-light-gray'} hover:opacity-85`}>
            <span aria-hidden="true" className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-[left] ${reminders.enabled ? 'left-[18px]' : 'left-0.5'}`} />
          </button>}
        </div>
        <button type="button" disabled={busy} onClick={() => ask('reset')} className={item}>Reset password</button>
        <button type="button" disabled={busy} onClick={() => { setOpen(false); setDataAction('export') }} className={`${item} justify-between`}>Export my data<span className="text-xs text-gray">ZIP</span></button>
      </div>
      <div className="mt-2 border-t border-dark-blue/10 pt-2">
        <button type="button" disabled={busy} onClick={() => ask('logout')} className={`${item} gap-2 font-semibold`}>{signingOut && <ButtonSpinner />}{signingOut ? 'Signing out…' : 'Sign out'}</button>
        <button type="button" disabled={busy} onClick={() => { setOpen(false); setDataAction('delete') }} className={`${item} text-sm text-red`}>Delete account</button>
      </div>
      {notice && <p role="status" className="mt-2 text-sm leading-relaxed">{notice}</p>}
    </div>}
    {dataAction && <AccountDataDialog mode={dataAction} onClose={()=>{setDataAction(null);setOpen(true)}}/>}
    {remindersOpen && <ReminderSettings onClose={()=>setRemindersOpen(false)}/>}
      {cropFile && <PhotoCropDialog file={cropFile} onCancel={()=>{setCropFile(null);setOpen(true)}} onSave={savePhoto}/>}
    {signingOut && <div role="status" aria-live="assertive" className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-3 bg-canvas/85 text-dark-blue backdrop-blur-[2px]">
      <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-blue/25 border-t-blue" aria-hidden="true" />
      <p className="text-lg font-semibold">Signing out…</p>
      <p className="text-sm text-gray">Saving your planner first</p>
    </div>}
    {confirmation && <ConfirmTaskDialog
      title={confirmation==='remove' ? 'Remove your profile photo?' : confirmation==='reset' ? 'Reset your password?' : 'Sign out of Petalpace?'}
      message={confirmation==='remove' ? 'Your initials will appear instead. You can add another photo anytime.' : confirmation==='reset' ? 'Continue to the password reset page to request a secure email link. Your password stays the same until you choose a new one.' : 'Your saved tasks will be here when you sign in again.'}
      confirmLabel={confirmation==='remove' ? 'Remove photo' : confirmation==='reset' ? 'Continue to reset' : 'Sign out'}
      cancelLabel="Cancel" destructive={confirmation==='remove'} onCancel={()=>{setConfirmation(null);setOpen(true)}} onConfirm={confirmAction}/>}
  </div>
}
