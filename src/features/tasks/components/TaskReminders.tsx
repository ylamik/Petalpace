import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../../auth/auth'
import { useSpaces } from '../../spaces/spaces'
import { needsTaskReminder, isDeadlineOverdue, compareTasks } from './taskPresentation'
import DeadlineLabel from './DeadlineLabel'
function ReminderDialog({onClose}:{onClose:()=>void}) {
  const ref=useRef<HTMLDialogElement>(null)
  const {tasks,setTasks}=useSpaces()
  const list=tasks.filter(task=>needsTaskReminder(task)).sort((a,b)=>compareTasks(a,b,'nearest'))
  useEffect(()=>{const element=ref.current;const previous=document.activeElement;element?.showModal();return()=>{element?.close();if(previous instanceof HTMLElement && previous.isConnected)previous.focus()}},[])
  return <dialog ref={ref} aria-labelledby="reminder-title" onCancel={event=>{event.preventDefault();onClose()}} className="fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%_-_2rem)] max-w-[540px] overflow-y-auto rounded-2xl border border-dark-blue/15 bg-surface p-5 font-sans text-dark-blue shadow-xl backdrop:bg-black/30">
    <header className="flex items-center justify-between gap-3"><h2 id="reminder-title" className="text-2xl font-semibold">A gentle reminder</h2><button autoFocus type="button" onClick={onClose} aria-label="Close reminders" className="h-11 w-11 rounded-lg text-2xl hover:bg-beige">&times;</button></header>
    <p className="mt-1 text-sm text-gray">These tasks are still To do. Start one when you are ready.</p>
    <ul className="mt-4 space-y-3">{list.map(task=><li key={task.id} className={`rounded-lg border p-3 ${isDeadlineOverdue(task)?'border-red/30 bg-light-pink/50':'border-dark-blue/15 bg-beige/25'}`}><h3 className="break-words font-semibold">{task.title}</h3><div className="mt-1"><DeadlineLabel task={task}/></div><button type="button" onClick={()=>setTasks(current=>current.map(item=>item.id===task.id?{...item,started:true,done:false,blocked:false}:item))} className="mt-3 min-h-10 rounded-md bg-blue px-3 py-2 text-sm font-semibold text-white">Start task</button></li>)}</ul>
    {!list.length && <p className="py-6 text-center text-gray">Nothing needs a reminder right now. One step at a time.</p>}
    <button type="button" onClick={onClose} className="mt-4 mr-4 min-h-11 rounded-lg border border-blue px-4 text-sm font-medium text-link">Remind in 1 hour</button>
    <Link to="/tasks" onClick={onClose} className="mt-4 inline-flex min-h-11 items-center text-sm text-link underline">View All tasks</Link>
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
