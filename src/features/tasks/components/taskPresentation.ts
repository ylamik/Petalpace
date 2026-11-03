export type TaskStatus = 'todo' | 'progress' | 'done' | 'blocked'
export type TaskState = { done: boolean; started?: boolean; blocked?: boolean }
export function getStatus(task: TaskState): TaskStatus {
  return task.done ? 'done' : task.blocked ? 'blocked' : task.started ? 'progress' : 'todo'
}
export function statusChange(status: string): TaskState {
  return { done: status === 'done', started: status === 'progress', blocked: status === 'blocked' }
}
export function localDateKey(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
export function daysUntil(date?: string, now = new Date()) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const [y, m, d] = date.split('-').map(Number)
  const parsed = new Date(Date.UTC(y, m - 1, d))
  if (parsed.getUTCFullYear() !== y || parsed.getUTCMonth() !== m - 1 || parsed.getUTCDate() !== d) return null
  return Math.round((parsed.getTime() - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000)
}
export function effectiveDue(task: {dueDate?: string; dueToday?: boolean}) {
  return task.dueDate || (task.dueToday ? localDateKey() : '')
}
export function matchesDeadline(task: {dueDate?: string; dueTime?:string; dueToday?: boolean}, filter: string) {
  const days = daysUntil(effectiveDue(task))
  if (filter === 'none') return days === null
  if (filter === 'overdue') return isDeadlineOverdue(task)
  if (filter === 'soon') return days !== null && days >= 0 && days <= 3
  if (filter === 'week') return days !== null && days >= 0 && days <= 7
  return true
}
export function compareTasks(a: {title: string; priority: string; dueDate?: string; dueTime?:string; dueToday?: boolean}, b: typeof a, sort: string) {
  if (sort === 'title') return a.title.localeCompare(b.title)
  if (sort === 'priority') return ['High','Medium','Low'].indexOf(a.priority) - ['High','Medium','Low'].indexOf(b.priority)
  const ad = effectiveDue(a), bd = effectiveDue(b)
  if (!ad || !bd) return !ad && !bd ? 0 : !ad ? 1 : -1
  const aKey = `${ad}T${a.dueTime || '23:59:59'}`, bKey = `${bd}T${b.dueTime || '23:59:59'}`
  return sort === 'farthest' ? bKey.localeCompare(aKey) : aKey.localeCompare(bKey)
}
export function remapCompleted(oldSteps: string[], nextSteps: string[], completed: number[] = []) {
  const used = new Set<number>()
  return nextSteps.flatMap((step, index) => {
    const old = oldSteps.findIndex((text, i) => text === step && !used.has(i))
    if (old < 0) return []
    used.add(old)
    return completed.includes(old) ? [index] : []
  })
}

export const TITLE_LIMIT = 160
export function limitTaskTitle(value: string) { return Array.from(value).slice(0, TITLE_LIMIT).join('') }
export function needsStatusConfirmation(from: TaskStatus, to: TaskStatus) {
  return from !== to && (from === 'done' || to === 'done')
}

export function validDueTime(time?: string) {
  return !time || /^([01]\d|2[0-3]):[0-5]\d$/.test(time)
}
export function isDeadlineOverdue(task: {dueDate?:string;dueTime?:string;dueToday?:boolean}, now=new Date()) {
  const date=effectiveDue(task)
  const days=daysUntil(date,now)
  if(days===null)return false
  if(days!==0)return days<0
  return !!task.dueTime && validDueTime(task.dueTime) && new Date(`${date}T${task.dueTime}:00`).getTime()<now.getTime()
}
export function deadlineText(task: {dueDate?:string;dueTime?:string;dueToday?:boolean;done?:boolean}, now=new Date()) {
  const date=effectiveDue(task), days=daysUntil(date,now)
  if(days===null)return 'No due date'
  const day=days===0?'Today':days===1?'Tomorrow':new Date(`${date}T12:00:00`).toLocaleDateString('en',{month:'short',day:'numeric',...(date.slice(0,4)!==String(now.getFullYear())?{year:'numeric' as const}:{})})
  const time=task.dueTime && validDueTime(task.dueTime) ? new Date(`${date}T${task.dueTime}:00`).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true}) : ''
  return `Due ${day}${time ? ` \u00b7 ${time}` : ''}${!task.done && isDeadlineOverdue(task,now)?' (overdue)':''}`
}

export function needsTaskReminder(task:TaskState & {dueDate?:string;pinned?:boolean},now=new Date()) {
  const days=daysUntil(task.dueDate,now)
  return getStatus(task)==='todo' && days!==null && days<=3
}

export function groupTasksByDeadline<T extends TaskState & {dueDate?:string;dueTime?:string;dueToday?:boolean}>(tasks:T[],now=new Date()) {
  return {
    active:tasks.filter(task=>!task.done && !isDeadlineOverdue(task,now)),
    missed:tasks.filter(task=>!task.done && isDeadlineOverdue(task,now)),
    completed:tasks.filter(task=>task.done),
  }
}
