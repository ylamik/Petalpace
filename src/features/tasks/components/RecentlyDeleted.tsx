import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useSpaces, type DeletedTask } from '../../spaces/spaces'
import PlannerSelect from '../../../components/ui/PlannerSelect'
function DeletedRow({task,now}:{task:DeletedTask;now:number}) {
  const {spaces,tasks,setTasks,saving}=useSpaces()
  const [target,setTarget]=useState(spaces.find(space=>space.id===task.spaceId)?.id ?? spaces[0]?.id ?? '')
  const [requested,setRequested]=useState(false)
  const exists=tasks.some(item=>item.id===task.id)
  const days=Math.max(0,Math.ceil((task.expiresAt-now)/86400000))
  return <li className="rounded-lg border border-dark-blue/15 bg-surface p-4">
    <h3 className="truncate text-base font-semibold" title={task.title}>{task.title}</h3>
    <p className="mt-1 text-sm text-gray">{days} {days===1?'day':'days'} left to restore &middot; {task.files.length} files &middot; {task.links.length} links</p>
    <p className="mt-1 line-clamp-2 break-words text-sm text-gray">{task.notes || 'No notes'}</p>
    <div className="mt-3 flex flex-wrap items-center gap-2"><PlannerSelect label={`Restore ${task.title} to space`} value={target} onChange={setTarget} options={spaces.map(space=>({value:space.id,label:space.name,color:space.color}))} className="max-w-full"/>
      <button type="button" disabled={saving || requested || exists || !spaces.some(space=>space.id===target) || task.expiresAt<=now} onClick={()=>{const space=spaces.find(item=>item.id===target);if(!space)return;setRequested(true);setTasks(current=>current.some(item=>item.id===task.id)?current:[...current,{...task,spaceId:space.id,space:space.name,pinned:false}])}} className="min-h-11 rounded-lg bg-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{requested || exists?'Restoring...':'Restore task'}</button>
    </div>
    {!spaces.length && <Link to="/spaces/new" className="mt-2 inline-block text-sm text-link underline">Create a space to restore this task</Link>}
  </li>
}
export default function RecentlyDeleted() {
  const {trash}=useSpaces()
  const [now,setNow]=useState(()=>Date.now())
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),60000);return()=>clearInterval(timer)},[])
  const recoverable=trash.filter(task=>task.expiresAt>now)
  return <details className="mt-8 rounded-xl border border-dark-blue/15 bg-beige/20 p-4">
    <summary className="cursor-pointer text-lg font-semibold">Recently deleted ({recoverable.length})</summary>
    <p className="mt-3 text-sm text-gray">Tasks can be restored for 30 days after deletion, including their notes, steps, files, and links. After that, recovery is no longer available.</p>
    <ul className="mt-4 space-y-3">{recoverable.map(task=><DeletedRow key={task.id} task={task} now={now}/>)}</ul>
    {!recoverable.length && <p className="mt-3 text-sm text-gray">No recently deleted tasks.</p>}
  </details>
}
