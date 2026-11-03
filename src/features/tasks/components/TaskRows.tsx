import { usePlannerClock } from '../../../hooks/usePlannerClock'
import ConfirmTaskDialog from './ConfirmTaskDialog'
import DeadlineLabel from './DeadlineLabel'
import TaskSearchInput from './TaskSearchInput'
import PlannerSelect from '../../../components/ui/PlannerSelect'
import TaskStatusSelect from './TaskStatusSelect'
import TaskSpaceBadge from './TaskSpaceBadge'
import TaskSpaceSelect from './TaskSpaceSelect'
import { useState } from 'react'
import { compareTasks, effectiveDue, groupTasksByDeadline, isDeadlineOverdue, getStatus, matchesDeadline, statusChange } from './taskPresentation'
import type { TaskState } from './taskPresentation'
export type RowTask = TaskState & { id: string | number; title: string; space: string; priority: 'High' | 'Medium' | 'Low'; pinned: boolean; dueDate?: string; dueTime?:string; dueToday?: boolean; steps?: string[]; completedSteps?: number[] }
const field = 'min-h-11 min-w-0 rounded-md border border-dark-blue/20 bg-surface px-3 focus-visible:outline-blue'
export function TaskRow<T extends RowTask>({ task, onOpen, onPin, onStatus, hideDue=false, selected, onSelect }: { selected?:boolean;onSelect?:()=>void; hideDue?:boolean; task: T; onOpen: (task:T) => void; onPin: (task:T) => void; onStatus: (task:T, state:TaskState) => void }) {
  const [stepsOpen, setStepsOpen] = useState(false)
  const now=usePlannerClock()
  const missed=!task.done && isDeadlineOverdue(task,now)
  const showDeadline=!hideDue || !!task.dueTime || !effectiveDue(task)
  const status = getStatus(task)
  return <li className={`rounded-lg border p-3 shadow-sm sm:p-4 ${task.done ? 'border-[#91AE87]/60 bg-light-green' : missed ? 'border-red/50 bg-light-pink/40' : 'border-dark-blue/15 bg-surface'}`}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      {onSelect && <label className="flex h-11 w-8 shrink-0 cursor-pointer items-center justify-center"><input type="checkbox" checked={selected} onChange={onSelect} aria-label={`Select ${task.title} for deletion`} className="h-4 w-4 accent-blue"/></label>}
      <div className="min-w-0 flex-1 basis-44">
        <button type="button" onClick={() => onOpen(task)} aria-haspopup="dialog" title={task.title} className="block w-full truncate text-left text-base font-semibold lg:text-lg hover:underline focus-visible:outline-blue">{task.title}</button>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <TaskSpaceBadge name={task.space} />
          {missed && <span className="rounded-full border border-red/30 bg-light-red px-2 py-1 text-xs font-medium text-red">Deadline missed</span>}
          <span title="Priority" className={`rounded-full px-2 py-1 ${task.priority === 'High' ? 'bg-light-red text-red' : task.priority === 'Medium' ? 'bg-light-orange text-orange' : 'bg-light-gray text-gray'}`}>⚑ {task.priority}</span>
        </div>
        {(showDeadline || !!task.steps?.length) && <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
          {showDeadline && <DeadlineLabel task={task}/>}
          {!!task.steps?.length && <button type="button" aria-expanded={stepsOpen} onClick={() => setStepsOpen(!stepsOpen)} className="text-link underline">{(task.completedSteps ?? []).filter(i => i >= 0 && i < task.steps!.length).length}/{task.steps.length} steps {stepsOpen ? '▴' : '▾'}</button>}
        </div>}
      </div>
      <div className="ml-auto flex flex-wrap items-center justify-end gap-1">
        <TaskStatusSelect value={status} title={task.title} onChange={next=>onStatus(task,statusChange(next))}/>
        <button type="button" onClick={() => onPin(task)} aria-label={`${task.pinned ? 'Unpin' : 'Pin'} ${task.title}`} aria-pressed={task.pinned} className={`h-10 w-10 rounded text-2xl hover:bg-lightest-blue/30 ${task.pinned ? 'text-star' : 'text-gray'}`}>{task.pinned ? '★' : '☆'}</button>
      </div>
    </div>
    {stepsOpen && <ol className="mt-3 space-y-2 border-t border-dark-blue/10 pt-3 text-sm">{task.steps?.map((step,i) => <li key={i} className="flex gap-2"><span aria-label={(task.completedSteps ?? []).includes(i) ? 'Done' : 'To do'}>{(task.completedSteps ?? []).includes(i) ? '✓' : '○'}</span>{step}</li>)}</ol>}
  </li>
}
export default function TaskRows<T extends RowTask>({tasks,onOpen,onPin,onStatus,onAdd,today=false,onDeleteMany}: {onDeleteMany?:(ids:(string|number)[])=>void;today?:boolean;onAdd?:()=>void;tasks:T[];onOpen:(task:T)=>void;onPin:(task:T)=>void;onStatus:(task:T,state:TaskState)=>void}) {
  const [selecting,setSelecting]=useState(false)
  const [selectedIds,setSelectedIds]=useState<(string|number)[]>([])
  const [deleteOpen,setDeleteOpen]=useState(false)
  const [search,setSearch] = useState('')
  const [status,setStatus] = useState('all')
  const [space,setSpace] = useState('all')
  const [priority,setPriority] = useState('all')
  const [deadline,setDeadline] = useState('all')
  const [sort,setSort] = useState('nearest')
  const [missedOpen,setMissedOpen]=useState(true)
  const now=usePlannerClock()
  const [completedOpen,setCompletedOpen] = useState(true)
  const filtered = tasks.filter(t => t.title.toLowerCase().includes(search.trim().toLowerCase()) && (space === 'all' || t.space === space) && (status === 'all' || getStatus(t) === status) && (priority === 'all' || t.priority === priority) && matchesDeadline(t,deadline)).sort((a,b) => compareTasks(a,b,sort))
  const {active,missed,completed}=groupTasksByDeadline(filtered,now)
  const selectable=[...active,...(missedOpen?missed:[]),...(completedOpen?completed:[])]
  const selectedShown=selectable.filter(task=>selectedIds.includes(task.id))
  const row = (task:T) => <TaskRow key={task.id} task={task} onOpen={onOpen} onPin={onPin} onStatus={onStatus} hideDue={today && !isDeadlineOverdue(task,now)} selected={selectedIds.includes(task.id)} onSelect={selecting?()=>setSelectedIds(ids=>ids.includes(task.id)?ids.filter(id=>id!==task.id):[...ids,task.id]):undefined}/>

  return <div>
    {onDeleteMany && tasks.length>0 && <div className="mt-4 flex flex-wrap items-center gap-3 text-sm"><button type="button" onClick={()=>{setSelecting(!selecting);setSelectedIds([])}} aria-pressed={selecting} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-blue bg-lightest-blue px-4 py-2 font-medium text-dark-blue shadow-sm transition-colors hover:bg-blue hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-4 w-4"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="m7 12 3 3 7-7"/></svg>{selecting?'Cancel selection':'Select tasks'}</button>{selecting && <><label className="flex min-h-10 cursor-pointer items-center gap-2"><input type="checkbox" checked={selectable.length>0 && selectedShown.length===selectable.length} onChange={()=>setSelectedIds(selectedShown.length===selectable.length?[]:selectable.map(task=>task.id))} className="accent-blue"/>Select all shown ({selectable.length})</label><button type="button" disabled={!selectedShown.length} onClick={()=>setDeleteOpen(true)} className="min-h-10 rounded-md bg-light-red px-3 text-red disabled:opacity-50">Delete selected ({selectedShown.length})</button></>}</div>}
    {deleteOpen && <ConfirmTaskDialog title={`Delete ${selectedShown.length} selected ${selectedShown.length===1?'task':'tasks'}?`} message="They will move to Recently deleted. You can restore them within 30 days." confirmLabel="Move to Recently deleted" cancelLabel="Cancel" onCancel={()=>setDeleteOpen(false)} onConfirm={()=>{onDeleteMany?.(selectedShown.map(task=>task.id));setDeleteOpen(false);setSelecting(false);setSelectedIds([])}}/>}
    <div className="my-4 mb-5 flex flex-wrap items-center gap-2">
      <TaskSearchInput value={search} onChange={setSearch} />
      <TaskSpaceSelect value={space} onChange={setSpace} all label="Filter by space" className={field}/>
      <PlannerSelect label="Filter by status" value={status} onChange={setStatus} options={[{'value': 'all', 'label': 'All statuses'}, {'value': 'todo', 'label': 'To do'}, {'value': 'progress', 'label': 'In progress'}, {'value': 'done', 'label': 'Done'}, {'value': 'blocked', 'label': 'Blocked'}]}/>
      <PlannerSelect priorityIcons label="Filter by priority" value={priority} onChange={setPriority} options={[{'value': 'all', 'label': 'Any priority'}, {'value': 'High', 'label': 'High'}, {'value': 'Medium', 'label': 'Medium'}, {'value': 'Low', 'label': 'Low'}]}/>
      {!today && <PlannerSelect label="Filter by deadline" value={deadline} onChange={setDeadline} options={[{'value': 'all', 'label': 'Any deadline'}, {'value': 'soon', 'label': 'Due within 3 days'}, {'value': 'week', 'label': 'Due within 7 days'}, {'value': 'overdue', 'label': 'Overdue'}, {'value': 'none', 'label': 'No due date'}]}/>}
      {!today && <PlannerSelect label="Sort tasks" value={sort} onChange={setSort} options={[{'value': 'nearest', 'label': 'Deadline: nearest first'}, {'value': 'farthest', 'label': 'Deadline: farthest first'}, {'value': 'priority', 'label': 'Priority: high to low'}, {'value': 'title', 'label': 'Title: A–Z'}]}/>}
    </div>
    {!tasks.length ? (<div className="my-5 rounded-xl border border-dashed border-dark-blue/20 bg-beige/25 px-5 py-10 text-center"><img src="/images/flower.png" alt="" className="mx-auto mb-3 h-8 w-8 object-contain"/><h3 className="text-xl font-semibold sm:text-2xl">{today ? 'A little room to rest' : 'A little room to begin'}</h3><p className="mx-auto mt-2 max-w-sm text-base text-gray">{today ? 'No tasks to finish here today. Take a breath and enjoy a little rest.' : 'No tasks here yet. Add something you’d like to work on, one step at a time.'}</p>{!today && onAdd && <button onClick={onAdd} className="mt-5 min-h-11 rounded-lg bg-blue px-5 py-2 font-semibold text-white hover:bg-action-hover">+ Add your first task</button>}</div>) : <>
    <h3 className="mb-3 font-semibold">Active tasks ({active.length})</h3><ul className="space-y-3">{active.map(row)}</ul>{!active.length && <p className="py-5 text-sm text-gray">{today && !tasks.some(task=>!task.done) ? 'Nothing left to finish here today. Time for a little rest.' : missed.length ? 'Tasks with past deadlines are listed below.' : 'No active tasks match your filters.'}</p>}
    <section className="mt-6 border-t border-dark-blue/15 pt-4"><h3><button type="button" aria-expanded={missedOpen} onClick={()=>setMissedOpen(!missedOpen)} className="min-h-10 font-semibold text-red">{missedOpen ? '▾' : '▸'} Missed deadlines ({missed.length})</button></h3>{missedOpen && <>{missed.length>0 && <p className="mb-3 text-sm text-gray">Still unfinished after their deadline. You can keep working, change the deadline, or mark them Done.</p>}<ul className="mt-2 space-y-3">{missed.map(row)}</ul>{!missed.length && <p className="py-4 text-sm text-gray">No missed deadlines match your filters.</p>}</>}</section>
    <section className="mt-6 border-t border-dark-blue/15 pt-4"><h3><button type="button" aria-expanded={completedOpen} onClick={()=>setCompletedOpen(!completedOpen)} className="min-h-10 font-semibold">{completedOpen ? '▾' : '▸'} Completed ({completed.length})</button></h3>{completedOpen && <><ul className="mt-2 space-y-3">{completed.map(row)}</ul>{!completed.length && <p className="py-4 text-sm text-gray">Tasks marked Done will appear here.</p>}</>}</section>
    </>}
  </div>
}
