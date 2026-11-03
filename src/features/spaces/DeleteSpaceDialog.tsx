import { useEffect, useRef, useState } from 'react'
import PlannerSelect from '../../components/ui/PlannerSelect'
import { useSpaces, type Space } from './spaces'

export default function DeleteSpaceDialog({space,onCancel,onDeleted}: {space:Space;onCancel:()=>void;onDeleted:()=>void}) {
  const {spaces,tasks,deleteSpace}=useSpaces()
  const dialog=useRef<HTMLDialogElement>(null)
  const destinations=spaces.filter(item=>item.id!==space.id)
  const [target,setTarget]=useState(destinations[0]?.id ?? '')
  const count=tasks.filter(task=>task.spaceId===space.id).length
  const canDelete=!count || destinations.some(item=>item.id===target)
  useEffect(()=>{const previous=document.activeElement;const element=dialog.current;element?.showModal();return()=>{element?.close();if(previous instanceof HTMLElement && previous.isConnected)previous.focus()}},[])
  return <dialog ref={dialog} aria-labelledby="delete-space-title" onCancel={event=>{event.preventDefault();onCancel()}} className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-[440px] overflow-y-auto rounded-2xl border border-dark-blue/15 bg-surface p-0 font-serif text-dark-blue shadow-xl backdrop:bg-black/30">
    <header className="border-b border-dark-blue/10 bg-beige/60 px-5 py-4"><h2 id="delete-space-title" className="break-words text-xl font-semibold">Delete {space.name}?</h2></header>
    <div className="p-5"><p className="text-sm leading-relaxed">{count ? `This space has ${count} ${count===1?'task':'tasks'}. Choose another space to keep them in. No tasks or attachments will be deleted.` : 'This space is empty. Delete it from My spaces?'}</p>
      {!!count && (destinations.length ? <div className="mt-4"><p className="mb-2 text-sm font-medium">Move tasks to</p><PlannerSelect label="Move tasks to space" value={target} onChange={setTarget} options={destinations.map(item=>({value:item.id,label:item.name,color:item.color}))} className="w-full"/></div> : <p role="alert" className="mt-4 rounded-lg bg-light-pink p-3 text-sm text-red">Create another space first, so your tasks have somewhere to go.</p>)}
      <div className="mt-6 flex flex-wrap justify-end gap-2"><button autoFocus type="button" onClick={onCancel} className="min-h-11 rounded-lg border border-blue px-4 py-2 text-sm font-semibold text-link">Cancel</button><button type="button" disabled={!canDelete} onClick={()=>{deleteSpace(space.id,target);onDeleted()}} className="min-h-11 rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{count?'Move tasks & delete space':'Delete space'}</button></div>
    </div>
  </dialog>
}
