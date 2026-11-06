import TimePicker from '../features/tasks/components/TimePicker'
import { deadlineInstant } from '../features/tasks/deadlineZone'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { collabApi, type CollabTask, type CollabSubtask, type CollabUpdatePayload } from '../features/collab/collab'
import PageLoader from '../components/ui/PageLoader'
import { ButtonSpinner } from '../components/ui/PageLoader'
import FileTypeIcon from '../components/ui/FileTypeIcon'
import { useAuth } from '../features/auth/auth'
import ConfirmTaskDialog from '../features/tasks/components/ConfirmTaskDialog'
import { usePlannerSync } from '../hooks/usePlannerSync'
import PlannerSelect from '../components/ui/PlannerSelect'

const statusOptions = [
  { value: 'todo', label: 'To do', color: 'bg-light-gray/60 text-gray' },
  { value: 'progress', label: 'In progress', color: 'bg-lightest-blue text-dark-blue' },
  { value: 'done', label: 'Done', color: 'bg-light-green text-done-ink' },
  { value: 'blocked', label: 'Blocked', color: 'bg-light-orange text-orange' },
]
type StepStatus = NonNullable<CollabSubtask['status']>
const stepStatusChoices = statusOptions.map(({ value, label }) => ({ value, label }))
const stepTone = (s: CollabSubtask): StepStatus => s.done ? 'done' : s.status && s.status !== 'done' ? s.status : 'todo'
const permissionOptions = [
  { value: 'editor', label: 'Edit all content', description: 'Change anything in this task, even items not assigned to them.' },
  { value: 'steps', label: 'Assigned items only', description: 'Update the status, notes and links of items assigned to them.' },
  { value: 'viewer', label: 'View only', description: 'Read and download. No changes.' },
]
const permissionLabel = (role: string) => permissionOptions.find(o => o.value === (role === 'member' ? 'steps' : role))?.label ?? role
type InviteRow = { key: number; email: string; permission: string }
const TrashIcon = () => <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>

