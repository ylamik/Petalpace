import { useEffect, useRef, useState } from 'react'
import { useSpaces, type Space } from './spaces'
import { saveAndWait } from './saveAndWait'
import { ButtonSpinner } from '../../components/ui/PageLoader'

const palette = ['#BCDCF1', '#EBC39C', '#D0BEFF', '#F9DEA4', '#BFD2C8', '#FFACB3',
  '#D7E7FD', '#FDDCCD', '#D6DDC9', '#FDE8A8', '#C8DEFF', '#FFD6D6']

export default function EditSpaceDialog({
  space,
  onCancel,
  onSaved,
}: {
  space: Space
  onCancel: () => void
  onSaved: (updated: Space) => void
}) {
  const { spaces, setSpaces, setTasks, ensureSaved } = useSpaces()
  const [submitting, setSubmitting] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [name, setName] = useState(space.name)
  const [color, setColor] = useState(space.color)
  const [custom, setCustom] = useState(
    palette.includes(space.color) ? '' : space.color,
  )
  const [error, setError] = useState('')

  useEffect(() => {
    const previous = document.activeElement
    const el = dialogRef.current
    el?.showModal()
    return () => {
      el?.close()
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus()
    }
  }, [])

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) { setError('Enter a space name.'); return }
    if (trimmed.length > 40) { setError('Space name must be 40 characters or fewer.'); return }
    const duplicate = spaces.find(
      (s) => s.id !== space.id && s.name.toLowerCase() === trimmed.toLowerCase(),
    )
    if (duplicate) { setError('A space with this name already exists.'); return }
    const chosen = (custom.trim() || color).toLowerCase()
    if (!/^#[0-9a-f]{6}$/.test(chosen)) {
      setError('Use a six-digit hex color, such as #BCDCF1.')
      return
    }
    const updated: Space = { id: space.id, name: trimmed, color: chosen }
    if (submitting) return
    setSubmitting(true)
    void saveAndWait(() => {
    // Update the space itself
    setSpaces((current) =>
      current.map((s) => (s.id === space.id ? updated : s)),
    )
    // Update all tasks that belong to this space so their .space name stays in sync
    if (trimmed !== space.name) {
      setTasks((current) =>
        current.map((task) =>
          task.spaceId === space.id ? { ...task, space: trimmed } : task,
        ),
      )
    }
    }, ensureSaved).finally(() => { setSubmitting(false); onSaved(updated) })
  }

  const resolvedColor = /^#[0-9a-f]{6}$/i.test(custom) ? custom : color

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="edit-space-title"
      onCancel={(e) => { e.preventDefault(); onCancel() }}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-[480px] overflow-y-auto rounded-2xl border border-dark-blue/15 bg-surface p-0 font-sans text-dark-blue shadow-xl backdrop:bg-black/30"
    >
      <header className="flex items-center gap-3 border-b border-dark-blue/10 bg-beige/60 px-5 py-4">
        <span
          className="h-8 w-8 shrink-0 rounded-full border border-dark-blue/10"
          style={{ backgroundColor: resolvedColor }}
          aria-hidden="true"
        />
        <h2 id="edit-space-title" className="text-xl font-semibold">
          Edit space
        </h2>
      </header>

      <form onSubmit={submit} className="p-5">
        <label className="block text-sm font-medium">
          Space name
          <input
            autoFocus
            required
            maxLength={40}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter space name…"
            className="mt-1.5 block min-h-11 w-full rounded-lg border border-dark-blue/20 bg-surface px-3 text-base focus-visible:outline-blue"
          />
        </label>

        <fieldset className="mt-5 border-0 p-0">
          <legend className="text-sm font-medium">Color</legend>
          <div className="mt-2 flex flex-wrap gap-3">
            {palette.map((swatch) => (
              <button
                key={swatch}
                type="button"
                aria-label={`Choose ${swatch}`}
                aria-pressed={!custom && color === swatch}
                onClick={() => { setColor(swatch); setCustom('') }}
                style={{ backgroundColor: swatch }}
                className={`h-10 w-10 rounded-full border-2 border-white transition-shadow ${
                  !custom && color === swatch
                    ? 'ring-2 ring-blue ring-offset-2'
                    : 'hover:ring-2 hover:ring-blue/40 hover:ring-offset-1'
                }`}
              />
            ))}
          </div>
        </fieldset>

        <div className="mt-5">
          <label htmlFor="edit-space-custom" className="text-sm font-medium">
            Custom color
          </label>
          <div className="mt-1.5 flex items-center gap-3">
            <input
              id="edit-space-custom"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="#BCDCF1"
              maxLength={7}
              className="min-h-11 w-36 rounded-lg border border-dark-blue/20 bg-surface px-3 text-sm focus-visible:outline-blue"
            />
            <label
              className="relative h-10 w-10 overflow-hidden rounded-full border border-dark-blue/10"
              style={{ backgroundColor: resolvedColor }}
            >
              <span className="sr-only">Open color picker</span>
              <input
                type="color"
                value={resolvedColor}
                onChange={(e) => setCustom(e.target.value)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </label>
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-3 text-sm text-red">
            {error}
          </p>
        )}

        <div className="mt-7 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 rounded-lg border border-blue px-5 text-sm font-semibold text-link hover:bg-lightest-blue/30"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue px-5 text-sm font-semibold text-white hover:bg-action-hover disabled:opacity-70"
          >
            {submitting && <ButtonSpinner />}
            {submitting ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
