import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../../auth/auth'
import { useSpaces } from '../../spaces/spaces'
import { needsTaskReminder, isDeadlineOverdue, compareTasks, effectiveDue, taskDaysUntil } from './taskPresentation'
import type { SpaceTask } from '../../spaces/spaces'

// A short, friendly deadline: "Due tomorrow · 7:00 PM" or "Overdue · was due Nov 4".
function dueLine(task: SpaceTask, now: Date) {
  const date = effectiveDue(task), days = taskDaysUntil(task, now) ?? 0
  const time = task.dueTime ? new Date(`2000-01-01T${task.dueTime}:00`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''
  const day = new Date(`${date}T12:00:00`).toLocaleDateString('en-US', days > 1 && days < 7 ? { weekday: 'long' } : { month: 'short', day: 'numeric' })
  const zone = task.dueZone && task.dueZone !== Intl.DateTimeFormat().resolvedOptions().timeZone ? ` (${task.dueZone.replaceAll('_', ' ')})` : ''
  if (isDeadlineOverdue(task, now)) return `Overdue · was due ${days === 0 ? 'today' : day}${time ? ` at ${time}` : ''}${zone}`
  return `Due ${days === 0 ? 'today' : days === 1 ? 'tomorrow' : day}${time ? ` · ${time}` : ''}${zone}`
}

function ReminderDialog({onClose}:{onClose:()=>void}) {
  const ref=useRef<HTMLDialogElement>(null)
  const {tasks,setTasks,spaces}=useSpaces()
  const now=new Date()
  const list=tasks.filter(task=>needsTaskReminder(task)).sort((a,b)=>compareTasks(a,b,'nearest'))
  const overdue=list.filter(task=>isDeadlineOverdue(task,now)), soon=list.filter(task=>!isDeadlineOverdue(task,now))
  useEffect(()=>{const element=ref.current;const previous=document.activeElement;element?.showModal();return()=>{element?.close();if(previous instanceof HTMLElement && previous.isConnected)previous.focus()}},[])
  const start=(task:SpaceTask)=>setTasks(current=>current.map(item=>item.id===task.id?{...item,started:true,done:false,blocked:false}:item))
  const row=(task:SpaceTask,late:boolean)=><li key={task.id} className="flex items-center gap-3 px-4 py-3">
    <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{backgroundColor:spaces.find(space=>space.id===task.spaceId)?.color ?? 'var(--color-blue)'}}/>
    <span className="min-w-0 flex-1">
      <span title={task.title} className="block truncate font-serif text-base font-semibold">{task.title}</span>
      <span className={`block text-sm ${late?'text-red':'text-gray'}`}>{dueLine(task,now)}<span className="text-gray"> · {task.space}</span></span>
    </span>
    <button type="button" onClick={()=>start(task)} aria-label={`Start ${task.title}`} className="min-h-9 shrink-0 cursor-pointer rounded-lg border border-blue/40 px-3 text-sm font-semibold text-link hover:bg-nav-active focus-visible:outline-2 focus-visible:outline-blue">Start</button>
  </li>
  const group=(label:string,items:SpaceTask[],late:boolean)=>items.length>0 && <section className="mt-4">
    <h3 className={`mb-2 flex items-center gap-2 font-sans text-sm font-semibold ${late?'text-red':'text-gray'}`}>{label}<span className="rounded-full bg-beige px-2 text-xs font-medium text-gray">{items.length}</span></h3>
    <ul className={`divide-y overflow-hidden rounded-xl border ${late?'divide-red/15 border-red/25 bg-light-pink/40':'divide-dark-blue/10 border-dark-blue/10 bg-surface'}`}>{items.map(task=>row(task,late))}</ul>
  </section>
  return <dialog ref={ref} aria-labelledby="reminder-title" onCancel={event=>{event.preventDefault();onClose()}} className="fixed inset-0 m-auto flex max-h-[85dvh] w-[calc(100%_-_2rem)] max-w-[520px] flex-col overflow-hidden rounded-2xl border border-dark-blue/10 bg-canvas p-0 font-sans text-dark-blue shadow-2xl backdrop:bg-black/30">
    <header className="flex items-start gap-3 px-5 pt-5">
      <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-light-yellow text-orange">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
      </span>
      <div className="min-w-0 flex-1">
        <h2 id="reminder-title" className="text-xl font-semibold">A gentle reminder</h2>
        <p className="text-sm text-gray">{list.length===1?'1 task is':`${list.length} tasks are`} still to do. Start one when you’re ready.</p>
      </div>
      <button autoFocus type="button" onClick={onClose} aria-label="Close reminders" className="-mt-1 -mr-1 flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg text-2xl text-gray hover:bg-beige">&times;</button>
    </header>
    <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-2">
      {group('Overdue',overdue,true)}
      {group('Due soon',soon,false)}
      {!list.length && <p className="py-8 text-center text-gray">All caught up. Nothing needs a reminder right now.</p>}
    </div>
    <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-dark-blue/10 px-5 py-4">
      <Link to="/tasks" onClick={onClose} className="text-sm font-semibold text-link hover:underline">View all tasks</Link>
      <button type="button" onClick={onClose} className="min-h-10 cursor-pointer rounded-lg bg-blue px-4 text-sm font-semibold text-white hover:bg-action-hover">Remind me in 1 hour</button>
    </footer>
  </dialog>
}
export default function TaskReminders() {
  const {user}=useAuth()
  const {tasks}=useSpaces()
  const key=`petalpace-reminders-${user?.id}`
  const [open,setOpen]=useState(false)
  const [now,setNow]=useState(()=>Date.now())
  const [snoozedUntil,setSnoozedUntil]=useState(()=>{try{return Number(localStorage.getItem(key))||0}catch{return 0}})
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),60000);return()=>clearInterval(timer)},[])
  const list=tasks.filter(task=>needsTaskReminder(task,new Date(now)))
  const count=list.length
  useEffect(()=>{
    if(!count || now<snoozedUntil)return
    const show=()=>{
      if(document.visibilityState==='visible' && !document.querySelector('dialog[open]'))setOpen(true)
    }
    const first=setTimeout(show,1500)
    const retry=setInterval(show,30000)
    return()=>{clearTimeout(first);clearInterval(retry)}
  },[count,now,snoozedUntil])
  function dismiss(){
    const until=Date.now()+3600000
    setSnoozedUntil(until);setOpen(false)
    try{localStorage.setItem(key,String(until))}catch{/* Keep the snooze for this session. */}
  }
  return open ? <ReminderDialog onClose={dismiss}/> : null
}
