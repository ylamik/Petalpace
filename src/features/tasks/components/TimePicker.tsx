import { useId, useState } from 'react'

type NumberProps = { label:string; value:string; min:number; max:number; placeholder:string; onChange:(value:number)=>void }
function TimeNumber({label,value,min,max,placeholder,onChange}:NumberProps) {
  const [editing,setEditing]=useState(false)
  const [draft,setDraft]=useState('')
  function step(amount:number) {
    const current=Number(value || (min===1?'12':'0'))
    const next=current+amount>max?min:current+amount<min?max:current+amount
    onChange(next);setDraft(String(next).padStart(2,'0'))
  }
  return <div className="flex min-w-0 items-center overflow-hidden rounded-md border border-dark-blue/25 bg-surface focus-within:ring-2 focus-within:ring-blue/30">
    <input type="text" role="spinbutton" inputMode="numeric" aria-label={label} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value?Number(value):undefined} maxLength={2} placeholder={placeholder} value={editing?draft:value} onFocus={event=>{setEditing(true);setDraft(value);event.currentTarget.select()}} onBlur={()=>{setEditing(false)}} onChange={event=>{const raw=event.target.value;if(!/^\d{0,2}$/.test(raw) || Number(raw)>max)return;setDraft(raw);if(raw && Number(raw)>=min)onChange(Number(raw))}} onKeyDown={event=>{if(event.key==='ArrowUp' || event.key==='ArrowDown'){event.preventDefault();step(event.key==='ArrowUp'?1:-1)}}} className="h-12 w-full min-w-0 bg-transparent px-2 text-center text-base text-dark-blue outline-none placeholder:text-gray"/>
    <div className="flex shrink-0 flex-col border-l border-dark-blue/15"><button type="button" aria-label={`Increase ${label.toLowerCase()}`} onClick={()=>step(1)} className="flex h-6 w-7 items-center justify-center text-link hover:bg-beige focus-visible:outline-blue"><svg aria-hidden="true" width="12" height="8" viewBox="0 0 12 8" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="m2 6 4-4 4 4"/></svg></button><button type="button" aria-label={`Decrease ${label.toLowerCase()}`} onClick={()=>step(-1)} className="flex h-6 w-7 items-center justify-center text-link hover:bg-beige focus-visible:outline-blue"><svg aria-hidden="true" width="12" height="8" viewBox="0 0 12 8" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="m2 2 4 4 4-4"/></svg></button></div>
  </div>
}
export default function TimePicker({value,onChange,disabled=false}:{value:string;onChange:(value:string)=>void;disabled?:boolean}) {
  const id=useId()
  const hour24=value?Number(value.slice(0,2)):0
  const hour=hour24%12 || 12, minute=value?Number(value.slice(3)):0, period=hour24>=12?'PM':'AM'
  function update(nextHour=hour,nextMinute=minute,nextPeriod=period) {
    onChange(`${String(nextHour%12+(nextPeriod==='PM'?12:0)).padStart(2,'0')}:${String(nextMinute).padStart(2,'0')}`)
  }
  return <fieldset disabled={disabled} aria-describedby={id} className="min-w-0 disabled:opacity-60">
    <legend className="mb-2 text-sm font-medium">Due time <span className="font-normal text-gray">(optional)</span></legend>
    <div className="grid w-full max-w-[300px] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_4rem] items-center gap-1.5">
      <TimeNumber label="Hour" value={value?String(hour).padStart(2,'0'):''} placeholder="HH" min={1} max={12} onChange={next=>update(next)}/>
      <span aria-hidden="true">:</span>
      <TimeNumber label="Minute" value={value?String(minute).padStart(2,'0'):''} placeholder="MM" min={0} max={59} onChange={next=>update(hour,next)}/>
      <div className="grid grid-rows-2 gap-1">{['AM','PM'].map(item=><button type="button" key={item} aria-pressed={!!value && period===item} onClick={()=>update(hour,minute,item)} className={`min-h-6 rounded border px-2 text-sm font-medium focus-visible:outline-blue ${value && period===item?'border-blue bg-lightest-blue text-dark-blue':'border-dark-blue/20 bg-surface text-gray hover:bg-beige'}`}>{item}</button>)}</div>
    </div>
    <p id={id} className="mt-2 text-xs text-gray">{disabled?'Choose a due date first.':'Type a time or use the arrows. Deadlines follow local time on each device (including when you travel).'}</p>
    {value && <button type="button" onClick={()=>onChange('')} className="mt-1 min-h-9 text-sm text-link underline underline-offset-2">Clear time</button>}
  </fieldset>
}