function MemberBadge({ member }: { member: CollabTask['members'][number] }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-dark-blue/15 bg-beige/40 px-3 py-2 text-sm">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#FF686C] text-xs font-semibold text-white">
        {member.photoUrl ? <img src={member.photoUrl} alt="" className="h-full w-full object-cover" /> : member.name.slice(0, 2).toUpperCase()}
      </div>
      <div className="min-w-0">
        <p className="truncate font-medium">{member.name}</p>
        <p className="truncate text-xs text-gray">{member.email}</p>
      </div>
      <span className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-xs ${member.role === 'owner' ? 'bg-lightest-blue text-dark-blue' : 'bg-light-gray/60 text-gray'}`}>
        {member.role === 'owner' ? 'Owner' : permissionLabel(member.role)}
      </span>
    </div>
  )
}

export default function CollabTaskPage() {
  const { taskId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [task, setTask] = useState<CollabTask | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [syncing,setSyncing]=useState(false)
  const [invites, setInvites] = useState<InviteRow[]>([{ key: 0, email: '', permission: 'steps' }])
  const [inviteMsg, setInviteMsg] = useState<string[]>([])
  const [inviteBusy, setInviteBusy] = useState(false)
  const [pendingStatus,setPendingStatus]=useState<CollabTask['status'] | null>(null)
  const [memberToRemove,setMemberToRemove]=useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [stepToRemove,setStepToRemove]=useState<CollabSubtask | null>(null)
  const [pendingStep,setPendingStep]=useState<{step:CollabSubtask;status:StepStatus} | null>(null)
  const [detailsOpen,setDetailsOpen]=useState(false)
  const [newSubtask, setNewSubtask] = useState('')

  const isOwner = task?.ownerId === user?.id
  const canEdit=isOwner || task?.members.find(m=>m.id===user?.id)?.role==='editor'
  const currentRole=task?.members.find(m=>m.id===user?.id)?.role
  const busyRef=useRef(false)

  // Load on mount
  useEffect(() => {
    if (!taskId) return
    collabApi.get(taskId).then(r => setTask(r.task)).catch(e => setError(e.message))
  }, [taskId])

  // Real-time sync — reload when a collab change event fires
  usePlannerSync(user?.id ? `collab:${user.id}` : null, () => {
    if (!taskId || busyRef.current) return
    if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName || '')){setSaveError('Shared changes are available. Save your draft or reload to review them.');return}
    setSyncing(true)
    collabApi.get(taskId).then(r => {if(!busyRef.current)setTask(r.task)}).catch(e=>setSaveError(e.message)).finally(()=>setSyncing(false))
  })

  async function save(patch: CollabUpdatePayload) {
    if (!task || busyRef.current) return
    busyRef.current=true
    setSaving(true); setSaveError('')
    try {
      const { task: updated } = await collabApi.update(task.id, {revision:task.revision,...patch})
      setTask(updated)
      return updated
    } catch (e) { setSaveError(e instanceof Error ? e.message : 'Could not save.') }
    finally { busyRef.current=false;setSaving(false) }
  }

  async function addSubtask() {
    if (!task || !newSubtask.trim()) return
    const subtasks = [...task.subtasks, { id: '', title: newSubtask.trim(), done: false, assignedTo: null, position: task.subtasks.length }]
    if(await save({ subtasks }))setNewSubtask('')
  }

  async function setStepStatus(s: CollabSubtask, status: StepStatus) {
    if (!task) return
    await save({ subtasks: task.subtasks.map(item => item.id === s.id ? { ...item, status, done: status === 'done' } : item) })
  }

  async function removeSubtask(s: CollabSubtask) {
    if (!task) return
    setStepToRemove(s)
  }

  async function addLink(value: string, step?: CollabSubtask) {
    if (!task || !value.trim()) return
    try {
      const url = new URL(value.trim())
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error()
      return step
        ? await save({subtasks:task.subtasks.map(s=>s.id===step.id?{...s,links:[...(s.links || []),url.href]}:s)})
        : await save({links:[...task.links.map(l=>l.url),url.href]})
    } catch { setSaveError('Enter a valid link starting with https:// or http://.') }
  }
  async function removeLink(id: string, step?: CollabSubtask) {
    if (!task) return
    if(step) await save({subtasks:task.subtasks.map(s=>s.id===step.id?{...s,links:(s.links || []).filter((_,i)=>String(i)!==id)}:s)})
    else await save({ links: task.links.filter(l => l.id !== id).map(l => l.url) })
  }

  async function uploadFiles(selected: File[], stepId?:string) {
    if (!task) return
    const valid = selected.filter(f => /\.(pdf|docx?|pptx?|png|jpe?g|webp)$/i.test(f.name) && f.size <= 10 * 1024 * 1024)
    if (valid.length!==selected.length || !valid.length) { setSaveError('Use documents or PNG, JPEG, WebP images up to 10 MB each.'); return }
    let encoded
    try{encoded = await Promise.all(valid.map(f => new Promise<{name:string;type:string;data:string;lastModified:number}>((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject(new Error('Could not read file.'))
      reader.onload = () => resolve({ name: f.name, type: f.type, lastModified: f.lastModified, data: String(reader.result).split(',')[1] })
      reader.readAsDataURL(f)
    })))}catch{setSaveError('Could not read the selected file. Please try again.');return}
    await save({ files: [...task.files.map(f=>({...f,data:''})),...encoded.map(f=>({...f,subtaskId:stepId || null}))] })
  }

  async function removeFile(id: string) {
    if (!task) return
    // Optimistically update UI then persist — send remaining file IDs so server drops the removed one
    const remaining = task.files.filter(f => f.id !== id)

    // Signal server with the IDs of files to keep (empty data = keep existing by id)
    await save({files:remaining.map(f=>({...f,data:''}))})
  }

  // Send every filled-in row; keep the ones that failed so they can be fixed and retried.
  async function sendInvites() {
    const rows = invites.filter(r => r.email.trim())
    if (!task || !rows.length) return
    setInviteBusy(true); setInviteMsg([])
    const messages: string[] = [], failed: InviteRow[] = []
    for (const row of rows) {
      try {
        const { message } = await collabApi.invite(task.id, row.email.trim(), row.permission)
        messages.push(`${row.email.trim()}: ${message}`)
      } catch (e) {
        messages.push(`${row.email.trim()}: ${e instanceof Error ? e.message : 'Could not send invite.'}`)
        failed.push(row)
      }
    }
    setInviteMsg(messages)
    setInvites(failed.length ? failed : [{ key: Date.now(), email: '', permission: 'steps' }])
    setInviteBusy(false)
  }
  const updateInvite = (key: number, change: Partial<InviteRow>) => setInvites(rows => rows.map(r => r.key === key ? { ...r, ...change } : r))

  async function removeMember(userId: string) {
    if (!task) return
    const { task: updated } = await collabApi.removeMember(task.id, userId)
    setTask(updated)
  }

  if (!task && !error) return <PageLoader label="Loading shared task…" />
  if (error) return (
    <div className="p-8 text-dark-blue">
      <p role="alert">{error}</p>
      <button type="button" onClick={() => navigate('/collaboration')} className="mt-4 rounded-lg bg-blue px-4 py-2 text-white">Back to Collaboration</button>
    </div>
  )
  if (!task) return null

  // Limited members may edit the notes and links of steps assigned to them.
  const ownsStep = (step?: CollabSubtask) => !!step && !canEdit && ['member','steps'].includes(currentRole || '') && step.assignedTo === user?.id
  function resources(step?: CollabSubtask) {
    if(!task) return null
    return <SharedResources canEditLinks={!!canEdit || ownsStep(step)}
      files={task.files.filter(f=>(f.subtaskId || null)===(step?.id || null))}
      links={step?(step.links || []).map((url,i)=>({id:String(i),url})):task.links}
      taskId={task.id} canEdit={!!canEdit} saving={saving}
      upload={files=>uploadFiles(files,step?.id)} addLink={url=>addLink(url,step)}
      removeFile={removeFile} removeLink={id=>removeLink(id,step)}/>
  }

  const currentStatus = statusOptions.find(s => s.value === task.status) ?? statusOptions[0]
  const completedCount = task.subtasks.filter(s => s.done).length

  return (
    <div className="mx-auto max-w-[900px] text-dark-blue">
      {/* Back nav */}
      <nav className="mb-5">
        <button type="button" onClick={() => navigate('/collaboration')} className="inline-flex items-center gap-1 text-sm text-link hover:underline">
          ← Collaboration
        </button>
      </nav>

      {/* Header */}
      <header className="rounded-2xl border border-dark-blue/15 bg-surface p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="h-5 w-5 shrink-0 rounded-full" style={{ backgroundColor: task.color }} aria-hidden="true" />
            <h1 className="break-words text-2xl font-bold sm:text-3xl">{task.title}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={()=>{navigator.clipboard.writeText(window.location.href).then(()=>setSaveError('Task link copied. Only invited members can open it.')).catch(()=>setSaveError('Copy the page address to share with existing members.'))}} className="min-h-10 rounded-lg border border-blue/30 px-3 text-sm text-link">Copy task link</button>
            {/* Status selector — all members can change */}
            {canEdit && !saving ? (
              <PlannerSelect
                label="Task status"
                value={task.status}
                tone={task.status}
                className="min-h-10 rounded-full"
                options={stepStatusChoices}
                onChange={value => {const next=value as CollabTask['status'];if(next!==task.status && (next==='done' || task.status==='done'))setPendingStatus(next);else void save({status:next})}}
              />
            ) : (
              <span className={`rounded-full px-3 py-1.5 text-sm font-medium ${currentStatus.color}`}>{currentStatus.label}</span>
            )}
            <span className={`rounded-full px-3 py-1.5 text-sm ${task.priority === 'High' ? 'bg-light-red text-red' : task.priority === 'Medium' ? 'bg-light-orange text-orange' : 'bg-light-gray text-gray'}`}>
              ⚑ {task.priority}
            </span>
            {task.dueDate && <span className="rounded-full bg-light-gray/50 px-3 py-1.5 text-sm text-gray">Due {new Date(`${task.dueDate}T12:00:00`).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}{task.dueTime ? ` · ${task.dueTime}` : ''} ({zoneLabel(task.dueZone)})</span>}
            {yourTime(task) && <span className="rounded-full bg-light-gray/50 px-3 py-1.5 text-sm text-gray">Your time: {yourTime(task)}</span>}
          </div>
        </div>
        {syncing && <p role="status" className="mt-3 text-sm text-link">Updating shared task…</p>}
        {saving && <p className="mt-3 text-xs text-gray flex items-center gap-2"><ButtonSpinner />Saving…</p>}
        {saveError && <div role="alert" className="mt-3 text-sm text-red">{saveError}<button onClick={()=>window.location.reload()} className="ml-2 text-link underline">Reload shared task</button></div>}
      </header>

      {canEdit && <section className="mt-4 rounded-xl border border-dark-blue/15 bg-surface">
        <h2>
          <button type="button" aria-expanded={detailsOpen} aria-controls="shared-details" onClick={() => setDetailsOpen(open => !open)} className="flex w-full items-center justify-between gap-3 rounded-xl px-5 py-4 text-left font-semibold hover:bg-beige/40 focus-visible:outline-2 focus-visible:outline-blue">
            <span>Edit task details <span className="ml-1 text-sm font-normal text-gray">Title, due date, priority, timezone</span></span>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={`h-5 w-5 shrink-0 transition-transform ${detailsOpen ? 'rotate-180' : ''}`}><path d="m6 9 6 6 6-6"/></svg>
          </button>
        </h2>
        {detailsOpen && <div id="shared-details" className="border-t border-dark-blue/10 px-5 pb-5 pt-4"><SharedDetails canChangeZone={isOwner} key={task.id} task={task} save={save}/></div>}
      </section>}
      <section className="mt-4 rounded-xl border border-dark-blue/15 bg-surface p-5">
        <h2 className="font-bold">Group resources</h2>
        <p className="mb-3 mt-1 text-sm text-gray">Files and links for the whole group. Resources for a delegated task belong inside that task below.</p>
        {resources()}
      </section>
      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        {/* Main column */}
        <div className="space-y-5">
          {/* Notes */}
          <section className="rounded-xl border border-dark-blue/15 bg-surface p-5">
            <h2 className="mb-3 font-bold">Notes</h2>
            {canEdit ? <NoteEditor value={task.notes} revision={task.revision} onSave={(notes,revision) => save({ notes,revision })} /> : <p className="whitespace-pre-wrap break-words text-sm">{task.notes || 'No notes yet.'}</p>}
          </section>

          {/* Subtasks */}
          <section className="rounded-xl border border-dark-blue/15 bg-surface p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-bold">Delegated tasks</h2>
              <span className="text-xs text-gray">{completedCount}/{task.subtasks.length} done</span>
            </div>
            <div className="mb-3 -mt-2 flex flex-wrap gap-1.5">
              {task.subtasks.length > 0 && statusOptions.map(o => {const count=task.subtasks.filter(s=>stepTone(s)===o.value).length;return count ? <span key={o.value} className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${o.color}`}>{count} {o.label.toLowerCase()}</span> : null})}
            </div>
            {task.subtasks.length > 0 && (
              <div className="mb-1 h-2 overflow-hidden rounded-full bg-light-gray/50">
                <div className="h-full rounded-full bg-[#91AE87] transition-all" style={{ width: `${task.subtasks.length ? (completedCount / task.subtasks.length) * 100 : 0}%` }} />
              </div>
            )}
            <p className="mt-3 text-sm text-gray">Divide the work and assign each item to a member. Open an item’s notes and resources below.</p>
            <ul className="mt-4 space-y-3">
              {task.subtasks.map(s => (
                <li key={s.id} className="min-w-0 rounded-xl border border-dark-blue/15 bg-beige/20 p-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-2 sm:flex-nowrap sm:gap-3">
                  <span className={`min-w-0 basis-full break-words text-sm font-medium sm:flex-1 sm:basis-auto ${s.done ? 'text-gray line-through' : ''}`}>{s.title}</span>
                  {canEdit || ownsStep(s) ? (
                    <PlannerSelect label={`Status for ${s.title}`} value={stepTone(s)} tone={stepTone(s)} className="min-h-10 w-36 shrink-0" options={stepStatusChoices} onChange={value => {const next=value as StepStatus;if(saving || next===stepTone(s))return;setPendingStep({step:s,status:next})}} />
                  ) : (
                    <span className={`inline-flex min-h-10 w-36 shrink-0 items-center rounded-lg px-3 text-sm font-medium ${statusOptions.find(o => o.value === stepTone(s))?.color}`}>{statusOptions.find(o => o.value === stepTone(s))?.label}</span>
                  )}
                  {canEdit ? (
                    <PlannerSelect label={`Assign ${s.title}`} value={s.assignedTo || ''} className="min-h-10 w-40 shrink-0" options={[{value:'',label:'Unassigned'},...task.members.map(m=>({value:m.id,label:m.name}))]} onChange={value=>{if(!saving)void save({subtasks:task.subtasks.map(step=>step.id===s.id?{...step,assignedTo:value || null}:step)})}} />
                  ) : (
                    <span className="shrink-0 text-xs text-gray">
                      {s.assignedTo ? task.members.find(m => m.id === s.assignedTo)?.name ?? '' : 'Unassigned'}
                    </span>
                  )}
                  {canEdit && (
                    <button type="button" onClick={() => removeSubtask(s)} aria-label={`Remove delegated task: ${s.title}`} title="Remove" className="ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray hover:bg-light-red/30 hover:text-red sm:ml-0"><TrashIcon /></button>
                  )}
                  </div>
                  <details className="mt-3 w-full min-w-0 border-t border-dark-blue/10 pt-3">
                    <summary className="cursor-pointer text-sm font-medium text-link">Notes &amp; resources ({task.files.filter(f=>f.subtaskId===s.id).length+(s.links?.length || 0)})</summary>
                    <div className="mt-3 space-y-4">
                      {canEdit && <NoteEditor singleLine value={s.title} revision={task.revision} onSave={(title,revision)=>save({revision,subtasks:task.subtasks.map(item=>item.id===s.id?{...item,title}:item)})}/>}
                      {canEdit || ownsStep(s) ? <NoteEditor value={s.notes || ''} revision={task.revision} onSave={(notes,revision)=>save({revision,subtasks:task.subtasks.map(item=>item.id===s.id?{...item,notes}:item)})}/> : <p className="whitespace-pre-wrap break-words text-sm">{s.notes || 'No notes yet.'}</p>}
                      {resources(s)}
                    </div>
                  </details>
                </li>
              ))}
            </ul>
            {canEdit && <form onSubmit={e => { e.preventDefault(); void addSubtask() }} className="mt-3 flex gap-2">
              <input
                value={newSubtask}
                onChange={e => setNewSubtask(e.target.value)}
                placeholder="Add a delegated task…"
                maxLength={500}
                className="min-h-10 min-w-0 flex-1 rounded-lg border border-dark-blue/20 bg-surface px-3 text-sm focus-visible:outline-blue"
              />
              <button type="submit" disabled={!newSubtask.trim()} className="min-h-10 rounded-lg border border-dark-blue/15 px-3 text-sm text-link disabled:opacity-40">+ Add</button>
            </form>}
          </section>


        </div>

        {/* Sidebar column — members */}
        <aside className="space-y-5">
          <section className="rounded-xl border border-dark-blue/15 bg-surface p-5">
            <h2 className="mb-3 font-bold">Members</h2>
            <div className="space-y-2">
              {task.members.map(m => (
                <div key={m.id} className="group flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <MemberBadge member={m} />{isOwner && m.role!=='owner' && <PlannerSelect label={`Permission for ${m.name}`} value={m.role==='member'?'steps':m.role} className="mt-1 min-h-10 w-full" options={permissionOptions} onChange={value=>{void collabApi.permission(task.id,m.id,value).then(r=>setTask(r.task)).catch(e=>setSaveError(e.message))}}/>}
                  </div>
                  {isOwner && m.role !== 'owner' && (
                    <button type="button" onClick={() => setMemberToRemove(m.id)} aria-label={`Remove ${m.name}`} className="shrink-0 rounded px-1.5 text-xs text-red opacity-0 group-hover:opacity-100 hover:bg-light-red/30 focus-visible:opacity-100">Remove</button>
                  )}
                </div>
              ))}
            </div>

            {isOwner && (
              <div className="mt-4 border-t border-dark-blue/10 pt-4">
                <p className="text-sm font-semibold">Invite people</p>
                <p className="mb-3 mt-0.5 text-xs text-gray">Add as many people as you need and choose what each person can do.</p>
                <div className="space-y-3">
                  {invites.map((row, index) => (
                    <div key={row.key} className="rounded-xl border border-dark-blue/15 bg-beige/20 p-2.5">
                      <div className="flex items-center gap-2">
                        <input
                          type="email"
                          value={row.email}
                          onChange={e => updateInvite(row.key, { email: e.target.value })}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void sendInvites() } }}
                          placeholder="Enter email"
                          aria-label={`Email for person ${index + 1}`}
                          className="min-h-10 min-w-0 flex-1 rounded-lg border border-dark-blue/20 bg-surface px-3 text-sm focus-visible:outline-blue"
                        />
                        {invites.length > 1 && (
                          <button type="button" onClick={() => setInvites(rows => rows.filter(r => r.key !== row.key))} aria-label={`Remove person ${index + 1}`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray hover:bg-light-red/30 hover:text-red"><TrashIcon /></button>
                        )}
                      </div>
                      <PlannerSelect label={`Permission for person ${index + 1}`} value={row.permission} className="mt-2 min-h-10 w-full" options={permissionOptions} onChange={permission => updateInvite(row.key, { permission })} />
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => setInvites(rows => [...rows, { key: Date.now(), email: '', permission: rows.at(-1)?.permission ?? 'steps' }])} disabled={invites.length >= 10} className="min-h-10 rounded-lg border border-dark-blue/15 px-3 text-sm text-link hover:bg-beige/60 disabled:opacity-40">+ Add another</button>
                  <button type="button" onClick={() => void sendInvites()} disabled={inviteBusy || !invites.some(r => r.email.trim())} className="ml-auto inline-flex min-h-10 items-center gap-2 rounded-lg bg-blue px-4 text-sm font-semibold text-white hover:bg-action-hover disabled:opacity-60">
                    {inviteBusy && <ButtonSpinner />}{inviteBusy ? 'Sending…' : invites.filter(r => r.email.trim()).length > 1 ? `Send ${invites.filter(r => r.email.trim()).length} invites` : 'Send invite'}
                  </button>
                </div>
                {inviteMsg.length > 0 && <ul role="status" className="mt-2 space-y-1 text-xs text-gray">{inviteMsg.map(m => <li key={m} className="break-words">{m}</li>)}</ul>}
                <p className="mt-2 text-xs text-gray">Each person gets an email with a link to join. They need a Petalpace account. Only you can manage members.</p>
              </div>
            )}
          </section>

          {/* Danger zone */}
          <section className="rounded-xl border border-dark-blue/15 bg-surface p-5">
            {isOwner ? (
              <button type="button" onClick={() => setConfirmDelete(true)} className="w-full rounded-lg border border-red/30 py-2.5 text-sm text-red hover:bg-light-red/30">
                Delete shared task
              </button>
            ) : (
              <button type="button" onClick={() => setConfirmLeave(true)} className="w-full rounded-lg border border-dark-blue/15 py-2.5 text-sm text-gray hover:bg-beige/60">
                Leave this task
              </button>
            )}
          </section>
        </aside>
      </div>

      {pendingStep && (() => {
        const from = stepTone(pendingStep.step), to = pendingStep.status
        const label = (v: string) => statusOptions.find(o => o.value === v)?.label ?? v
        return <ConfirmTaskDialog
          title={to === 'done' ? 'Mark this item as done?' : from === 'done' ? 'Reopen this item?' : `Change status to ${label(to)}?`}
          message={`“${pendingStep.step.title}” will move from ${label(from)} to ${label(to)}. Every member will see this change.`}
          confirmLabel={to === 'done' ? 'Mark as done' : from === 'done' ? 'Reopen item' : 'Change status'}
          cancelLabel="Cancel"
          destructive={false}
          onCancel={() => setPendingStep(null)}
          onConfirm={() => { const { step, status } = pendingStep; setPendingStep(null); void setStepStatus(step, status) }}
        />
      })()}
      {stepToRemove && <ConfirmTaskDialog title="Remove delegated task?" message="This removes this item and its notes, links and attached files for every member." confirmLabel="Remove item" onCancel={()=>setStepToRemove(null)} onConfirm={async()=>{if(await save({subtasks:task.subtasks.filter(s=>s.id!==stepToRemove.id)}))setStepToRemove(null)}}/>}
      {memberToRemove && <ConfirmTaskDialog title="Remove this member?" message="Their access will end and their assignments will become unassigned. Their work stays in the task." confirmLabel="Remove member" onCancel={()=>setMemberToRemove(null)} onConfirm={()=>{void removeMember(memberToRemove).catch(e=>setSaveError(e.message));setMemberToRemove(null)}}/>}
      {pendingStatus && <ConfirmTaskDialog title={pendingStatus==='done'?'Mark shared task done?':'Reopen this shared task?'} message="This status change will be visible to every member." confirmLabel="Confirm change" onCancel={()=>setPendingStatus(null)} onConfirm={()=>{void save({status:pendingStatus});setPendingStatus(null)}}/>}
      {confirmDelete && (
        <ConfirmTaskDialog
          title="Delete this shared task?"
          message="This will permanently remove the task, all subtasks, files, and links for every member. This cannot be undone."
          confirmLabel="Delete forever"
          cancelLabel="Keep task"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            await collabApi.delete(task.id)
            navigate('/collaboration')
          }}
        />
      )}
      {confirmLeave && (
        <ConfirmTaskDialog
          title="Leave this shared task?"
          message="You'll no longer have access. The task owner can re-invite you later."
          confirmLabel="Leave task"
          cancelLabel="Stay"
          onCancel={() => setConfirmLeave(false)}
          onConfirm={async () => {
            await collabApi.leave(task.id)
            navigate('/collaboration')
          }}
        />
      )}
    </div>
  )
}

