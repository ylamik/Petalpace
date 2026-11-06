import { useEffect, useRef, useState } from 'react'

type Props = {
  title: string
  pinned: boolean
  canPin: boolean
  onEdit: (focusDate: boolean) => void
  onPin: () => void
  onDelete: () => void
}

export default function TaskOptions({ title, pinned, canPin, onEdit, onPin, onDelete }: Props) {
  const [open, setOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const firstAction = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    firstAction.current?.focus()
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false)
    }
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape') { setOpen(false); trigger.current?.focus() }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) }
  }, [open])
  function choose(action: () => void) {
    trigger.current?.focus()
    setOpen(false)
    action()
  }
  const item = 'flex min-h-9 w-full items-center gap-2 rounded px-2 text-left text-sm hover:bg-lightest-blue/70 focus-visible:bg-lightest-blue focus-visible:outline-blue'
  return <div ref={root} className="relative shrink-0" onBlur={(event) => { if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}>
    <button ref={trigger} type="button" aria-label={`Task options for ${title}`} aria-expanded={open} onClick={() => { setConfirmDelete(false); setOpen(!open) }} className="-mr-2 rounded px-3 py-2 font-bold hover:bg-lightest-blue/40">···</button>
    {open && <div role="group" aria-label={`Options for ${title}`} className="absolute top-full right-0 z-20 mt-1 w-52 max-w-[calc(100vw-2rem)] rounded-lg border border-dark-blue/20 bg-surface p-2 shadow-[0_3px_8px_rgb(0_0_0_/_0.2)]">
      <p className="mb-1 flex items-center gap-1 border-b border-dark-blue/10 px-1 pb-2 pt-1 text-[10px] text-gray"><img src="/images/pink-flower.png" alt="" className="h-4 w-4 object-contain" />TASK OPTIONS</p>
      {confirmDelete ? <div className="p-1"><p className="mb-2 text-sm">Move to Recently deleted? You can restore it within 30 days.</p><div className="flex gap-2"><button type="button" onClick={() => choose(onDelete)} className="rounded bg-danger px-3 py-2 text-xs text-white hover:brightness-90">Delete</button><button type="button" onClick={() => setConfirmDelete(false)} className="rounded px-3 py-2 text-xs hover:bg-beige">Cancel</button></div></div> : <>
        <button ref={firstAction} type="button" className={`${item} bg-lightest-blue/50`} onClick={() => choose(() => onEdit(false))}><span aria-hidden="true">✎</span>Edit Task</button>
        <button type="button" className={item} onClick={() => choose(() => onEdit(true))}><img src="/icons/upcoming-icon.png" alt="" className="h-4 w-4 object-contain" />Change due date</button>
        <button type="button" disabled={!pinned && !canPin} className={`${item} disabled:opacity-40`} onClick={() => choose(onPin)}><span aria-hidden="true">☆</span>{pinned ? 'Remove from My top 3' : 'Add to My top 3'}</button>
        {!pinned && !canPin && <p className="px-2 text-xs text-gray">Unpin a task to make room.</p>}
        <div className="mt-1 border-t border-dark-blue/10 pt-1"><button type="button" className={`${item} text-red`} onClick={() => setConfirmDelete(true)}><span aria-hidden="true">♲</span>Delete task</button></div>
      </>}
    </div>}
  </div>
}
