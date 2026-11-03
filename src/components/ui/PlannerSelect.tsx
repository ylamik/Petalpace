import { useEffect, useId, useRef, useState } from 'react'
export type SelectChoice={value:string;label:string;color?:string}
type SelectTone = 'neutral' | 'todo' | 'progress' | 'done' | 'blocked'
const tones: Record<SelectTone, string> = {
  neutral: 'border border-dark-blue/20 bg-surface text-dark-blue',
  todo: 'border border-gray bg-light-gray/60 font-medium text-gray',
  progress: 'border border-blue bg-lightest-blue font-medium text-dark-blue',
  done: 'border border-done-stroke bg-done-badge font-medium text-done-ink',
  blocked: 'border border-orange bg-light-orange font-medium text-orange',
}
function PriorityFlag({value}: {value: string}) {
  const color = value === 'High' ? 'text-red' : value === 'Medium' ? 'text-orange' : value === 'Low' ? 'text-gray' : ''
  if (!color) return null
  return <svg aria-hidden="true" className={`h-4 w-4 shrink-0 ${color}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M5 21V3m0 1c5-3 9 3 14 0v10c-5 3-9-3-14 0" fill="currentColor" fillOpacity="0.2"/></svg>
}
export default function PlannerSelect({value,onChange,options,label,className='',priorityIcons=false,tone='neutral'}:{value:string;onChange:(value:string)=>void;options:SelectChoice[];label:string;className?:string;priorityIcons?:boolean;tone?:SelectTone}) {
  const textSize = 'text-sm'
  const [open,setOpen]=useState(false),[active,setActive]=useState(0)
  const [position,setPosition]=useState({left:0,top:0,width:220,maxHeight:280})
  const trigger=useRef<HTMLButtonElement>(null),menu=useRef<HTMLDivElement>(null),id=useId()
  const selected=options.find(o=>o.value===value)
  function show(){const rect=trigger.current?.getBoundingClientRect();if(!rect)return;const width=Math.min(Math.max(rect.width,220),window.innerWidth-24);const below=window.innerHeight-rect.bottom-12;const height=Math.min(280,options.length*44+16);setPosition({left:Math.max(12,Math.min(rect.left,window.innerWidth-width-12)),top:below<height && rect.top>height?rect.top-height-6:rect.bottom+6,width,maxHeight:Math.max(100,below<height && rect.top>height?height:below)});setActive(Math.max(0,options.findIndex(o=>o.value===value)));setOpen(true)}
  function close(){setOpen(false);trigger.current?.focus()}
  function choose(index:number){const option=options[index];if(option){onChange(option.value);close()}}
  useEffect(()=>{
    if(!open)return
    const element=menu.current;element?.showPopover?.();element?.focus()
    const outside=(event:PointerEvent)=>{if(event.target instanceof Node && !element?.contains(event.target) && !trigger.current?.contains(event.target))setOpen(false)}
    const resize=()=>setOpen(false)
    const scroll=(event:Event)=>{if(event.target instanceof Node && !element?.contains(event.target))setOpen(false)}
    document.addEventListener('pointerdown',outside);window.addEventListener('resize',resize);window.addEventListener('scroll',scroll,true)
    return()=>{element?.hidePopover?.();document.removeEventListener('pointerdown',outside);window.removeEventListener('resize',resize);window.removeEventListener('scroll',scroll,true)}
  },[open])
  useEffect(()=>{if(open)document.getElementById(`${id}-${active}`)?.scrollIntoView({block:'nearest'})},[active,id,open])
  return <>
    <button ref={trigger} type="button" role="combobox" aria-label={label} aria-expanded={open} aria-controls={id} aria-haspopup="listbox" onClick={()=>open?close():show()} onKeyDown={e=>{if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();show()}}} className={`flex min-h-11 min-w-0 max-w-full items-center gap-3 rounded-lg ${tones[tone]} px-3 py-2 text-left ${textSize} focus-visible:outline-2 focus-visible:outline-blue ${className}`}>
      {priorityIcons && <PriorityFlag value={value}/>}
      {selected?.color && <span aria-hidden="true" className="h-3.5 w-3.5 shrink-0 rounded-full border border-dark-blue/20" style={{backgroundColor:selected.color}}/>}<span className="min-w-0 flex-1 truncate">{selected?.label??'Select…'}</span><svg aria-hidden="true" className="ml-2 h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="m6 9 6 6 6-6"/></svg>
    </button>
    {open && <div ref={menu} id={id} role="listbox" aria-label={label} aria-activedescendant={`${id}-${active}`} tabIndex={-1} popover="manual" style={{position:'fixed',inset:'auto',margin:0,...position}} className="z-[100] overflow-y-auto rounded-xl border border-dark-blue/20 bg-surface p-1.5 font-serif text-dark-blue shadow-xl outline-none" onKeyDown={e=>{
      if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close()}
      else if(e.key==='Tab'){setOpen(false);trigger.current?.focus()}
      else if(e.key==='ArrowDown' || e.key==='ArrowUp'){e.preventDefault();setActive(i=>(i+(e.key==='ArrowDown'?1:-1)+options.length)%options.length)}
      else if(e.key==='Home' || e.key==='End'){e.preventDefault();setActive(e.key==='Home'?0:options.length-1)}
      else if(e.key==='Enter' || e.key===' '){e.preventDefault();choose(active)}
      else if(e.key.length===1){const found=options.findIndex(o=>o.label.toLowerCase().startsWith(e.key.toLowerCase()));if(found>=0)setActive(found)}
    }}>
      {options.map((option,index)=><div key={option.value} id={`${id}-${index}`} role="option" aria-selected={value===option.value} onMouseEnter={()=>setActive(index)} onClick={()=>choose(index)} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 py-2 ${textSize} ${index===active?'bg-beige':value===option.value?'bg-beige/40':''}`}>
        {priorityIcons && <PriorityFlag value={option.value}/>}
        {option.color && <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-dark-blue/20" style={{backgroundColor:option.color}}/>}<span className="min-w-0 flex-1 break-words">{option.label}</span>{value===option.value && <span aria-hidden="true" className="text-link">✓</span>}
      </div>)}
    </div>}
  </>
}
