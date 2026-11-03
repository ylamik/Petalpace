import { usePlannerClock } from '../hooks/usePlannerClock'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSpaces, type SpaceTask } from '../features/spaces/spaces'
import ProfileMenu from '../components/auth/ProfileMenu'
import AddTaskDialog, { type TaskDraft } from '../features/tasks/components/AddTaskDialog'
import TaskDetailsPanel from '../features/tasks/components/TaskDetailsPanel'
import { deadlineText, getStatus } from '../features/tasks/components/taskPresentation'
import { calendarDate, dateKey, indexCalendarTasks, monthDates, moveCalendar, parseCalendarDate, weekDates, type CalendarView } from '../features/tasks/calendarDates'

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const statusNames = {todo: 'To do', progress: 'In progress', done: 'Done', blocked: 'Blocked'}
const control = 'min-h-11 cursor-pointer rounded-lg border border-dark-blue/20 bg-surface px-3 py-2 text-sm font-medium hover:bg-lightest-blue/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue disabled:cursor-not-allowed disabled:opacity-40'
const fullDate = (date: Date) => date.toLocaleDateString('en-US', {weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'})

function CalendarTask({task, color, onOpen}: {task: SpaceTask; color?: string; onOpen: () => void}) {
  const id = useId()
  const ref = useRef<HTMLButtonElement>(null)
  const [tooltip, setTooltip] = useState<{left: number; top: number; width: number} | null>(null)
  function show() {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    const width = Math.min(280, window.innerWidth - 24)
    setTooltip({left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)), top: Math.max(12, Math.min(rect.bottom + 6, window.innerHeight - 190)), width})
  }
  useEffect(() => {
    if (!tooltip) return
    const close = () => setTooltip(null)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close)}
  }, [tooltip])
  const status = getStatus(task)
  return <>
    <button ref={ref} type="button" onClick={()=>{setTooltip(null);onOpen()}} onMouseEnter={show} onMouseLeave={()=>setTooltip(null)} onFocus={show} onBlur={()=>setTooltip(null)} onKeyDown={event=>{if(event.key==='Escape')setTooltip(null)}} aria-describedby={tooltip ? id : undefined} aria-label={`${task.title}. ${statusNames[status]}. ${deadlineText(task)}`} className={`flex min-h-9 w-full min-w-0 cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1.5 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue ${task.done ? 'border-done-stroke/40 bg-done-card text-done-ink hover:bg-done-hover' : 'border-blue/20 bg-lightest-blue/40 hover:bg-lightest-blue'}`}>
      <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full border border-dark-blue/30" style={{backgroundColor:color || '#CCDBEF'}} />
      <span className={`min-w-0 flex-1 truncate ${task.done ? 'line-through' : ''}`}>{task.title}</span>
      {task.done && <span aria-hidden="true" className="shrink-0">✓</span>}
    </button>
    {tooltip && createPortal(<div id={id} role="tooltip" className="pointer-events-none fixed z-50 rounded-lg border border-dark-blue/20 bg-surface p-3 font-serif text-sm text-dark-blue shadow-lg" style={tooltip}><p className="break-words font-semibold">{task.title}</p><p className="mt-1">{statusNames[status]} · {deadlineText(task)}</p><p className="mt-1 break-words">{task.space}</p></div>,document.body)}
  </>
}

