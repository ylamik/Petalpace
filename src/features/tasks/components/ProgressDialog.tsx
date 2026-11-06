import { useEffect, useRef, useState } from 'react'
import ActivityHeatmap from './ActivityHeatmap'
import { useSpaces } from '../../spaces/spaces'

export default function ProgressDialog({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const { resetActivity } = useSpaces()
  const [confirming, setConfirming] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [resetError, setResetError] = useState('')

  useEffect(() => {
    const dialog = ref.current
    const previous = document.activeElement
    dialog?.showModal()
    return () => {
      dialog?.close()
      if (previous instanceof HTMLElement) previous.focus()
    }
  }, [])

  async function handleReset() {
    setResetting(true)
    setResetError('')
    try {
      await resetActivity()
      setConfirming(false)
    } catch (e) {
      setResetError(e instanceof Error ? e.message : 'Could not reset your activity history. Please try again.')
    } finally {
      setResetting(false)
    }
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby="progress-title-dialog"
      onCancel={e => { e.preventDefault(); onClose() }}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-[880px] overflow-y-auto rounded-2xl border border-dark-blue/20 bg-surface p-5 font-sans text-dark-blue shadow-xl backdrop:bg-black/30 sm:p-7"
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 id="progress-title-dialog" className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
            <img src="/images/leaves.png" alt="" className="h-8 w-8 shrink-0 object-contain" />
            Little steps over time
          </h2>
          <p className="mt-1 sm:ml-10 text-sm italic text-gray">A gentle look at the tasks you've completed</p>
        </div>
        <button autoFocus onClick={onClose} aria-label="Close progress" className="h-11 w-11 shrink-0 rounded-lg text-2xl hover:bg-beige">×</button>
      </header>

      <ActivityHeatmap />

      {/* Reset history */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-dark-blue/10 pt-4">
        {resetError && <p role="alert" className="w-full text-sm text-red">{resetError}</p>}
        {!confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="min-h-10 rounded-lg border border-red px-4 py-1.5 text-sm font-semibold text-red hover:bg-red/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red"
          >
            Reset activity history
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-gray">This will clear all your completion history. This cannot be undone.</p>
            <button
              type="button"
              onClick={handleReset}
              disabled={resetting}
              className="min-h-10 rounded-lg bg-danger px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {resetting ? 'Resetting…' : 'Yes, reset'}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="min-h-10 rounded-lg border border-blue px-4 py-1.5 text-sm text-link"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl bg-panel-green px-4 py-4 sm:gap-4">
        <img src="/images/leaves-1.png" alt="" className="h-16 w-10 shrink-0 object-contain" />
        <div className="min-w-0 flex-1 basis-44">
          <h3 className="text-lg font-bold sm:text-2xl">Rest days belong here, too.</h3>
          <p className="mt-1 text-sm text-gray sm:text-base">This shows completed tasks, not the effort behind them.</p>
        </div>
        <button type="button" onClick={onClose} className="ml-auto min-h-11 rounded-md bg-blue px-4 py-2 font-semibold text-white hover:bg-action-hover">Close</button>
      </div>
    </dialog>
  )
}
