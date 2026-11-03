import { useEffect, useRef, useState } from 'react'
import { useSpaces } from '../../spaces/spaces'
import PlannerSelect from '../../../components/ui/PlannerSelect'
import { localDateKey } from './taskPresentation'
const shades=['var(--heat-0)','var(--heat-1)','var(--heat-2)','var(--heat-3)','var(--heat-4)']
export default function ActivityHeatmap({compact=false}:{compact?:boolean}) {
  const {activity,saving}=useSpaces()
  const [hover,setHover]=useState<number|null>(null),[pinned,setPinned]=useState<number|null>(null)
  const root=useRef<HTMLDivElement>(null)
  const [weeks,setWeeks]=useState(12)
  const [todayKey,setTodayKey]=useState(()=>localDateKey(new Date()))
  useEffect(()=>{
    const refresh=()=>setTodayKey(localDateKey(new Date()))
    const timer=window.setInterval(refresh,60000)
    window.addEventListener('focus',refresh)
    return()=>{window.clearInterval(timer);window.removeEventListener('focus',refresh)}
  },[])
  const today=new Date(`${todayKey}T00:00:00`)
  const start=new Date(today);start.setDate(today.getDate()-today.getDay()-(weeks-1)*7)
  const counts=new Map(activity.map(a=>[a.day,a.count]))
  const days=Array.from({length:weeks*7},(_,i)=>{const date=new Date(start);date.setDate(start.getDate()+i);return {date,key:localDateKey(date),count:counts.get(localDateKey(date))??0,future:date>today}})
  const selected=pinned??hover
  useEffect(()=>{
    if(pinned===null)return
    const outside=(event:PointerEvent)=>{if(event.target instanceof Node && !root.current?.contains(event.target))setPinned(null)}
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.stopPropagation();setPinned(null);setHover(null)}}
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape,true)
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape,true)}
  },[pinned])
  const total=days.reduce((n,d)=>n+d.count,0),active=days.filter(d=>d.count>0).length
  return <div ref={root} className="min-w-0">
    {compact ? <p className="mt-3 text-sm text-gray">Last 12 weeks{saving ? ' - Updating...' : ''}</p> : <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 sm:ml-10">
      <PlannerSelect label="Activity date range" value={String(weeks)} onChange={value=>{setWeeks(Number(value));setPinned(null);setHover(null)}} options={[{value:'4',label:'Last 4 weeks'},{value:'12',label:'Last 12 weeks'},{value:'26',label:'Last 26 weeks'}]} />
      <p className="text-sm text-gray">{start.toLocaleDateString('en',{month:'short',day:'numeric',...(start.getFullYear()!==today.getFullYear()?{year:'numeric' as const}:{})})} - {today.toLocaleDateString('en',{month:'short',day:'numeric',year:'numeric'})}{saving ? ' - Updating...' : ''}</p>
    </div>}
    <div className={compact ? '' : 'mt-6'}>
    {!compact && <div className="ml-10 grid gap-1 text-sm text-gray" style={{gridTemplateColumns:`repeat(${weeks},minmax(0,1fr))`}} aria-hidden="true">{Array.from({length:weeks},(_,week)=>{const day=days[week*7].date; const previous=week ? days[(week-1)*7].date : null; return <span key={week}>{!previous || previous.getMonth()!==day.getMonth() ? day.toLocaleDateString('en',{month:'short'}) : ''}</span>})}</div>}
    <div className={compact ? '' : 'grid grid-cols-[2rem_minmax(0,1fr)] gap-2'}>
    {!compact && <div className="mt-4 grid grid-rows-7 items-center gap-1 text-xs text-gray sm:text-sm" aria-hidden="true">{['','Mon','','Wed','','Fri',''].map((day,i)=><span key={i}>{day}</span>)}</div>}
    <div className="relative mt-4">
      <div className={`grid grid-flow-col grid-rows-7 ${compact?'gap-[3px]':'gap-1 sm:gap-1.5'}`} style={{gridTemplateColumns:`repeat(${weeks},minmax(0,1fr))`}} aria-label="Daily task completions">
        {days.map((day,index)=><button key={day.key} disabled={day.future} type="button" onMouseEnter={()=>setHover(index)} onMouseLeave={()=>setHover(null)} onFocus={()=>setHover(index)} onBlur={()=>setHover(null)} onClick={()=>{setPinned(pinned===index?null:index);setHover(null)}} aria-pressed={pinned===index} aria-label={`${day.date.toLocaleDateString('en',{month:'long',day:'numeric',year:'numeric'})}: ${day.count} tasks completed${day.future?', future date':''}`} className={`${compact ? "aspect-square" : "h-5 sm:h-7"} min-w-0 rounded-[4px] border border-white/50 outline-offset-2 focus-visible:outline-2 focus-visible:outline-blue ${pinned===index?'ring-2 ring-blue':''} disabled:opacity-25`} style={{backgroundColor:shades[Math.min(day.count,4)]}}/>) }
      </div>
      {/* Screen-reader-friendly list of active days */}
      {!compact && <ul className="sr-only">
        {days.filter(d=>d.count>0).map(d=><li key={d.key}>{d.date.toLocaleDateString('en',{month:'long',day:'numeric',year:'numeric'})}: {d.count} {d.count===1?'task':'tasks'} completed</li>)}
        {days.filter(d=>d.count>0).length===0 && <li>No completed tasks recorded in this period.</li>}
      </ul>}
      {selected!==null && <div role={pinned!==null?'dialog':'tooltip'} aria-label="Activity for selected day" className="absolute z-30 w-max max-w-full rounded-md border border-dark-blue/30 bg-surface px-3 py-2 text-dark-blue shadow-md" style={{left:`clamp(0px, ${Math.floor(selected/7)/weeks*100}%, max(0px, calc(100% - 250px)))`,bottom:`${(7-(selected%7))/7*100}%`,marginBottom:7,pointerEvents:pinned===null?'none':'auto'}}>
        <div className="flex items-center gap-2"><p className="text-xs sm:text-sm">{days[selected].date.toLocaleDateString('en',{month:'long',day:'numeric',year:'numeric'})} &middot; {days[selected].count} {days[selected].count===1?'task':'tasks'} completed</p>{pinned!==null && <button type="button" aria-label="Close day details" onClick={()=>{setPinned(null);setHover(null)}} className="px-1 text-lg leading-none text-link">&times;</button>}</div>
      </div>}
    </div>
    </div>
    {!compact && <div className="mt-5 flex items-center justify-end gap-2 text-xs text-gray" aria-label="Darker green means more tasks completed"><span className="mr-1">Fewer</span>{shades.map(shade=><span key={shade} className="h-3.5 w-3.5 rounded-sm" style={{backgroundColor:shade}}/>)}<span className="ml-1">More</span></div>}
    </div>
    {compact ? <div className="mt-4 grid grid-cols-2 divide-x divide-dark-blue/10"><div><p className="text-xl font-semibold">{total}</p><p className="text-xs text-gray">tasks completed</p></div><div className="pl-3"><p className="text-xl font-semibold">{active}</p><p className="text-xs text-gray">days with activity</p></div></div> : <div className="mt-7 grid grid-cols-2 border-t border-dark-blue/25 pt-6 text-center">
      <div className="border-r border-dark-blue/25 px-2"><p className="text-sm text-gray sm:text-base">Tasks completed</p><p className="mt-1 text-2xl font-semibold sm:text-3xl">{total}</p></div>
      <div className="px-2"><p className="text-sm text-gray sm:text-base">Days with activity</p><p className="mt-1 text-2xl font-semibold sm:text-3xl">{active}</p></div>
    </div>}

  </div>
}
