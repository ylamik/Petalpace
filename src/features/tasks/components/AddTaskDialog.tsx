import type { TaskFile } from '../taskFiles'
import { taskIdentity, deadlineInstant } from '../deadlineZone'
import TimePicker from './TimePicker'
import PlannerSelect from '../../../components/ui/PlannerSelect'
import TaskSpaceSelect from './TaskSpaceSelect'
import { useSpaces } from '../../spaces/spaces'
import TaskTitleInput from './TaskTitleInput'
import TaskStatusSelect from './TaskStatusSelect'
import FileTypeIcon from '../../../components/ui/FileTypeIcon'
import { ButtonSpinner } from '../../../components/ui/PageLoader'
import { TITLE_LIMIT, validDueTime } from './taskPresentation'
import ConfirmTaskDialog from './ConfirmTaskDialog'
import { getStatus, statusChange } from './taskPresentation'
import { useEffect, useRef, useState, type FormEvent } from 'react'

export type TaskDraft = {
  done?: boolean
  started?: boolean
  blocked?: boolean
  title: string
  space: string
  priority: 'High' | 'Medium' | 'Low'
  dueDate: string
  dueTime?: string
  dueZone?: string
  notes: string
  steps: string[]
  files: TaskFile[]
  links: string[]
  pinned: boolean
}

type Props = {
  defaultDueDate?: string
  initialTitle: string
  initialTask?: TaskDraft
  focusDueDate?: boolean
  defaultSpace?: string
  spaceOptions?: string[]
  canPin: boolean
  onClose: () => void
  onCreate: (task: TaskDraft) => void
}

const field = 'min-h-10 w-full min-w-0 rounded-lg border border-dark-blue/20 bg-surface px-3 py-2 text-base placeholder:text-gray focus:outline-none focus:ring-2 focus:ring-blue/30'

