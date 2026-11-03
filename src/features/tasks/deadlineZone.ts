export function validZone(zone: unknown): zone is string {
  if (typeof zone !== 'string' || !zone || zone.length > 100) return false
  try { new Intl.DateTimeFormat('en', {timeZone:zone}).format(); return true } catch { return false }
}
export function dateInZone(now: Date, zone: string) {
  const parts = new Intl.DateTimeFormat('en', {timeZone:zone, year:'numeric', month:'2-digit', day:'2-digit'}).formatToParts(now)
  return ['year','month','day'].map(k=>parts.find(p=>p.type===k)!.value).join('-')
}
// Convert a wall-clock deadline in an IANA zone into an instant. Gaps during
// daylight-saving transitions are rejected; overlaps use the earlier instant.
export function deadlineInstant(date: string, time = '', zone = 'UTC'): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !validZone(zone) || (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) return null
  const target = `${date}T${time || '23:59'}:00`
  const wall = Date.parse(target+'Z')
  if (!Number.isFinite(wall) || new Date(wall).toISOString().slice(0,10)!==date) return null
  const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'})
  const local=(n:number)=>{const p=formatter.formatToParts(new Date(n));return ['year','month','day'].map(k=>p.find(x=>x.type===k)!.value).join('-')+'T'+['hour','minute','second'].map(k=>p.find(x=>x.type===k)!.value).join(':')}
  const offsets=new Set([-86400000,0,86400000].map(delta=>Date.parse(local(wall+delta)+'Z')-(wall+delta)))
  const matches=[...offsets].map(offset=>wall-offset).filter(n=>local(n)===target).sort((a,b)=>a-b)
  return matches.length ? matches[0]+(time?0:59999) : null
}
export function taskIdentity(task:{title:string;space?:string;priority:string;dueDate?:string;dueTime?:string;dueZone?:string}) {
  return JSON.stringify([task.title.trim().replace(/\s+/g,' ').toLocaleLowerCase('en'),task.space?.trim().toLocaleLowerCase('en'),task.priority,task.dueDate || '',task.dueTime || '',task.dueZone || ''])
}
