import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import PlannerSelect from '../../../components/ui/PlannerSelect'
import { useSpaces } from '../../spaces/spaces'
import { toolbarButton, type TaskFilterValues } from './taskFilterValues'

const statusChoices = [{ value: 'todo', label: 'To do' }, { value: 'progress', label: 'In progress' }, { value: 'blocked', label: 'Blocked' }, { value: 'done', label: 'Done' }]
const priorityChoices = ['High', 'Medium', 'Low'].map(value => ({ value, label: value }))
const deadlineChoices = [{ value: 'all', label: 'Any time' }, { value: 'overdue', label: 'Overdue' }, { value: 'week', label: 'Next 7 days' }, { value: 'month', label: 'Next 30 days' }, { value: 'none', label: 'No date' }]
const sortChoices = [{ value: 'nearest', label: 'Nearest deadline' }, { value: 'farthest', label: 'Farthest deadline' }, { value: 'priority', label: 'Highest priority' }, { value: 'title', label: 'Title A–Z' }]

function Chip({ active, color, children, onClick }: { active: boolean; color?: string; children: ReactNode; onClick: () => void }) {
  return <button type="button" aria-pressed={active} onClick={onClick} className={`inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue ${active ? 'border-blue bg-nav-active font-semibold' : 'border-dark-blue/15 hover:bg-beige'}`}>
    {color && <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />}
    {children}
  </button>
}

function ChipGroup({ label, children }: { label: string; children: ReactNode }) {
  return <div role="group" aria-label={label}>
    <p className="mb-2 text-sm font-medium text-gray">{label}</p>
    <div className="flex flex-wrap gap-1.5">{children}</div>
  </div>
}

type TaskFilterBarProps = {
  value: TaskFilterValues
  onChange: (value: TaskFilterValues) => void
  countMatches: (filters: TaskFilterValues) => number
  searchLabel?: string
  showDeadline?: boolean
  showSort?: boolean
  actions?: ReactNode
}

export default function TaskFilterBar({ value, onChange, countMatches, searchLabel = 'Search tasks', showDeadline = true, showSort = true, actions }: TaskFilterBarProps) {
  const { spaces } = useSpaces()
  const [open, setOpen] = useState(false)
  // Chip changes stay here until "Show tasks". Closing the panel any other way discards them.
  const [draft, setDraft] = useState(value)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const activeCount = value.spaces.length + value.statuses.length + value.priorities.length + (value.deadline === 'all' ? 0 : 1)

  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => { if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus() } }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) }
  }, [open])

  function toggle(key: 'spaces' | 'statuses' | 'priorities', item: string) {
    const list = draft[key]
    setDraft({ ...draft, [key]: list.includes(item) ? list.filter(entry => entry !== item) : [...list, item] })
  }
  function openPanel() {
    if (!open) setDraft(value)
    setOpen(current => !current)
  }
  function apply() {
    onChange({ ...value, spaces: draft.spaces, statuses: draft.statuses, priorities: draft.priorities, deadline: draft.deadline })
    setOpen(false)
    trigger.current?.focus()
  }
  const draftMatches = countMatches({ ...value, spaces: draft.spaces, statuses: draft.statuses, priorities: draft.priorities, deadline: draft.deadline })

  return <div ref={root} className="relative my-4 flex flex-wrap items-center gap-2">
    <label className="flex h-11 min-w-48 flex-1 basis-56 items-center gap-2 rounded-xl border border-dark-blue/15 bg-surface px-3 text-gray focus-within:ring-2 focus-within:ring-blue/30">
      <svg aria-hidden="true" className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
      <input type="search" aria-label={searchLabel} placeholder="Search tasks" value={value.search} onChange={event => onChange({ ...value, search: event.target.value })} className="h-full w-full min-w-0 bg-transparent text-[0.9375rem] text-dark-blue outline-none placeholder:text-gray" />
    </label>
    <button ref={trigger} type="button" aria-expanded={open} aria-controls={panelId} onClick={openPanel} className={`${toolbarButton} ${open ? 'border-blue bg-nav-active' : ''}`}>
      <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 7h16M7 12h10M10 17h4" /></svg>
      Filter
      {activeCount > 0 && <span className="rounded-full bg-blue px-1.5 text-xs text-white">{activeCount}<span className="sr-only"> active</span></span>}
    </button>
    {showSort && <PlannerSelect label="Sort tasks" prefix="Sort" value={value.sort} onChange={sort => onChange({ ...value, sort })} options={sortChoices} className="rounded-xl! border-dark-blue/15!" />}
    {actions}
    {open && <div id={panelId} className="absolute inset-x-0 top-full z-30 mt-2 space-y-4 rounded-2xl border border-dark-blue/10 bg-surface p-5 text-dark-blue shadow-[0_8px_30px_rgb(0_0_0_/_0.14)]">
      <ChipGroup label="Space">{spaces.map(space => <Chip key={space.id} color={space.color} active={draft.spaces.includes(space.name)} onClick={() => toggle('spaces', space.name)}>{space.name}</Chip>)}</ChipGroup>
      <ChipGroup label="Status">{statusChoices.map(choice => <Chip key={choice.value} active={draft.statuses.includes(choice.value)} onClick={() => toggle('statuses', choice.value)}>{choice.label}</Chip>)}</ChipGroup>
      <ChipGroup label="Priority">{priorityChoices.map(choice => <Chip key={choice.value} active={draft.priorities.includes(choice.value)} onClick={() => toggle('priorities', choice.value)}>{choice.label}</Chip>)}</ChipGroup>
      {showDeadline && <ChipGroup label="Deadline">{deadlineChoices.map(choice => <Chip key={choice.value} active={draft.deadline === choice.value} onClick={() => setDraft({ ...draft, deadline: choice.value })}>{choice.label}</Chip>)}</ChipGroup>}
      <div className="flex items-center justify-between gap-3 border-t border-dark-blue/10 pt-4">
        <button type="button" onClick={() => setDraft({ ...draft, spaces: [], statuses: [], priorities: [], deadline: 'all' })} className="min-h-10 cursor-pointer rounded-lg px-1 text-sm font-medium hover:text-link">Clear all</button>
        <button type="button" onClick={apply} className="min-h-10 cursor-pointer rounded-lg bg-blue px-4 text-sm font-semibold text-white hover:bg-action-hover">Show {draftMatches} {draftMatches === 1 ? 'task' : 'tasks'}</button>
      </div>
    </div>}
  </div>
}
