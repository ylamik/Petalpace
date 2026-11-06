import { useEffect, useId, useRef } from 'react'

type Props = {
  title: string
  message: string
  confirmLabel: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmTaskDialog({ title, message, confirmLabel, cancelLabel = 'Keep editing', destructive = true, onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const id = useId()
  useEffect(() => {
    const previous = document.activeElement
    const dialog = ref.current
    dialog?.showModal()
    return () => {
      dialog?.close()
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus()
    }
  }, [])

  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      aria-describedby={`${id}-message`}
      onCancel={event => { event.preventDefault(); onCancel() }}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-[420px] overflow-y-auto overscroll-contain rounded-2xl border border-dark-blue/15 bg-surface p-0 font-sans text-dark-blue shadow-xl backdrop:bg-black/30 backdrop:backdrop-blur-[2px]"
    >
      <div className="flex items-center justify-between border-b border-dark-blue/10 bg-beige/60 px-5 py-3 sm:px-6">
        <span aria-hidden="true" className={`flex h-9 w-9 items-center justify-center rounded-full ${destructive ? 'bg-light-red text-red' : 'bg-lightest-blue text-link'}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            <circle cx="12" cy="12" r="9" />
            {destructive ? <path d="M12 7v6m0 4h.01" /> : <path d="m8 12 3 3 5-6" />}
          </svg>
        </span>
        <button type="button" onClick={onCancel} aria-label="Cancel and close confirmation" className="flex h-11 w-11 items-center justify-center rounded-lg text-2xl text-link hover:bg-lightest-blue/50 focus-visible:outline-2 focus-visible:outline-blue">×</button>
      </div>
      <div className="p-5 sm:p-6">
        <h2 id={id} className="break-words text-xl font-semibold leading-tight sm:text-2xl">{title}</h2>
        <p id={`${id}-message`} className="mt-3 break-words text-sm leading-relaxed">{message}</p>
        <div className="mt-6 flex flex-col gap-2 min-[380px]:flex-row min-[380px]:justify-end">
          <button type="button" autoFocus onClick={onCancel} className="min-h-11 rounded-lg border border-blue bg-surface px-4 py-2 text-sm font-semibold text-link transition-colors hover:bg-lightest-blue/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue">{cancelLabel}</button>
          <button type="button" onClick={onConfirm} className={`min-h-11 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${destructive ? 'bg-danger hover:bg-danger/90 focus-visible:outline-red' : 'bg-blue hover:bg-action-hover focus-visible:outline-blue'}`}>{confirmLabel}</button>
        </div>
      </div>
    </dialog>
  )
}