export default function CalendarPage() {
  const {tasks, spaces, setTasks} = useSpaces()
  const [anchor, setAnchor] = useState(()=>new Date())
  const [view, setView] = useState<CalendarView>('month')
  const now = usePlannerClock()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [addingDate, setAddingDate] = useState<string | null>(null)
  const today = dateKey(now)
  const {byDate, undated} = useMemo(()=>indexCalendarTasks(tasks.map(task=>({...task,dueDate:task.dueDate || (task.dueToday ? today : '')}))),[tasks, today])
  const selected = tasks.find(task=>task.id===selectedId)
  const dates = view==='week' ? weekDates(anchor) : monthDates(anchor)
  const previous = moveCalendar(anchor,view,-1), next = moveCalendar(anchor,view,1)
  const title = view==='year' ? String(anchor.getFullYear()) : view==='day' ? fullDate(anchor) : view==='week' ? `${dates[0].toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})} – ${dates[6].toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}` : anchor.toLocaleDateString('en-US',{month:'long',year:'numeric'})
  function openDay(date: Date) {setAnchor(date);setView('day')}
  function saveTask(draft: TaskDraft) {
    setTasks(current=>[...current,{...draft,id:crypto.randomUUID(),spaceId:'',done:draft.done ?? false,completedSteps:[]}])
  }
  function taskButton(task: SpaceTask) {
    return <CalendarTask key={task.id} task={task} color={spaces.find(space=>space.id===task.spaceId)?.color} onOpen={()=>setSelectedId(task.id)} />
  }
  function dayCell(date: Date) {
    const key=dateKey(date), dayTasks=byDate.get(key) ?? []
    const currentMonth=date.getMonth()===anchor.getMonth()
    const valid=!!parseCalendarDate(key)
    return <section key={key} aria-label={fullDate(date)} className={`min-w-0 min-h-40 border-b border-r border-dark-blue/25 p-2 ${!currentMonth && view==='month' ? 'bg-beige/25' : 'bg-surface'}`}>
      <div className="mb-2 flex items-center justify-between gap-1"><button disabled={!valid} type="button" onClick={()=>openDay(date)} aria-label={`View ${fullDate(date)}, ${dayTasks.length} tasks`} aria-current={key===today?'date':undefined} className={`flex h-9 min-w-9 cursor-pointer items-center justify-center rounded-full px-1 text-sm font-medium focus-visible:outline-2 focus-visible:outline-blue ${key===today?'bg-blue text-white':'hover:bg-lightest-blue/60'}`}>{date.getDate()}</button><button disabled={!valid} type="button" onClick={()=>setAddingDate(key)} aria-label={`Add task due ${fullDate(date)}`} className="flex h-9 w-8 cursor-pointer items-center justify-center rounded-md text-lg text-link hover:bg-lightest-blue/50">+</button></div>
      <div className="space-y-1.5">{dayTasks.slice(0,3).map(taskButton)}</div>
      {dayTasks.length>3 && <button type="button" onClick={()=>openDay(date)} className="mt-2 min-h-9 w-full cursor-pointer rounded text-left text-xs font-medium text-link underline hover:bg-lightest-blue/30">+{dayTasks.length-3} more tasks</button>}
    </section>
  }
  const dayTasks = byDate.get(dateKey(anchor)) ?? []
  return <div className="min-w-0 text-dark-blue">
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div><div className="flex items-center gap-3"><img src="/icons/calendar-icon.png" alt="" className="h-8 w-8 object-contain"/><h1 className="text-3xl font-bold">Calendar</h1></div><p className="mt-2 text-base text-gray">A little space for every deadline.</p></div>
      <div className="flex items-center gap-3"><button type="button" onClick={()=>setAddingDate(dateKey(anchor))} className="min-h-11 cursor-pointer rounded-lg bg-blue px-4 py-2 text-base font-semibold text-white hover:bg-action-hover">+ Add task</button><div className="hidden lg:block"><ProfileMenu/></div></div>
    </header>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div role="group" aria-label="Calendar view" className="flex max-w-full flex-wrap gap-1 rounded-xl border border-dark-blue/15 bg-beige/40 p-1">{(['month','week','day','year'] as const).map(option=><button key={option} type="button" aria-pressed={view===option} onClick={()=>setView(option)} className={`min-h-11 cursor-pointer rounded-lg px-3 text-sm font-medium capitalize focus-visible:outline-2 focus-visible:outline-blue ${view===option?'bg-blue text-white shadow-sm':'hover:bg-lightest-blue/50'}`}>{option}</button>)}</div>
      <label className="flex min-w-0 items-center gap-2 text-sm">Go to date<input type="date" min="0001-01-01" max="9999-12-31" value={dateKey(anchor)} onChange={event=>{const date=parseCalendarDate(event.target.value);if(date)setAnchor(date)}} className="min-h-11 min-w-0 rounded-lg border border-dark-blue/20 bg-surface px-2 text-base"/></label>
    </div>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 aria-live="polite" className="min-w-0 text-xl font-semibold sm:text-2xl">{title}</h2>
      <div className="flex items-center gap-2"><button type="button" disabled={!parseCalendarDate(dateKey(previous))} aria-label={`Previous ${view}`} onClick={()=>setAnchor(previous)} className={control}>‹</button><button type="button" onClick={()=>setAnchor(new Date())} className={control}>Today</button><button type="button" disabled={!parseCalendarDate(dateKey(next))} aria-label={`Next ${view}`} onClick={()=>setAnchor(next)} className={control}>›</button></div>
    </div>
    <p className="mb-3 text-sm text-gray">Tasks appear on their due dates. Green, crossed-out titles are done. Select a task to view or edit it.</p>
    {view==='month' && <>
      <p className="mb-2 text-xs text-gray sm:hidden">Swipe across the calendar, or choose Day for a full-width list.</p>
      <div tabIndex={0} role="region" aria-label={`${view} calendar, scroll horizontally on small screens`} className="overflow-x-auto rounded-xl border border-dark-blue/20 shadow-sm focus-visible:outline-2 focus-visible:outline-blue">
        <div className="min-w-[630px]"><div className="grid grid-cols-7 border-b border-dark-blue/25 bg-beige/70">{weekdays.map(day=><div key={day} className="py-3 text-center text-sm font-medium">{day}</div>)}</div><div className="grid grid-cols-7">{dates.map(date=>dayCell(date))}</div></div>
      </div>
    </>}
    {view==='week' && <section aria-label="Weekly summary" className="space-y-3">
      <div className="rounded-xl border border-blue/20 bg-lightest-blue/30 px-4 py-3 text-base"><span className="font-semibold">Your week at a glance</span><p className="mt-1 text-sm text-gray">{dates.reduce((sum,date)=>sum+(byDate.get(dateKey(date))?.length ?? 0),0)} tasks scheduled · {dates.reduce((sum,date)=>sum+(byDate.get(dateKey(date))?.filter(task=>task.done).length ?? 0),0)} completed</p></div>
      {dates.filter(date=>parseCalendarDate(dateKey(date))).map(date=>{
        const key=dateKey(date), list=byDate.get(key) ?? []
        return <section key={key} className={`rounded-xl border p-4 shadow-sm ${key===today?'border-blue/50 bg-lightest-blue/10':'border-dark-blue/15 bg-surface'}`}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><button type="button" onClick={()=>openDay(date)} className="cursor-pointer rounded text-left text-lg font-semibold hover:text-link">{date.toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'})}{key===today && <span className="ml-2 rounded-full bg-blue px-2 py-1 align-middle text-xs font-medium text-white">Today</span>}</button><button type="button" onClick={()=>setAddingDate(key)} className="min-h-11 cursor-pointer rounded-lg px-3 text-sm font-medium text-link hover:bg-lightest-blue/50">+ Add task</button></div>
          {list.length ? <div className="space-y-2">{list.map(task=><div key={task.id}>{taskButton(task)}<p className="mt-1 px-2 text-sm text-gray">{deadlineText(task)} · {statusNames[getStatus(task)]}</p></div>)}</div> : <p className="text-sm text-gray">Nothing due. Room to breathe.</p>}
        </section>
      })}
    </section>}
    {view==='day' && <section className="rounded-xl border border-dark-blue/20 bg-surface p-4 shadow-sm sm:p-6"><h3 className="mb-3 text-lg font-semibold">{dayTasks.length} {dayTasks.length===1?'task':'tasks'} due</h3>{dayTasks.length ? <div className="space-y-3">{dayTasks.map(task=><div key={task.id}>{taskButton(task)}<p className="mt-1 px-2 text-sm text-gray">{deadlineText(task)} · {statusNames[getStatus(task)]}</p></div>)}</div> : <p className="rounded-lg bg-beige/30 p-6 text-center text-base text-gray">Nothing due on this day. A little room to breathe.</p>}</section>}
    {view==='year' && <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 xl:grid-cols-3">{Array.from({length:12},(_,month)=>{
      const start=calendarDate(anchor.getFullYear(),month)
      const monthKey=dateKey(start).slice(0,7)
      const count=[...byDate.entries()].filter(([key])=>key.startsWith(monthKey)).reduce((sum,[,list])=>sum+list.length,0)
      return <section key={month} className="min-w-0 rounded-xl border border-dark-blue/15 bg-surface p-3 shadow-sm"><button type="button" onClick={()=>{setAnchor(start);setView('month')}} className="mb-2 flex min-h-11 w-full cursor-pointer items-center justify-between rounded-lg px-2 text-left hover:bg-lightest-blue/40"><span className="text-lg font-semibold">{start.toLocaleDateString('en-US',{month:'long'})}</span><span className="text-xs text-gray">{count} tasks</span></button><div className="grid grid-cols-7 text-center">{weekdays.map(day=><span key={day} className="py-1 text-xs text-gray">{day[0]}</span>)}{monthDates(start).map(date=>{
        const key=dateKey(date), list=byDate.get(key) ?? [], inMonth=date.getMonth()===month
        return inMonth ? <button key={key} type="button" aria-label={`${fullDate(date)}, ${list.length} tasks`} aria-current={key===today?'date':undefined} onClick={()=>openDay(date)} className={`relative flex min-h-9 min-w-0 cursor-pointer flex-col items-center justify-center rounded-md text-sm focus-visible:outline-2 focus-visible:outline-blue ${key===today?'bg-blue text-white':'hover:bg-lightest-blue/50'}`}>{date.getDate()}{list.length>0 && <span aria-hidden="true" className={`h-1 w-1 rounded-full ${key===today?'bg-white':list.every(task=>task.done)?'bg-[#53744C]':'bg-blue'}`}/>}</button> : <span key={key}/>
      })}</div></section>
    })}</div>}
    {undated.length>0 && <details className="mt-6 rounded-xl border border-dark-blue/15 bg-beige/20 p-4"><summary className="cursor-pointer text-base font-semibold">No due date ({undated.length})</summary><p className="my-3 text-sm text-gray">Open a task and save a due date to place it on the calendar.</p><div className="grid min-w-0 gap-2 sm:grid-cols-2">{undated.map(taskButton)}</div></details>}
    {selected && <TaskDetailsPanel key={selected.id} task={selected} onClose={()=>setSelectedId(null)} onChange={changes=>setTasks(current=>current.map(task=>task.id===selected.id?{...task,...changes}:task))} onDelete={()=>{setTasks(current=>current.filter(task=>task.id!==selected.id));setSelectedId(null)}}/>}
    {addingDate!==null && <AddTaskDialog initialTitle="" defaultDueDate={addingDate} canPin={tasks.filter(task=>task.pinned).length<3} onClose={()=>setAddingDate(null)} onCreate={saveTask}/>}
  </div>
}
