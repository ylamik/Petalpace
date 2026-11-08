import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useSpaces } from '../features/spaces/spaces'
import { saveAndWait } from '../features/spaces/saveAndWait'
import { ButtonSpinner } from '../components/ui/PageLoader'

const palette = ['#BCDCF1', '#EBC39C', '#D0BEFF', '#F9DEA4', '#BFD2C8', '#FFACB3']
export default function CreateSpacePage() {
  const { spaces, setSpaces, ensureSaved } = useSpaces()
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [color, setColor] = useState(palette[0])
  const [custom, setCustom] = useState('')
  const [error, setError] = useState('')
  return <><section className="mx-auto mt-3 max-w-[620px] rounded-lg border border-dark-blue/15 bg-surface p-6 text-dark-blue shadow-[0_3px_3px_rgb(0_0_0_/_0.12)] sm:p-10">
    <h1 className="mb-3 text-3xl font-bold">A space for what matters</h1>
    <form onSubmit={(event) => {
      event.preventDefault()
      const trimmed = name.trim()
      if (!trimmed) { setError('Enter a space name.'); return }
      if (spaces.some((space) => space.name.toLowerCase() === trimmed.toLowerCase())) { setError('A space with this name already exists.'); return }
      const chosen = custom.trim() || color
      if (!/^#[0-9a-f]{6}$/i.test(chosen)) { setError('Use a six-digit hex color, such as #BCDCF1.'); return }
      const id = crypto.randomUUID()
      if (submitting) return
      setSubmitting(true)
      void saveAndWait(() => setSpaces((current) => [...current, { id, name: trimmed, color: chosen }]), ensureSaved)
        .finally(() => { setSubmitting(false); navigate(`/spaces/${id}`) })
    }}>
      <label className="block">Space name<input required maxLength={40} value={name} onChange={(event) => setName(event.target.value)} placeholder="Enter space name..." className="mt-1 block min-h-11 w-full rounded-lg border border-dark-blue/20 px-3 text-sm focus-visible:outline-blue" /></label>
      <fieldset className="mt-5"><legend>Choose color</legend><div className="mt-2 flex flex-wrap gap-3">{palette.map((swatch) => <button key={swatch} type="button" aria-label={`Choose ${swatch}`} aria-pressed={!custom && color === swatch} onClick={() => { setColor(swatch); setCustom('') }} style={{ backgroundColor: swatch }} className={`h-10 w-10 rounded-full border-2 border-white ${!custom && color === swatch ? 'ring-2 ring-blue ring-offset-2' : ''} transition-transform hover:scale-110`} />)}</div></fieldset>
      <div className="mt-7"><label htmlFor="space-custom">Custom color</label><div className="mt-1 flex items-center gap-3"><input id="space-custom" value={custom} onChange={(event) => setCustom(event.target.value)} placeholder="#BCDCF1" maxLength={7} className="min-h-11 w-40 rounded-lg border border-dark-blue/20 px-3 text-sm focus-visible:outline-blue" /><label className="relative h-10 w-10 overflow-hidden rounded-full border border-dark-blue/10" style={{ backgroundColor: /^#[0-9a-f]{6}$/i.test(custom) ? custom : color }}><span className="sr-only">Open custom color picker</span><input type="color" value={/^#[0-9a-f]{6}$/i.test(custom) ? custom : color} onChange={(event) => setCustom(event.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" /></label></div></div>
      <p role="alert" className="mt-3 text-sm text-red">{error}</p>
      <div className="mt-8 flex justify-end gap-3"><button type="button" onClick={() => navigate('/today')} className="rounded-lg border border-blue px-5 py-2 text-link hover:bg-lightest-blue/50">Cancel</button><button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-lg bg-blue px-5 py-2 font-semibold text-white hover:bg-action-hover disabled:opacity-70">{submitting && <ButtonSpinner />}{submitting ? 'Creating…' : 'Create space'}</button></div>
    </form>
  </section></>
}
