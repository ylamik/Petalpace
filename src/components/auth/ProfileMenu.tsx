import AccountDataDialog from './AccountDataDialog'
import PhotoCropDialog from './PhotoCropDialog'
import ConfirmTaskDialog from '../../features/tasks/components/ConfirmTaskDialog'
import { useSpaces } from '../../features/spaces/spaces'
import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router'
import { accountRequest, useAuth } from '../../features/auth/auth'

function initials(name: string) {
  const words = name.trim().split(/\s+/).map(word => word.match(/\p{L}/u)?.[0]).filter(Boolean)
  const letters = words.length > 1 ? `${words[0]}${words.at(-1)}` : words[0] || 'U'
  return Array.from(letters.toLocaleUpperCase()).slice(0, 2).join('')
}

export default function ProfileMenu({ doodle = true, compact = false }: { doodle?: boolean; compact?: boolean }) {
  const { user, refresh, logout } = useAuth()
  const {ensureSaved}=useSpaces()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [cropFile, setCropFile] = useState<File | null>(null)
  const [confirmation, setConfirmation] = useState<'remove' | 'reset' | 'logout' | null>(null)
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
    setBusy(true)
    try { if (!(await ensureSaved())) { setNotice('Your planner changes are not saved yet. Retry saving before signing out.'); setBusy(false); return } await logout() }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Could not sign out. Please try again.'); setBusy(false) }
  }
  if (!user) return null
  const hasPhoto = !!user.photoUrl && failedPhoto !== user.photoUrl
  return <div ref={root} className="relative shrink-0" onBlur={event => {
    if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false)
  }}>
    {doodle && <img src="/images/thin-doodle.png" alt="" aria-hidden="true" className="pointer-events-none absolute -top-6 -right-4 h-11 w-11 object-contain" />}
    <button ref={trigger} type="button" aria-label={`Profile for ${user.name}`} aria-expanded={open} aria-controls={menuId} aria-haspopup="dialog" onClick={() => setOpen(value => !value)} className={`${compact ? "h-9 w-9 text-base" : "h-11 w-11 text-xl"} relative flex items-center justify-center overflow-hidden rounded-full border border-dark-blue bg-[#FF686C] font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue`}>
      {hasPhoto ? <img src={user.photoUrl!} alt="" className="h-full w-full object-cover" onError={() => setFailedPhoto(user.photoUrl!)} /> : initials(user.name)}
    </button>
    {open && <div id={menuId} role="dialog" aria-label="Your profile" className="absolute right-0 top-full z-50 mt-3 w-[min(280px,calc(100vw-2.5rem))] rounded-xl border border-dark-blue/15 bg-surface p-4 text-dark-blue shadow-[0_4px_14px_rgb(0_0_0_/_0.15)]">
      <div className="mb-3 border-b border-dark-blue/10 pb-3">
        <p className="text-xs uppercase tracking-wider text-gray">Your little space</p>
        <p className="mt-1 break-words text-lg font-semibold">{user.name}</p>
        <p className="break-all text-xs text-gray">{user.email}</p>
      </div>
      <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choose profile photo" className="hidden" onChange={event => void changePhoto(event)} />
      <button ref={firstAction} disabled={busy} type="button" onClick={() => fileInput.current?.click()} className="min-h-11 w-full rounded-md bg-lightest-blue/60 px-3 py-2 text-left text-sm font-semibold hover:bg-lightest-blue disabled:opacity-60">{user.photoUrl ? 'Change profile photo' : 'Add profile photo'}</button>

      {user.photoUrl && <button type="button" disabled={busy} onClick={() => ask('remove')} className="mt-1 min-h-10 w-full rounded px-3 py-2 text-left text-sm text-link hover:bg-lightest-blue/30 disabled:opacity-60">Remove photo</button>}
      <button type="button" disabled={busy} onClick={() => ask('reset')} className="mt-2 flex min-h-10 w-full items-center rounded px-3 text-sm hover:bg-beige/60">Reset password</button>
      <button type="button" disabled={busy} onClick={()=>{setOpen(false);setDataAction('export')}} className="mt-1 min-h-10 w-full rounded px-3 text-left text-sm hover:bg-beige/60">Export my data</button>
      <button type="button" disabled={busy} onClick={()=>{setOpen(false);setDataAction('delete')}} className="mt-1 min-h-10 w-full rounded px-3 text-left text-sm text-red hover:bg-light-pink">Delete account</button>
      <div className="mt-2 border-t border-dark-blue/10 pt-2"><button type="button" disabled={busy} onClick={() => ask('logout')} className="min-h-11 w-full rounded-md px-3 py-2 text-left text-sm font-semibold text-red hover:bg-light-pink disabled:opacity-60">Sign out</button></div>
      {notice && <p role="status" className="mt-2 text-sm leading-relaxed">{notice}</p>}
    </div>}
    {dataAction && <AccountDataDialog mode={dataAction} onClose={()=>{setDataAction(null);setOpen(true)}}/>}
    {cropFile && <PhotoCropDialog file={cropFile} onCancel={()=>{setCropFile(null);setOpen(true)}} onSave={savePhoto}/>}
    {confirmation && <ConfirmTaskDialog
      title={confirmation==='remove' ? 'Remove your profile photo?' : confirmation==='reset' ? 'Reset your password?' : 'Sign out of Petalpace?'}
      message={confirmation==='remove' ? 'Your initials will appear instead. You can add another photo anytime.' : confirmation==='reset' ? 'Continue to the password reset page to request a secure email link. Your password stays the same until you choose a new one.' : 'Your saved tasks will be here when you sign in again.'}
      confirmLabel={confirmation==='remove' ? 'Remove photo' : confirmation==='reset' ? 'Continue to reset' : 'Sign out'}
      cancelLabel="Cancel" destructive={confirmation==='remove'} onCancel={()=>{setConfirmation(null);setOpen(true)}} onConfirm={confirmAction}/>}
  </div>
}
