import { usePlannerClock } from '../hooks/usePlannerClock'
import { useState } from 'react'
import { Link } from 'react-router'
import { useSpaces } from '../features/spaces/spaces'
import ConfirmTaskDialog from '../features/tasks/components/ConfirmTaskDialog'
import PlannerSelect from '../components/ui/PlannerSelect'
import ProfileMenu from '../components/auth/ProfileMenu'
export default function BinPage(){
  const {trash,spaces,tasks,setTasks,permanentlyDelete,saving}=useSpaces()
  const now=usePlannerClock().getTime()
  const [selected,setSelected]=useState<string[]>([])
  const [purging,setPurging]=useState<string[]|null>(null)
  const [restoringIds,setRestoringIds]=useState<string[]|null>(null)
  const [destination,setDestination]=useState('')
  const [message,setMessage]=useState('')
  const items=trash.filter(task=>task.expiresAt>now && !tasks.some(active=>active.id===task.id))
  const chosen=items.filter(task=>selected.includes(task.id))
  const missingSpace=items.some(task=>!spaces.some(space=>space.id===task.spaceId))
  function restore(ids:string[]){
    const restoring=items.filter(task=>ids.includes(task.id))
    if(restoring.some(task=>!spaces.some(space=>space.id===task.spaceId) && !spaces.some(space=>space.id===destination))){setMessage('Choose a replacement space before restoring these tasks.');return}
    setTasks(current=>[...current,...restoring.filter(task=>!current.some(active=>active.id===task.id)).map(task=>{const space=spaces.find(space=>space.id===task.spaceId) ?? spaces.find(space=>space.id===destination)!;return {...task,spaceId:space.id,space:space.name,pinned:false}})])
    setSelected([]);setMessage('')
  }
  const action='cursor-pointer min-h-11 rounded-lg border border-blue px-4 py-2 text-sm font-medium text-link hover:bg-lightest-blue disabled:cursor-not-allowed disabled:opacity-50'
  return <div className="min-w-0 text-dark-blue">
    <header className="mb-6 flex items-start justify-between gap-4"><div><h1 className="text-3xl font-bold">Bin</h1><p className="mt-2 text-base text-gray">Deleted tasks stay here for 30 days. Restore them or delete them forever.</p></div><div className="hidden lg:block"><ProfileMenu/></div></header>
    <div className="rounded-xl border border-dark-blue/15 bg-beige/35 p-4">
      <p className="text-sm text-gray">Restoring keeps notes, steps, files, links, and task status. Permanent deletion cannot be undone.</p>
      {missingSpace && <div className="mt-3"><p className="mb-2 text-sm">Some original spaces were deleted. Choose a replacement for those tasks:</p><PlannerSelect label="Replacement space" value={destination} onChange={setDestination} options={[{value:'',label:'Choose a space'},...spaces.map(space=>({value:space.id,label:space.name,color:space.color}))]}/>{!spaces.length && <Link to="/spaces/new" className="mt-2 inline-block text-sm text-link underline">Create a space first</Link>}</div>}
    </div>
    {message && <p role="alert" className="mt-3 text-sm text-red">{message}</p>}
    {items.length>0 ? <>
      <div className="my-5 flex flex-wrap items-center gap-2 rounded-xl border border-blue/25 bg-lightest-blue/40 p-3">
        <label className="mr-auto flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium"><input type="checkbox" disabled={saving} checked={chosen.length===items.length} onChange={()=>setSelected(chosen.length===items.length?[]:items.map(task=>task.id))} className="h-4 w-4 accent-blue"/>Select all ({items.length})</label>
        <button type="button" disabled={saving || !chosen.length} onClick={()=>{setMessage('');setRestoringIds(chosen.map(task=>task.id))}} className={action}>Restore selected ({chosen.length})</button>
        <button type="button" disabled={saving || !chosen.length} onClick={()=>setPurging(chosen.map(task=>task.id))} className="cursor-pointer min-h-11 rounded-lg border border-red/40 bg-light-red px-4 py-2 text-sm font-medium text-red transition-colors enabled:hover:border-red enabled:hover:bg-danger enabled:hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red disabled:cursor-not-allowed disabled:opacity-50">Delete selected forever</button>
      </div>
      <p className="mb-3 text-sm text-gray" role="status">{chosen.length ? `${chosen.length} selected` : 'Select tasks below, or select all, then choose an action.'}</p>
      <ul className="space-y-3">{items.map(task=><li key={task.id} className={`rounded-xl border p-4 shadow-sm ${selected.includes(task.id)?'border-blue bg-lightest-blue/30':'border-dark-blue/15 bg-surface'}`}><div className="flex items-start gap-3"><input type="checkbox" aria-label={`Select ${task.title}`} checked={selected.includes(task.id)} disabled={saving} onChange={()=>setSelected(ids=>ids.includes(task.id)?ids.filter(id=>id!==task.id):[...ids,task.id])} className="mt-1.5 h-4 w-4 shrink-0 accent-blue"/><div className="min-w-0 flex-1"><h2 title={task.title} className="truncate text-lg font-semibold">{task.title}</h2><p className="mt-1 text-sm text-gray">{task.space} &middot; {Math.ceil((task.expiresAt-now)/86400000)} days left to restore</p><p className="mt-1 text-sm text-gray">Deleted {new Date(task.deletedAt).toLocaleDateString()} &middot; {task.files.length} files &middot; {task.links.length} links</p>{task.notes && <p className="mt-2 line-clamp-2 break-words text-sm">{task.notes}</p>}</div></div></li>)}</ul>
    </> : <div className="mt-6 rounded-xl border border-dashed border-dark-blue/20 bg-beige/20 px-5 py-12 text-center"><h2 className="text-xl font-semibold">Your Bin is empty</h2><p className="mt-2 text-base text-gray">Tasks deleted from your planner will appear here for 30 days.</p><Link to="/tasks" className="mt-4 inline-block rounded-lg bg-blue px-4 py-3 text-sm font-semibold text-white">Back to All tasks</Link></div>}
    {restoringIds && <ConfirmTaskDialog title={`Restore ${restoringIds.length} ${restoringIds.length===1?'task':'tasks'}?`} message="These tasks will return to your planner with their notes, steps, files, links, and status. If an original space was deleted, the selected replacement space will be used." confirmLabel="Restore tasks" cancelLabel="Keep in Bin" destructive={false} onCancel={()=>setRestoringIds(null)} onConfirm={()=>{restore(restoringIds);setRestoringIds(null)}}/>}
    {purging && <ConfirmTaskDialog title={`Permanently delete ${purging.length} ${purging.length===1?'task':'tasks'}?`} message="These tasks, including their notes, steps, files, and links, will be removed from the Bin. This cannot be undone." confirmLabel="Delete forever" cancelLabel="Keep in Bin" onCancel={()=>setPurging(null)} onConfirm={()=>{if(saving)return;permanentlyDelete(purging);setSelected(ids=>ids.filter(id=>!purging.includes(id)));setPurging(null)}}/>}
  </div>
}
