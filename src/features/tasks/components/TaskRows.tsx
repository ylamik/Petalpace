import { usePlannerClock } from '../../../hooks/usePlannerClock'
import ConfirmTaskDialog from './ConfirmTaskDialog'
import DeadlineLabel from './DeadlineLabel'
import TaskFilterBar from './TaskFilters'
import { applyTaskFilters, defaultTaskFilters, toolbarButton } from './taskFilterValues'
import { StepsIcon } from './StepsCount'
import { clickableCard, openFromCard } from './cardClick'
import TaskStatusSelect from './TaskStatusSelect'
import TaskSpaceBadge from './TaskSpaceBadge'
import { useState } from 'react'
import { useSpaces } from '../../spaces/spaces'
import { effectiveDue, groupTasksByDeadline, isDeadlineOverdue, getStatus, statusChange, DONE_PIN_HINT, UNPINNED_ON_DONE } from './taskPresentation'
import type { TaskState } from './taskPresentation'
export type RowTask = TaskState & { id: string | number; title: string; space: string; priority: 'High' | 'Medium' | 'Low'; pinned: boolean; dueDate?: string; dueTime?:string; dueToday?: boolean; steps?: string[]; completedSteps?: number[] }
export function TaskRow<T extends RowTask>({ task, onOpen, onPin, onStatus, hideDue=false, selected, onSelect }: { selected?:boolean;onSelect?:()=>void; hideDue?:boolean; task: T; onOpen: (task:T) => void; onPin: (task:T) => void; onStatus: (task:T, state:TaskState) => void }) {
  const [stepsOpen, setStepsOpen] = useState(false)
  const { notify } = useSpaces()
  const now=usePlannerClock()
  const missed=!task.done && isDeadlineOverdue(task,now)
  const showDeadline=!hideDue || !!task.dueTime || !effectiveDue(task)
  const status = getStatus(task)
  return <li onClick={event => openFromCard(event, () => onOpen(task))} className={`${clickableCard} rounded-lg border p-3 shadow-sm sm:p-4 ${task.done ? 'border-[#91AE87]/60 bg-light-green' : missed ? 'border-red/50 bg-light-pink/40' : 'border-dark-blue/15 bg-surface'}`}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      {onSelect && <label className="flex h-11 w-8 shrink-0 cursor-pointer items-center justify-center"><input type="checkbox" checked={selected} onChange={onSelect} aria-label={`Select ${task.title} for deletion`} className="h-4 w-4 accent-blue"/></label>}
      <div className="min-w-0 flex-1 basis-44">
        <button type="button" onClick={() => onOpen(task)} aria-haspopup="dialog" title={task.title} className="block w-full cursor-pointer truncate text-left font-serif text-base font-semibold group-hover:underline lg:text-lg focus-visible:outline-blue">{task.title}</button>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <TaskSpaceBadge name={task.space} />
          {missed && <span className="rounded-full border border-red/30 bg-light-red px-2 py-1 text-xs font-medium text-red">Deadline missed</span>}
          <span title="Priority" className={`rounded-full px-2 py-1 ${task.priority === 'High' ? 'bg-light-red text-red' : task.priority === 'Medium' ? 'bg-light-orange text-orange' : 'bg-light-gray text-gray'}`}>⚑ {task.priority}</span>
        </div>
        {(showDeadline || !!task.steps?.length) && <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
          {showDeadline && <DeadlineLabel task={task}/>}
          {!!task.steps?.length && (() => { const done = (task.completedSteps ?? []).filter(i => i >= 0 && i < task.steps!.length).length; return <button type="button" aria-expanded={stepsOpen} aria-label={`${done} of ${task.steps.length} steps done. ${stepsOpen ? 'Hide' : 'Show'} steps`} onClick={() => setStepsOpen(!stepsOpen)} className="inline-flex cursor-pointer items-center gap-1.5 rounded text-gray hover:text-dark-blue focus-visible:outline-blue"><StepsIcon />{done}/{task.steps.length}</button> })()}
        </div>}
      </div>
      <div className="ml-auto flex flex-wrap items-center justify-end gap-1">
        <TaskStatusSelect value={status} title={task.title} onChange={next=>{if(task.pinned && !task.done && next==='done')notify(UNPINNED_ON_DONE);onStatus(task,statusChange(next))}}/>
        {task.done
          ? <button type="button" onClick={() => notify(`${DONE_PIN_HINT}. Set the task back to To do to pin it.`)} aria-disabled="true" aria-label={`Pin ${task.title}. ${DONE_PIN_HINT}.`} title={DONE_PIN_HINT} className="h-10 w-10 cursor-not-allowed rounded text-2xl text-gray opacity-40">☆</button>
          : <button type="button" onClick={() => onPin(task)} aria-label={`${task.pinned ? 'Unpin' : 'Pin'} ${task.title}`} aria-pressed={task.pinned} className={`h-10 w-10 rounded text-2xl hover:bg-lightest-blue/30 ${task.pinned ? 'text-star' : 'text-gray'}`}>{task.pinned ? '★' : '☆'}</button>}
      </div>
    </div>
    {stepsOpen && <ol className="mt-3 space-y-2 border-t border-dark-blue/10 pt-3 text-sm">{task.steps?.map((step,i) => <li key={i} className="flex gap-2"><span aria-label={(task.completedSteps ?? []).includes(i) ? 'Done' : 'To do'}>{(task.completedSteps ?? []).includes(i) ? '✓' : '○'}</span>{step}</li>)}</ol>}
  </li>
}
export default function TaskRows<T extends RowTask>({tasks,onOpen,onPin,onStatus,onAdd,today=false,onDeleteMany}: {onDeleteMany?:(ids:(string|number)[])=>void;today?:boolean;onAdd?:()=>void;tasks:T[];onOpen:(task:T)=>void;onPin:(task:T)=>void;onStatus:(task:T,state:TaskState)=>void}) {
  const [selecting,setSelecting]=useState(false)
  const [selectedIds,setSelectedIds]=useState<(string|number)[]>([])
  const [deleteOpen,setDeleteOpen]=useState(false)
  const [filters,setFilters] = useState(defaultTaskFilters)
  const [missedOpen,setMissedOpen]=useState(true)
  const now=usePlannerClock()
  const [completedOpen,setCompletedOpen] = useState(true)
  const filtered = applyTaskFilters(tasks,filters)
  const {active,missed,completed}=groupTasksByDeadline(filtered,now)
  const selectable=[...active,...(missedOpen?missed:[]),...(completedOpen?completed:[])]
  const selectedShown=selectable.filter(task=>selectedIds.includes(task.id))
  const row = (task:T) => <TaskRow key={task.id} task={task} onOpen={onOpen} onPin={onPin} onStatus={onStatus} hideDue={today && !isDeadlineOverdue(task,now)} selected={selectedIds.includes(task.id)} onSelect={selecting?()=>setSelectedIds(ids=>ids.includes(task.id)?ids.filter(id=>id!==task.id):[...ids,task.id]):undefined}/>

  return <div>
    {deleteOpen && <ConfirmTaskDialog title={`Delete ${selectedShown.length} selected ${selectedShown.length===1?'task':'tasks'}?`} message="They will move to Recently deleted. You can restore them within 30 days." confirmLabel="Move to Recently deleted" cancelLabel="Cancel" onCancel={()=>setDeleteOpen(false)} onConfirm={()=>{onDeleteMany?.(selectedShown.map(task=>task.id));setDeleteOpen(false);setSelecting(false);setSelectedIds([])}}/>}
    <TaskFilterBar value={filters} onChange={setFilters} countMatches={next=>applyTaskFilters(tasks,next).length} showDeadline={!today} showSort={!today} actions={onDeleteMany && tasks.length>0 ? <button type="button" onClick={()=>{setSelecting(!selecting);setSelectedIds([])}} aria-pressed={selecting} className={toolbarButton}>{selecting?'Cancel':'Select'}</button> : undefined}/>
    {selecting && <div className="mb-4 flex flex-wrap items-center gap-3 text-sm"><label className="flex min-h-10 cursor-pointer items-center gap-2"><input type="checkbox" checked={selectable.length>0 && selectedShown.length===selectable.length} onChange={()=>setSelectedIds(selectedShown.length===selectable.length?[]:selectable.map(task=>task.id))} className="accent-blue"/>Select all shown ({selectable.length})</label><button type="button" disabled={!selectedShown.length} onClick={()=>setDeleteOpen(true)} className="min-h-10 rounded-md bg-light-red px-3 text-red disabled:opacity-50 hover:bg-light-red/70">Delete selected ({selectedShown.length})</button></div>}
    {!tasks.length ? (<div className="my-5 rounded-xl border border-dashed border-dark-blue/20 bg-beige/25 px-5 py-10 text-center"><img src="/images/flower.png" alt="" className="mx-auto mb-3 h-8 w-8 object-contain"/><h3 className="text-xl font-semibold sm:text-2xl">{today ? 'A little room to rest' : 'A little room to begin'}</h3><p className="mx-auto mt-2 max-w-sm text-base text-gray">{today ? 'No tasks to finish here today. Take a breath and enjoy a little rest.' : 'No tasks here yet. Add something you’d like to work on, one step at a time.'}</p>{!today && onAdd && <button onClick={onAdd} className="mt-5 min-h-11 rounded-lg bg-blue px-5 py-2 font-semibold text-white hover:bg-action-hover">+ Add your first task</button>}</div>) : <>
    <h3 className="mb-3 font-semibold">Active tasks ({active.length})</h3><ul className="space-y-3">{active.map(row)}</ul>{!active.length && <p className="py-5 text-sm text-gray">{today && !tasks.some(task=>!task.done) ? 'Nothing left to finish here today. Time for a little rest.' : missed.length ? 'Tasks with past deadlines are listed below.' : 'No active tasks match your filters.'}</p>}
    <section className="mt-6 border-t border-dark-blue/15 pt-4"><h3><button type="button" aria-expanded={missedOpen} onClick={()=>setMissedOpen(!missedOpen)} className="min-h-10 text-base font-semibold text-red hover:underline">{missedOpen ? '▾' : '▸'} Missed deadlines ({missed.length})</button></h3>{missedOpen && <>{missed.length>0 && <p className="mb-3 text-sm text-gray">Still unfinished after their deadline. You can keep working, change the deadline, or mark them Done.</p>}<ul className="mt-2 space-y-3">{missed.map(row)}</ul>{!missed.length && <p className="py-4 text-sm text-gray">No missed deadlines match your filters.</p>}</>}</section>
    <section className="mt-6 border-t border-dark-blue/15 pt-4"><h3><button type="button" aria-expanded={completedOpen} onClick={()=>setCompletedOpen(!completedOpen)} className="min-h-10 text-base font-semibold hover:underline">{completedOpen ? '▾' : '▸'} Completed ({completed.length})</button></h3>{completedOpen && <><ul className="mt-2 space-y-3">{completed.map(row)}</ul>{!completed.length && <p className="py-4 text-sm text-gray">Tasks marked Done will appear here.</p>}</>}</section>
    </>}
  </div>
}
