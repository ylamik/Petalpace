import { isStoredFile, storedFileUrl, type TaskFile } from '../taskFiles'
import { taskIdentity, deadlineInstant } from '../deadlineZone'
import TimePicker from './TimePicker'
import PlannerSelect from '../../../components/ui/PlannerSelect'
import TaskSpaceSelect from './TaskSpaceSelect'
import TaskTitleInput from './TaskTitleInput'
import TaskStatusSelect from './TaskStatusSelect'
import TaskSpaceBadge from './TaskSpaceBadge'
import FileTypeIcon from '../../../components/ui/FileTypeIcon'
import { ButtonSpinner } from '../../../components/ui/PageLoader'
import { TITLE_LIMIT, remapCompleted, validDueTime } from './taskPresentation'
import { useSpaces } from '../../spaces/spaces'
import ConfirmTaskDialog from './ConfirmTaskDialog'
import { getStatus, statusChange, UNPINNED_ON_DONE } from './taskPresentation'
import { useEffect, useRef, useState } from 'react'
import type { TaskDraft } from './AddTaskDialog'

type DetailTask = Pick<TaskDraft, 'title' | 'space' | 'priority' | 'pinned'> & Partial<Pick<TaskDraft, 'notes' | 'dueDate' | 'dueTime' | 'dueZone' | 'steps' | 'files' | 'links'>> & {
  done: boolean
  blocked?: boolean
  started?: boolean
  completedSteps?: number[]
  dueToday?: boolean
}
type Props = {
  spaceOptions?: string[]
  task: DetailTask
  onChange: (changes: Partial<DetailTask>) => void
  onClose: () => void
  onDelete: () => void
}
const field = 'mt-1 block min-h-11 w-full min-w-0 rounded border border-dark-blue/20 bg-surface px-3 text-base focus-visible:outline-blue'

function FileDownload({ file }: { file: TaskFile }) {
  const anchorRef = useRef<HTMLAnchorElement>(null)
  useEffect(() => {
    if (isStoredFile(file)) return
    const objectUrl = URL.createObjectURL(file)
    if (anchorRef.current) anchorRef.current.href = objectUrl
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])
  return <a ref={anchorRef} href={isStoredFile(file) ? storedFileUrl(file) : undefined} download={file.name} aria-label={`Download ${file.name}`} className="flex h-11 w-10 shrink-0 items-center justify-center rounded text-link hover:bg-lightest-blue/30 focus-visible:outline-blue">⇩</a>
}