function NoteEditor({ value,revision, onSave,singleLine=false }: { singleLine?:boolean;value: string;revision:number; onSave: (v: string,revision:number) => Promise<CollabTask | undefined> }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  // Reset draft when editing begins so it reflects the latest saved value
  const baseline=useRef(revision)
  function startEditing() { baseline.current=revision;setDraft(value); setEditing(true) }
  if (!editing) {
    return (
      <div className="group flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-gray">{value || 'No notes yet. Click Edit to add some.'}</p>
        <button type="button" onClick={startEditing} className="shrink-0 rounded px-2 py-1 text-sm text-link hover:bg-lightest-blue/30">✎ {singleLine ? "Edit title" : "Edit notes"}</button>
      </div>
    )
  }
  return (
    <div>
      {singleLine ? <label className="block text-sm">Delegated task title<input autoFocus required maxLength={500} value={draft} onChange={e=>setDraft(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-dark-blue/20 bg-surface px-3"/></label> : <textarea
        aria-label="Notes"
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        maxLength={20000}
        rows={5}
        className="block min-h-28 w-full rounded-lg border border-dark-blue/20 bg-surface px-3 py-2 text-sm focus-visible:outline-blue resize-y"
      />}
      <div className="mt-2 flex gap-2">
        <button type="button" disabled={singleLine && !draft.trim()} onClick={() => { void onSave(draft,baseline.current).then(updated=>{if(updated)setEditing(false)}) }} className="min-h-9 rounded-lg bg-blue px-3 text-sm text-white hover:bg-action-hover">Save</button>
        <button type="button" onClick={() => { setDraft(value); setEditing(false) }} className="min-h-9 rounded-lg border border-blue px-3 text-sm text-link">Cancel</button>
      </div>
    </div>
  )
}

const zoneLabel = (zone: string) => zone.replaceAll('_', ' ')
const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone
function zoneChoices(current: string) {
 return [...new Set([current, browserZone(), 'UTC', ...Intl.supportedValuesOf('timeZone')])]
}
// The deadline in this person's own timezone, when that differs from the task's.
function yourTime(task: CollabTask) {
 if (!task.dueDate) return ''
 const at = deadlineInstant(task.dueDate, task.dueTime, task.dueZone), local = browserZone()
 if (at === null || !task.dueTime || new Date(at).toLocaleString('en', { timeZone: task.dueZone }) === new Date(at).toLocaleString('en', { timeZone: local })) return ''
 return new Date(at).toLocaleString('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function SharedDetails({task,save,canChangeZone}:{task:CollabTask;canChangeZone:boolean;save:(patch:CollabUpdatePayload)=>Promise<CollabTask | undefined>}){
 const baseline=useRef(task.revision)
 const [zone,setZone]=useState(task.dueZone)
 const [status,setStatus]=useState<'idle'|'saving'|'saved'>('idle')
 useEffect(()=>{if(status!=='saved')return;const timer=setTimeout(()=>setStatus('idle'),2500);return()=>clearTimeout(timer)},[status])
 async function submit(){
  if(status==='saving')return
  setStatus('saving')
  // Fast saves stay on screen briefly so the change is visible.
  const [updated]=await Promise.all([save({revision:baseline.current,title,dueDate:date,dueTime:date?time:'',priority,...(canChangeZone?{dueZone:zone}:{})}),new Promise(resolve=>setTimeout(resolve,600))])
  if(updated)baseline.current=updated.revision
  setStatus(updated?'saved':'idle')
 }
 const [title,setTitle]=useState(task.title),[date,setDate]=useState(task.dueDate),[time,setTime]=useState(task.dueTime),[priority,setPriority]=useState(task.priority)
 const clean=title===task.title && date===task.dueDate && time===task.dueTime && priority===task.priority && zone===task.dueZone
 useEffect(()=>{if(clean)baseline.current=task.revision},[clean,task.revision])
 return <form onSubmit={e=>{e.preventDefault();void submit()}} className="grid gap-3 sm:grid-cols-2"><label className="text-sm sm:col-span-2">Title<input required maxLength={160} value={title} onChange={e=>setTitle(e.target.value)} className="mt-1 min-h-11 w-full rounded border border-dark-blue/20 bg-surface px-3"/></label><label className="text-sm">Due date <span className="text-gray">(optional)</span><input type="date" value={date} onChange={e=>setDate(e.target.value)} className="mt-1 min-h-11 w-full rounded border border-dark-blue/20 bg-surface px-3"/></label><label className="text-sm">Priority<select value={priority} onChange={e=>setPriority(e.target.value as CollabTask['priority'])} className="mt-1 min-h-11 w-full rounded border border-dark-blue/20 bg-surface px-3">{['High','Medium','Low'].map(p=><option key={p}>{p}</option>)}</select></label>{canChangeZone ? <label className="text-sm sm:col-span-2">Deadline timezone<select value={zone} onChange={e=>setZone(e.target.value)} className="mt-1 min-h-11 w-full rounded border border-dark-blue/20 bg-surface px-3">{zoneChoices(task.dueZone).map(value=><option key={value} value={value}>{zoneLabel(value)}</option>)}</select></label> : <p className="text-sm text-gray sm:col-span-2">Deadline timezone: {zoneLabel(task.dueZone)}. Only the owner can change this.</p>}<div className="sm:col-span-2"><TimePicker value={time} onChange={setTime} disabled={!date}/></div><div className="flex items-center gap-3 sm:col-span-2"><button disabled={status==='saving'} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue px-4 text-sm text-white disabled:cursor-not-allowed disabled:opacity-70">{status==='saving' && <ButtonSpinner/>}{status==='saving'?'Saving…':'Save details'}</button><span role="status" className="text-sm text-done-ink">{status==='saved'?'✓ Saved':''}</span></div></form>
}

function SharedResources({files,links,taskId,canEdit,canEditLinks,saving,upload,addLink,removeFile,removeLink}: {
  files:CollabTask['files'];links:CollabTask['links'];taskId:string;canEdit:boolean;canEditLinks:boolean;saving:boolean;
  upload:(files:File[])=>Promise<void>;addLink:(url:string)=>Promise<CollabTask | undefined>;
  removeFile:(id:string)=>Promise<void>;removeLink:(id:string)=>Promise<void>;
}) {
  const [url,setUrl]=useState('')
  return <div className="min-w-0 space-y-3">
    {canEdit && <>
      <label className="inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-blue/30 px-3 text-sm text-link hover:bg-lightest-blue/30 focus-within:outline-2 focus-within:outline-blue">
        Upload file or image
        <input aria-label="Upload file or image" disabled={saving} type="file" multiple accept=".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.webp" className="sr-only" onChange={e=>{void upload(Array.from(e.target.files || []));e.target.value=''}}/>
      </label>
      <p className="text-xs text-gray">PDF, Word, PowerPoint, PNG, JPEG or WebP · 10 MB per file.</p>
    </>}
    {files.map(file=><div key={file.id} className="flex min-w-0 items-center gap-2 rounded-lg border border-dark-blue/15 bg-surface p-2">
      <FileTypeIcon filename={file.name} className="h-8 w-8 shrink-0"/>
      <a href={`/api/collab/tasks/${taskId}/files/${file.id}`} download title={file.name} className="min-w-0 flex-1 truncate text-sm text-link underline">{file.name}</a>
      {canEdit && <button disabled={saving} type="button" aria-label={`Remove ${file.name}`} onClick={()=>void removeFile(file.id)} className="min-h-10 shrink-0 rounded px-2 text-xs text-red hover:bg-light-red/30">Remove</button>}
    </div>)}
    {canEditLinks && <form onSubmit={e=>{e.preventDefault();void addLink(url).then(result=>{if(result)setUrl('')})}} className="flex flex-wrap gap-2">
      <input aria-label="Resource link" type="url" required maxLength={2048} value={url} onChange={e=>setUrl(e.target.value)} placeholder="Paste a link (https://…)" className="min-h-11 min-w-0 flex-1 rounded-lg border border-dark-blue/20 bg-surface px-3 text-sm"/>
      <button disabled={saving || !url.trim()} className="min-h-11 rounded-lg bg-blue px-3 text-sm text-white disabled:opacity-50">Add link</button>
    </form>}
    {links.map(link=><div key={link.id} className="flex min-w-0 items-center gap-2 rounded-lg border border-dark-blue/15 bg-surface p-2">
      <a href={link.url} target="_blank" rel="noreferrer" title={link.url} className="min-w-0 flex-1 truncate text-sm text-link underline">{link.url}</a>
      {canEditLinks && <button disabled={saving} type="button" onClick={()=>void removeLink(link.id)} className="min-h-10 shrink-0 rounded px-2 text-xs text-red hover:bg-light-red/30">Remove</button>}
    </div>)}
    {!files.length && !links.length && <p className="text-sm text-gray">No resources added yet.</p>}
  </div>
}
