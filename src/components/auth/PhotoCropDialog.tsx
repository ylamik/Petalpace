import { useEffect, useRef, useState } from 'react'
import ConfirmTaskDialog from '../../features/tasks/components/ConfirmTaskDialog'

type Props = { file: File; onCancel: () => void; onSave: (image: string) => Promise<void> }
const clamp = (value: number) => Math.max(0, Math.min(100, value))

export default function PhotoCropDialog({ file, onCancel, onSave }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const image = useRef<HTMLImageElement | null>(null)
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null)
  const [source, setSource] = useState('')
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [zoom, setZoom] = useState(1)
  const [position, setPosition] = useState({ x: 50, y: 50 })
  const [confirm, setConfirm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const previous = document.activeElement
    const element = dialog.current
    element?.showModal()
    const url = URL.createObjectURL(file)
    const photo = new Image()
    let active = true
    photo.onload = () => {
      if (!active) return
      if (photo.naturalWidth * photo.naturalHeight > 40000000) { setError('This photo is too large to preview. Choose a smaller copy.'); return }
      image.current = photo
      setSource(url)
      setSize({ width: photo.naturalWidth, height: photo.naturalHeight })
    }
    photo.onerror = () => { if (active) setError('This photo could not be opened. Choose a JPG, PNG, or WebP image.') }
    photo.src = url
    return () => { active = false; URL.revokeObjectURL(url); element?.close(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus() }
  }, [file])
  const scale = size.width ? Math.max(1 / size.width, 1 / size.height) * zoom : 1
  const width = size.width * scale
  const height = size.height * scale
  async function save() {
    if (!image.current || saving) return
    setConfirm(false)
    setSaving(true)
    setError('')
    try {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 512
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Photo editing is unavailable in this browser.')
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, 512, 512)
      context.drawImage(image.current, -(width - 1) * position.x / 100 * 512, -(height - 1) * position.y / 100 * 512, width * 512, height * 512)
      await onSave(canvas.toDataURL('image/jpeg', 0.9).split(',')[1])
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save your photo. Please try again.') }
    finally { setSaving(false) }
  }
  return <>
    <dialog ref={dialog} aria-labelledby="photo-crop-title" onCancel={event => { event.preventDefault(); if (!saving) onCancel() }} className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-[460px] overflow-y-auto rounded-2xl border border-dark-blue/15 bg-surface p-0 font-sans text-dark-blue shadow-xl backdrop:bg-black/30">
      <header className="border-b border-dark-blue/10 bg-beige/60 px-5 py-4"><h2 id="photo-crop-title" className="text-2xl font-semibold">Make it your little space</h2><p className="mt-1 text-sm text-gray">Drag your photo and adjust the zoom to fit the circle.</p></header>
      <div className="p-5">
        <div className="relative mx-auto aspect-square w-full max-w-[260px] touch-none overflow-hidden rounded-full border-2 border-blue/40 bg-beige/40" style={{cursor: source ? 'grab' : 'default'}}
          onPointerDown={event => { if (!source || saving) return; event.currentTarget.setPointerCapture(event.pointerId); drag.current = {x:event.clientX,y:event.clientY,left:position.x,top:position.y} }}
          onPointerMove={event => { if (!drag.current) return; const extent=event.currentTarget.clientWidth; setPosition({x:clamp(drag.current.left-(event.clientX-drag.current.x)/Math.max(1,(width-1)*extent)*100),y:clamp(drag.current.top-(event.clientY-drag.current.y)/Math.max(1,(height-1)*extent)*100)}) }}
          onPointerUp={() => { drag.current=null }} onPointerCancel={() => { drag.current=null }}>
          {source ? <img src={source} alt="Preview of your profile photo" draggable={false} className="pointer-events-none absolute max-w-none select-none" style={{width:`${width*100}%`,height:`${height*100}%`,left:`${-(width-1)*position.x}%`,top:`${-(height-1)*position.y}%`}}/> : <p className="absolute inset-0 flex items-center justify-center text-sm text-gray">{error ? 'Preview unavailable' : 'Loading photo...'}</p>}
        </div>
        <fieldset disabled={!source || saving} className="mt-5 space-y-3 disabled:opacity-50">
          <label className="block text-sm">Zoom<input type="range" min="1" max="3" step="0.01" value={zoom} onChange={event=>setZoom(Number(event.target.value))} className="mt-1 block w-full accent-blue"/></label>
          <label className="block text-sm">Move left or right<input type="range" min="0" max="100" value={position.x} onChange={event=>setPosition(p=>({...p,x:Number(event.target.value)}))} className="mt-1 block w-full accent-blue"/></label>
          <label className="block text-sm">Move up or down<input type="range" min="0" max="100" value={position.y} onChange={event=>setPosition(p=>({...p,y:Number(event.target.value)}))} className="mt-1 block w-full accent-blue"/></label>
        </fieldset>
        {error && <p role="alert" className="mt-3 text-sm text-red">{error}</p>}
        <div className="mt-6 flex flex-wrap justify-end gap-2"><button type="button" disabled={saving} onClick={onCancel} className="min-h-11 rounded-lg border border-blue px-4 py-2 text-sm font-semibold text-link disabled:opacity-50 hover:bg-lightest-blue/50">Cancel</button><button type="button" disabled={!source || saving} onClick={()=>setConfirm(true)} className="min-h-11 rounded-lg bg-blue px-4 py-2 text-sm font-semibold text-white hover:bg-action-hover disabled:opacity-50">{saving ? 'Saving...' : 'Save photo'}</button></div>
      </div>
    </dialog>
    {confirm && <ConfirmTaskDialog title="Save this profile photo?" message="Your profile picture will use the circle preview you have chosen." confirmLabel="Save photo" cancelLabel="Keep adjusting" destructive={false} onCancel={()=>setConfirm(false)} onConfirm={()=>void save()}/>}
  </>
}