export default function TaskDetailsPanel({ task: originalTask, onChange: commitChanges, onClose, onDelete, spaceOptions: providedSpaces }: Props) {
  const {spaces,tasks,saving,notify}=useSpaces()
  const commit=(changes:DetailTask)=>{if(originalTask.pinned && !originalTask.done && changes.done)notify(UNPINNED_ON_DONE);commitChanges(changes)}
  const spaceOptions=providedSpaces ?? spaces.map(s=>s.name)
  const [editingTitle,setEditingTitle]=useState(false)
  const [task, setTask] = useState(originalTask)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [confirmMove, setConfirmMove] = useState(false)
  const onChange = (changes: Partial<DetailTask>) => setTask(current => ({ ...current, ...changes }))
  function requestClose() { if (dirty) setDiscardOpen(true); else onClose() }
  function saveChanges() {
    if (!task.title.trim() || Array.from(task.title.trim()).length > TITLE_LIMIT) { setEditingTitle(true); setError(`Enter a task title with 1–${TITLE_LIMIT} characters.`); return }
    if (step.trim() || link.trim()) { setError('Add your pending step or link, or clear its input before saving.'); return }
    if (!validDueTime(task.dueTime) || (task.dueTime && !task.dueDate)) {setError('Choose a date for your deadline time.');return}
    if (!spaces.some(space=>space.name===task.space)) { setError('Choose an existing space for this task.'); return }
    const zone=task.dueZone || Intl.DateTimeFormat().resolvedOptions().timeZone
    if(task.dueDate && deadlineInstant(task.dueDate,task.dueTime,zone)===null){setError('Choose a time outside the daylight-saving clock change.');return}
    if(tasks.some(t=>t.id!==(originalTask as {id?:string}).id && taskIdentity({...t,dueZone:t.dueZone || zone})===taskIdentity({...task,dueZone:zone}))){setError('This task already exists. Change the title, space, priority, or deadline.');return}

    if (task.space !== originalTask.space) { setConfirmMove(true); return }
    commit({...task,title:task.title.trim()})
    onClose()
  }
  const dialogRef = useRef<HTMLDialogElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [editingNotes, setEditingNotes] = useState(false)
  const [adding, setAdding] = useState(false)
  const [step, setStep] = useState('')
  const [editingStep, setEditingStep] = useState<{ index: number; text: string } | null>(null)
  const [link, setLink] = useState('')
  const [error, setError] = useState('')
  const [attachmentNotice,setAttachmentNotice] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const dirty = JSON.stringify(task) !== JSON.stringify(originalTask) || (task.files ?? []).some((file, i) => file !== originalTask.files?.[i]) || !!step.trim() || !!link.trim() || !!editingStep
  const steps = task.steps ?? []
  const completed = task.completedSteps ?? []
  const completedCount = steps.filter((_, index) => completed.includes(index)).length

  useEffect(() => {
    const dialog = dialogRef.current
    const previousFocus = document.activeElement
    const overflow = document.body.style.overflow
    dialog?.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      dialog?.close()
      document.body.style.overflow = overflow
      if (previousFocus instanceof HTMLElement) previousFocus.focus()
    }
  }, [])

  useEffect(() => {
    if (!dirty) return
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [dirty])

  function addLink() {
    try {
      const url = new URL(link.trim())
      if (!['https:', 'http:'].includes(url.protocol)) throw new Error()
      onChange({ links: [...new Set([...(task.links ?? []), url.href])] })
      setLink('')
      setError('')
    } catch { setError('Enter a full link starting with https:// or http://.') }
  }

  return (
    <dialog ref={dialogRef} aria-labelledby="task-detail-title" onCancel={event => { event.preventDefault(); requestClose() }}
      onClick={(event) => { if (event.target === event.currentTarget) { const box = event.currentTarget.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) requestClose() } }}
      className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-dvh w-full max-w-[420px] overflow-y-auto border-0 bg-surface p-0 font-sans text-dark-blue shadow-[-8px_0_30px_rgb(0_0_0_/_0.08)] backdrop:bg-black/15">
      <div className="flex min-h-full flex-col px-6 pt-4 sm:px-7">
        <header>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-gray">TASK DETAILS {task.pinned && !task.done && <span className="ml-1 text-dark-blue"><span className="text-star">★</span> In my top 3</span>}</p>
            <button type="button" autoFocus onClick={requestClose} aria-label="Close task details" className="rounded px-3 py-2 text-xl hover:bg-beige">×</button>
          </div>
          <div className="mt-1 flex min-w-0 items-center gap-2">
            <h2 id="task-detail-title" title={task.title} className="min-w-0 flex-1 truncate text-xl font-bold">{task.title || 'Task details'}</h2>
            <button type="button" aria-label="Edit task title" aria-expanded={editingTitle} onClick={()=>setEditingTitle(!editingTitle)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded text-link hover:bg-lightest-blue/40"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5"><path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15v5Z"/></svg></button>
          </div>
          {editingTitle && <div className="mt-2"><TaskTitleInput autoFocus value={task.title} onChange={title=>onChange({title})}/></div>}
          <div className="mt-2"><TaskSpaceBadge name={task.space}/></div>
          <div className="mt-3 flex items-center gap-3 text-sm"><span>Status</span><TaskStatusSelect title={task.title} value={getStatus(task)} draft onChange={status=>onChange(statusChange(status))}/></div>
          <div className="my-5 grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
            <div className="min-w-0 text-sm"><p>Move to space</p><TaskSpaceSelect label="Move to space" names={spaceOptions} value={task.space} onChange={space=>onChange({space})} className={field}/><p className="mt-1 text-xs text-gray">Choose a space, then Save changes.</p></div>
            <div className="min-w-0 text-sm"><p>Priority</p><PlannerSelect priorityIcons label="Priority" value={task.priority} onChange={value=>onChange({priority:value as TaskDraft['priority']})} options={['High','Medium','Low'].map(value=>({value,label:value}))} className="mt-1 w-full"/></div>
            <label className="min-w-0 text-sm min-[360px]:col-span-2">Due date <span className="text-gray">(optional)</span><input type="date" className={field} value={task.dueDate ?? ''} onChange={(event) => { const now = new Date(); const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; onChange({ dueDate: event.target.value, dueToday: event.target.value === today, dueTime: event.target.value ? task.dueTime : '' }) }} /></label>
          </div>
          <div className="mb-5"><p className="text-xs text-gray">Deadline timezone: {task.dueZone || Intl.DateTimeFormat().resolvedOptions().timeZone}</p><TimePicker value={task.dueTime ?? ''} onChange={dueTime=>onChange({dueTime})} disabled={!task.dueDate}/></div>
        </header>
        <section className="border-t border-dark-blue/15 py-4">
          <div className="flex items-center justify-between"><h3 className="font-bold">Notes</h3><button type="button" onClick={() => setEditingNotes(!editingNotes)} className="rounded px-2 py-1 text-xs text-link">{editingNotes ? 'Done' : '✎ Edit'}</button></div>
          {editingNotes ? <textarea aria-label="Task notes" autoFocus value={task.notes ?? ''} onChange={(event) => onChange({ notes: event.target.value })} className={`${field} min-h-28 py-2 text-sm`} /> : <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-snug">{task.notes || 'No notes yet.'}</p>}
        </section>
        <section className="border-t border-dark-blue/15 py-4">
          <div className="flex items-center gap-4"><h3 className="font-bold">Steps</h3><div className="flex-1"><p className="mb-1 text-right text-xs text-gray">{completedCount} of {steps.length} completed</p><progress aria-label="Steps completed" value={completedCount} max={steps.length || 1} className="block h-2.5 w-full overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-[#E5E5E5] [&::-webkit-progress-value]:bg-[#91AE87] [&::-moz-progress-bar]:bg-[#91AE87]" /></div></div>
          <ul className="mt-4 divide-y divide-dark-blue/10">{steps.map((text, index) => {
            // Editing or removing a step keeps the right steps ticked.
            const replaceSteps = (next: string[]) => onChange({ steps: next, completedSteps: remapCompleted(steps, next, completed) })
            if (editingStep?.index === index) return <li key={`${index}-${text}`} className="py-2"><form onSubmit={(event) => { event.preventDefault(); const value = editingStep.text.trim(); if (value) replaceSteps(steps.map((item, i) => i === index ? value : item)); setEditingStep(null) }} className="flex gap-2">
              <input autoFocus aria-label={`Edit step ${index + 1}`} value={editingStep.text} maxLength={500} onChange={(event) => setEditingStep({ index, text: event.target.value })} onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setEditingStep(null) } }} className={`${field} mt-0 flex-1`} />
              <button className="min-h-11 shrink-0 rounded-lg bg-blue px-3 text-xs font-semibold text-white">Save</button>
              <button type="button" onClick={() => setEditingStep(null)} className="min-h-11 shrink-0 rounded-lg px-2 text-xs text-link hover:bg-beige">Cancel</button>
            </form></li>
            return <li key={`${index}-${text}`} className="group flex items-start gap-1 py-1.5">
              <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 py-1.5 text-sm"><input type="checkbox" checked={completed.includes(index)} onChange={() => onChange({ completedSteps: completed.includes(index) ? completed.filter((item) => item !== index) : [...completed, index] })} className="mt-0.5 accent-blue" /><span className={completed.includes(index) ? 'break-words text-gray line-through' : 'break-words'}>{text}</span></label>
              <button type="button" onClick={() => setEditingStep({ index, text })} aria-label={`Edit step: ${text}`} title="Edit step" className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-gray hover:bg-beige hover:text-link focus-visible:outline-blue"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15v5Z" /></svg></button>
              <button type="button" onClick={() => replaceSteps(steps.filter((_, i) => i !== index))} aria-label={`Remove step: ${text}`} title="Remove step" className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-gray hover:bg-light-red/50 hover:text-red focus-visible:outline-blue"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="h-3.5 w-3.5"><path d="m6 6 12 12M18 6 6 18" /></svg></button>
            </li>
          })}</ul>
          <form onSubmit={(event) => { event.preventDefault(); if (step.trim()) { onChange({ steps: [...steps, step.trim()] }); setStep('') } }} className="mt-2 flex gap-2"><input aria-label="New step" placeholder="Add a step…" value={step} onChange={(event) => setStep(event.target.value)} className={`${field} mt-0 flex-1`} /><button disabled={!step.trim()} className="shrink-0 rounded border border-dark-blue/15 px-2 text-xs text-link disabled:opacity-40">+ Add step</button></form>
        </section>
        <section className="py-4">
          <div className="mb-3 flex items-center justify-between"><h3 className="font-bold">Files &amp; links</h3><button type="button" aria-expanded={adding} onClick={() => setAdding(!adding)} className="rounded border border-dark-blue/15 px-2 py-1 text-xs text-link">{adding ? 'Close' : '+ Add'}</button></div>
          {adding && <div className="mb-3 rounded bg-beige/40 p-3">
            <input ref={fileRef} type="file" multiple accept=".pdf,.doc,.docx,.ppt,.pptx" className="hidden" onChange={(event) => { const files = Array.from(event.target.files ?? []); const valid = files.filter((file) => /\.(pdf|docx?|pptx?)$/i.test(file.name) && file.size <= 10 * 1024 * 1024); setError(valid.length !== files.length ? 'Use PDF, Word or PowerPoint files up to 10 MB each.' : ''); const existing = task.files ?? []; onChange({ files: [...existing, ...valid.filter((file) => !existing.some((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified))] }); event.target.value = '' }} />
            <button type="button" onClick={() => fileRef.current?.click()} className="rounded border border-blue/20 bg-surface px-3 py-2 text-sm text-link">Upload files</button>
            <form onSubmit={(event) => { event.preventDefault(); addLink() }} className="mt-2 flex gap-2"><input type="url" required aria-label="Link URL" placeholder="https://…" value={link} onChange={(event) => setLink(event.target.value)} className={`${field} mt-0 flex-1`} /><button className="rounded bg-blue px-2 text-xs text-white">Add link</button></form>
          </div>}
          {error && <p role="alert" className="mb-2 text-xs text-red">{error}</p>}
          <p className="mb-3 text-xs text-gray">File and link changes apply when you click Save changes.</p>
          <p role="status" aria-live="polite" className={attachmentNotice ? 'mb-3 rounded bg-lightest-blue/30 p-2 text-xs text-link' : 'sr-only'}>{attachmentNotice}</p>
          <ul className="space-y-2">
            {(task.files ?? []).map((file, index) => (
              <li key={`${file.name}-${file.size}-${file.lastModified}`} className="flex min-w-0 flex-wrap items-center gap-2 rounded-lg border border-dark-blue/20 bg-surface p-2">
                <FileTypeIcon filename={file.name} />
                <span title={file.name} className="min-w-0 flex-1 truncate text-xs">{file.name}</span>
                <div className="ml-auto flex shrink-0 items-center gap-1">
                  <FileDownload file={file} />
                  <button type="button" aria-label={`Remove file ${file.name}`} onClick={() => {
                    onChange({files:(task.files ?? []).filter((_,i)=>i!==index)})
                    setAttachmentNotice('File removed from this draft. Save changes to apply, or Cancel to discard your edits.')
                  }} className="min-h-11 rounded px-2 text-xs text-red hover:bg-light-red/40 focus-visible:outline-red">Remove</button>
                </div>
              </li>
            ))}
            {(task.links ?? []).map((url,index) => (
              <li key={`${url}-${index}`} className="flex min-w-0 flex-wrap items-center gap-2 rounded-lg border border-dark-blue/20 bg-surface p-2">
                <span aria-hidden="true" className="flex h-9 w-10 shrink-0 items-center justify-center rounded bg-light-gray/50">
                  <img src="/icons/link.svg" alt="" className="h-4 w-4 object-contain" />
                </span>
                <span title={url} className="min-w-0 flex-1 truncate text-xs">{url}</span>
                <div className="ml-auto flex shrink-0 items-center gap-1">
                  <a href={/^https?:\/\//i.test(url) ? url : undefined} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded px-2 text-xs text-link hover:bg-lightest-blue/30 focus-visible:outline-blue">Open<span className="sr-only"> {url}</span></a>
                  <button type="button" aria-label={`Remove link ${url}`} onClick={() => {
                    onChange({links:(task.links ?? []).filter((_,i)=>i!==index)})
                    setAttachmentNotice('Link removed from this draft. Save changes to apply, or Cancel to discard your edits.')
                  }} className="min-h-11 rounded px-2 text-xs text-red hover:bg-light-red/40 focus-visible:outline-red">Remove</button>
                </div>
              </li>
            ))}
          </ul>
          {!task.files?.length && !task.links?.length && <p className="text-xs text-gray">No files or links yet.</p>}
        </section>
        <footer className="sticky bottom-0 mt-auto border-t border-dark-blue/15 bg-surface py-4">
          <p className="mb-2 text-xs text-gray">{saving ? 'Saving your changes…' : dirty ? 'Unsaved changes' : 'Changes are saved only when you choose Save changes.'}</p>
          
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button type="button" onClick={() => setConfirmDelete(true)} className="min-h-11 rounded px-2 text-sm text-red">Delete task</button>
            <button type="button" onClick={requestClose} className="min-h-11 rounded border border-blue px-3 text-sm text-link">Cancel</button>
            <button type="button" onClick={saveChanges} disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded bg-blue px-4 text-sm text-white disabled:opacity-70">
              {saving && <ButtonSpinner />}
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </footer>
      </div>
      {confirmMove && <ConfirmTaskDialog title={`Move task to ${task.space}?`} message={`This task will leave ${originalTask.space} and appear in ${task.space}. Its notes, steps, files, deadline, and status are kept. Your other edits will also be saved.`} confirmLabel="Move and save" cancelLabel="Keep editing" destructive={false} onCancel={()=>setConfirmMove(false)} onConfirm={()=>{commit({...task,title:task.title.trim()});setConfirmMove(false);onClose()}}/>}
      {discardOpen && <ConfirmTaskDialog title="Discard unsaved changes?" message="Your changes have not been saved. Leave this task and discard them?" confirmLabel="Discard changes" onCancel={() => setDiscardOpen(false)} onConfirm={onClose} />}
      {confirmDelete && <ConfirmTaskDialog title="Delete this task?" message={`This task and its attachments will move to Recently deleted. You can restore them within 30 days.`} confirmLabel="Move to Recently deleted" cancelLabel="Keep task" onCancel={() => setConfirmDelete(false)} onConfirm={onDelete} />}
    </dialog>
  )
}
