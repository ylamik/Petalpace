import { useId, useState } from 'react'
import { TITLE_LIMIT, limitTaskTitle } from './taskPresentation'
export default function TaskTitleInput({value,onChange,autoFocus=false}: {value:string;onChange:(value:string)=>void;autoFocus?:boolean}) {
  const id=useId()
  const [exceeded,setExceeded]=useState(false)
  const count=Array.from(value).length
  return <div className="min-w-0">
    <label htmlFor={id} className="mb-1 block text-sm font-semibold">Task title</label>
    <input id={id} autoFocus={autoFocus} required value={value} aria-describedby={`${id}-hint`} onChange={event=>{setExceeded(Array.from(event.target.value).length>TITLE_LIMIT);onChange(limitTaskTitle(event.target.value))}} className="min-h-11 w-full min-w-0 rounded-lg border border-dark-blue/20 bg-surface px-3 text-base focus:outline-blue"/>
    <p id={`${id}-hint`} aria-live="polite" className={`mt-1 text-xs ${exceeded || count===TITLE_LIMIT ? 'text-red' : 'text-gray'}`}>{count}/{TITLE_LIMIT} characters{exceeded ? ' · Title limit reached. Extra characters were not added.' : count===TITLE_LIMIT ? ' · Title limit reached.' : ''}</p>
  </div>
}