export default function AddTaskDialog({ initialTitle, defaultDueDate = '', initialTask, focusDueDate = false, defaultSpace = '', spaceOptions: providedSpaces, canPin, onClose, onCreate }: Props) {
  const {spaces,tasks,saving}=useSpaces()
  const spaceOptions=providedSpaces ?? spaces.map(s=>s.name)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const dateRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState(initialTask?.title ?? initialTitle)
  const [space, setSpace] = useState<TaskDraft['space'] | ''>(initialTask?.space ?? defaultSpace)
  const [priority, setPriority] = useState<TaskDraft['priority'] | ''>(initialTask?.priority ?? '')
  const [dueDate, setDueDate] = useState(initialTask?.dueDate ?? defaultDueDate)
  const [dueZone] = useState(initialTask?.dueZone || Intl.DateTimeFormat().resolvedOptions().timeZone)
  const [dueTime, setDueTime] = useState(initialTask?.dueTime ?? '')
  const [notes, setNotes] = useState(initialTask?.notes ?? '')
  const [pinned, setPinned] = useState(initialTask?.pinned ?? false)
  const [steps, setSteps] = useState<{ id: string; text: string }[]>(() => (initialTask?.steps ?? []).map((text, index) => ({ id: `initial-${index}`, text })))
  const [files, setFiles] = useState<TaskFile[]>(initialTask?.files ?? [])
  const [links, setLinks] = useState<string[]>(initialTask?.links ?? [])
  const [linkInput, setLinkInput] = useState('')
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [status, setStatus] = useState(() => getStatus({ ...initialTask, done: initialTask?.done ?? false }))
  const [discardOpen, setDiscardOpen] = useState(false)
  const snapshot = JSON.stringify({title,space,priority,dueDate,dueTime,notes,pinned,steps:steps.map(s=>s.text),links,status})
  const [baseline] = useState(snapshot)
  const dirty = snapshot !== baseline || files.length !== (initialTask?.files.length ?? 0) || files.some((f,i)=>f !== initialTask?.files[i]) || !!linkInput.trim()
  function requestClose() { if (dirty) setDiscardOpen(true); else onClose() }
  useEffect(() => {
    if (!dirty) return
    const guard = (event:BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload',guard)
    return () => window.removeEventListener('beforeunload',guard)
  },[dirty])

  useEffect(() => {
    const dialog = dialogRef.current
    const previouslyFocused = document.activeElement
    const previousOverflow = document.body.style.overflow
    dialog?.showModal()
    if (focusDueDate) dateRef.current?.focus()
    else dialog?.querySelector<HTMLInputElement>('input')?.focus()
    document.body.style.overflow = 'hidden'
    return () => {
      dialog?.close()
      document.body.style.overflow = previousOverflow
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus()
    }
  }, [focusDueDate])

  function addFiles(selected: File[]) {
    const valid: File[] = []
    const errors: string[] = []
    for (const file of selected) {
      const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
      if (!['pdf', 'doc', 'docx', 'ppt', 'pptx'].includes(extension)) {
        errors.push(`${file.name}: unsupported file type.`)
      } else if (file.size > 10 * 1024 * 1024) {
        errors.push(`${file.name}: exceeds 10 MB.`)
      } else valid.push(file)
    }
    setFiles((current) => {
      const result = [...current]
      for (const file of valid) {
        if (!result.some((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified)) result.push(file)
      }
      return result
    })
    setError(errors.join(' '))
  }

  function addLink() {
    try {
      const url = new URL(linkInput.trim())
      if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Invalid URL')
      setLinks((current) => current.includes(url.href) ? current : [...current, url.href])
      setLinkInput('')
      setError('')
    } catch {
      setError('Enter a complete link starting with https:// or http://.')
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!title.trim() || Array.from(title.trim()).length > TITLE_LIMIT || !space || !priority) {
      setError('Enter a title, space, and priority.')
      return
    }
    if (!validDueTime(dueTime) || (dueTime && !dueDate)) { setError('Choose a date for your deadline time.'); return }
    if (linkInput.trim()) {
      setError('Click Add link to attach your link, or clear the link field.')
      return
    }
    if (pinned && !canPin) {
      setError('Your top three is full. Turn off pinning to continue.')
      return
    }
    if(dueDate && deadlineInstant(dueDate,dueTime,dueZone)===null){setError('This time does not exist because the clocks change. Choose a different time.');return}
    const identity=taskIdentity({title,space,priority,dueDate,dueTime,dueZone})
    if(tasks.some(t=>t.id!==(initialTask as {id?:string})?.id && taskIdentity({...t,dueZone:t.dueZone || dueZone})===identity)){setError('This task already exists. Change the title, space, priority, or deadline.');return}
    onCreate({ ...statusChange(status), title: title.trim(), space, priority, dueDate, dueTime, dueZone, notes: notes.trim(), pinned,
      steps: steps.map((step) => step.text.trim()).filter(Boolean), files, links })
    onClose()
  }

  return (
    <dialog ref={dialogRef} aria-labelledby="add-task-heading"
      onCancel={(event) => { event.preventDefault(); requestClose() }}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-[580px] overflow-y-auto overscroll-contain rounded-2xl border border-dark-blue/15 bg-surface p-0 font-sans text-dark-blue shadow-2xl backdrop:bg-black/30 backdrop:backdrop-blur-[2px]">
      <form onSubmit={submit} className="p-5 sm:p-7">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 id="add-task-heading" className="text-2xl font-bold">{initialTask ? 'Edit task' : 'Add a task'}</h2>
          <button type="button" onClick={requestClose} aria-label="Close task dialog" className="flex h-10 w-10 items-center justify-center rounded-lg text-2xl hover:bg-beige">×</button>
        </div>
        <div className="space-y-4">
          <TaskTitleInput value={title} onChange={v => { setTitle(v) }}/>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-1 block font-semibold">Space</p>
              <TaskSpaceSelect names={spaceOptions} value={space} onChange={setSpace} required className={field}/>
            </div>
            <div>
              <label htmlFor="task-date" className="mb-1 block font-semibold">Due date <span className="font-normal text-gray">(optional)</span></label>
              <input ref={dateRef} id="task-date" type="date" value={dueDate} onChange={(e) => {setDueDate(e.target.value);if(!e.target.value)setDueTime('')}} className={field} />
            </div>
          </div>
          <p className="text-xs text-gray">Deadline timezone: {dueZone}. This stays the same when you travel.</p><TimePicker value={dueTime} onChange={setDueTime} disabled={!dueDate}/>
          <div className="sm:w-[calc(50%_-_0.5rem)]">
            <p className="mb-1 block font-semibold">Priority</p>
            <PlannerSelect priorityIcons label="Priority" value={priority} onChange={value=>setPriority(value as TaskDraft['priority'])} options={[{value:'',label:'Select priority'},...['High','Medium','Low'].map(value=>({value,label:value}))]}/>
          </div>
          <div>
            <label htmlFor="task-status" className="mb-1 block font-semibold">Status</label>
            <TaskStatusSelect title={title || "New task"} value={status} draft onChange={setStatus}/>
            <p className="mt-1 text-xs text-gray">Blocked means you’re waiting on something before you can continue.</p>
          </div>
          <div>
            <label htmlFor="task-notes" className="mb-1 block font-semibold">Notes</label>
            <textarea id="task-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Type here..." className={`${field} resize-y`} />
          </div>
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">Steps <span className="font-normal text-gray">(optional)</span></h3>
              <label className="flex min-h-10 cursor-pointer items-center gap-2 text-xs">
                <input type="checkbox" role="switch" checked={pinned} disabled={!canPin} onChange={(e) => setPinned(e.target.checked)} className="peer sr-only" />
                <span className="relative h-5 w-10 rounded-full bg-gray/40 peer-checked:bg-blue peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue peer-disabled:opacity-40">
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-surface ${pinned ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                </span>Pin to my top 3
              </label>
            </div>
            {!canPin && <p className="mb-2 text-xs text-gray">Your top three is full. Unpin a task to make room.</p>}
            <div className="space-y-2">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center gap-2">
                  <input aria-label={`Step ${index + 1}`} value={step.text} placeholder="Add a smaller step..." onChange={(e) => setSteps((current) => current.map((item) => item.id === step.id ? { ...item, text: e.target.value } : item))} className={`${field} flex-1`} />
                  <button type="button" aria-label={`Remove step ${index + 1}`} onClick={() => setSteps((current) => current.filter((item) => item.id !== step.id))} className="min-h-10 text-sm text-link hover:underline">Remove</button>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setSteps((current) => [...current, { id: crypto.randomUUID(), text: '' }])} className="mt-2 min-h-10 w-full rounded-lg bg-lightest-blue px-3 py-2 text-left text-link hover:bg-lightest-blue/70">+ Add step</button>
          </div>
          <div>
            <h3 className="mb-2 font-semibold">Files &amp; links <span className="font-normal text-gray">(optional)</span></h3>
            <input ref={fileRef} type="file" multiple accept=".pdf,.doc,.docx,.ppt,.pptx" aria-label="Attach files" className="hidden" onChange={(e) => { addFiles(Array.from(e.target.files ?? [])); e.target.value = '' }} />
            <button type="button" onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(Array.from(e.dataTransfer.files)) }}
              className={`flex min-h-24 w-full items-center justify-center gap-3 rounded-lg border border-dashed p-4 text-left ${dragging ? 'border-blue bg-lightest-blue/40' : 'border-dark-blue/20 bg-page'}`}>
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-10 w-10 shrink-0"><path d="M7 18H5a4 4 0 0 1-1-7.9 8 8 0 0 1 15.6-1.5A5 5 0 0 1 19 18h-2" /><path d="M12 21V11m-4 4 4-4 4 4" /></svg>
              <span><span className="block text-sm">Drop files here or <span className="text-link">browse files</span></span><span className="mt-1 block text-xs text-gray">PDF, DOC, DOCX, PPT, PPTX · up to 10 MB each</span></span>
            </button>
            <div className="mt-3 flex gap-2">
              <input aria-label="Link to attach" inputMode="url" value={linkInput} onChange={(e) => setLinkInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink() } }} placeholder="Paste a link" className={`${field} flex-1`} />
              <button type="button" onClick={addLink} className="shrink-0 rounded-lg bg-blue px-3 text-sm font-semibold text-white hover:bg-action-hover">Add link</button>
            </div>
            <ul className="mt-3 space-y-2">
              {files.map((file, index) => (
                <li key={`${file.name}-${file.size}-${file.lastModified}`} className="flex items-center gap-3 rounded-lg border border-dark-blue/20 px-3 py-2">
                  <FileTypeIcon filename={file.name} className="h-9 w-10" />
                  <div className="min-w-0 flex-1"><p className="break-words text-sm">{file.name}</p><p className="text-xs text-gray">{Math.max(1, Math.round(file.size / 1024))} KB</p></div>
                  <button type="button" aria-label={`Remove ${file.name}`} onClick={() => setFiles((current) => current.filter((_, i) => i !== index))} className="min-h-10 text-xs text-link hover:underline">Remove</button>
                </li>
              ))}
              {links.map((link) => (
                <li key={link} className="flex items-center gap-3 rounded-lg border border-dark-blue/20 px-3 py-2">
                  <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-light-gray/50">
                    <img src="/icons/link.svg" alt="" className="h-4 w-4 object-contain" />
                  </span>
                  <a href={link} target="_blank" rel="noopener noreferrer" title={link} className="min-w-0 flex-1 truncate text-sm text-link underline">{link}</a>
                  <button type="button" aria-label={`Remove link ${link}`} onClick={() => setLinks((current) => current.filter((item) => item !== link))} className="min-h-10 text-xs text-link hover:underline">Remove</button>
                </li>
              ))}
            </ul>
          </div>
          <p role="alert" className={error ? 'text-sm text-red' : 'sr-only'}>{error}</p>
          
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={requestClose} className="min-h-11 rounded-lg border border-blue px-5 font-semibold text-link hover:bg-lightest-blue/30">Cancel</button>
          <button type="submit" disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue px-5 font-semibold text-white hover:bg-action-hover disabled:opacity-70">
            {saving && <ButtonSpinner />}
            {saving ? 'Saving…' : initialTask ? 'Save changes' : 'Create task'}
          </button>
        </div>
      </form>
      {discardOpen && <ConfirmTaskDialog title="Discard unsaved changes?" message="Your edits have not been saved. Close this form and discard them?" confirmLabel="Discard changes" onConfirm={onClose} onCancel={() => setDiscardOpen(false)} />}
    </dialog>
  )
}
