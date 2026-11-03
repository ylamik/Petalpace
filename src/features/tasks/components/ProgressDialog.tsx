import { useEffect, useRef } from 'react'
import ActivityHeatmap from './ActivityHeatmap'
export default function ProgressDialog({onClose}:{onClose:()=>void}) {
  const ref=useRef<HTMLDialogElement>(null)
  useEffect(()=>{const dialog=ref.current;const previous=document.activeElement;dialog?.showModal();return()=>{dialog?.close();if(previous instanceof HTMLElement)previous.focus()}},[])
  return (
    <dialog ref={ref} aria-labelledby="progress-title-dialog" onCancel={e=>{e.preventDefault();onClose()}} className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-[880px] overflow-y-auto rounded-2xl border border-dark-blue/20 bg-surface p-5 font-serif text-dark-blue shadow-xl backdrop:bg-black/30 sm:p-7">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 id="progress-title-dialog" className="flex items-center gap-2 text-2xl font-bold sm:text-3xl"><img src="/images/leaves.png" alt="" className="h-8 w-8 shrink-0 object-contain"/>Little steps over time</h2>
          <p className="mt-1 sm:ml-10 text-sm italic text-gray">A gentle look at the tasks you’ve completed</p>
        </div>
        <button autoFocus onClick={onClose} aria-label="Close progress" className="h-11 w-11 shrink-0 rounded-lg text-2xl hover:bg-beige">×</button>
      </header>
      <ActivityHeatmap/>
      <div className="mt-7 flex flex-wrap items-center gap-3 rounded-xl bg-panel-green px-4 py-4 sm:gap-4">
        <img src="/images/leaves-1.png" alt="" className="h-16 w-10 shrink-0 object-contain"/>
        <div className="min-w-0 flex-1 basis-44"><h3 className="text-lg font-bold sm:text-2xl">Rest days belong here, too.</h3><p className="mt-1 text-sm text-gray sm:text-base">This shows completed tasks, not the effort behind them.</p></div>
        <button type="button" onClick={onClose} className="ml-auto min-h-11 rounded-md bg-blue px-4 py-2 font-semibold text-white hover:bg-action-hover">Back to Today</button>
      </div>
    </dialog>
  )
}
