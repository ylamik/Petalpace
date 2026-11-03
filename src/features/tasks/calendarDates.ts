export type CalendarView = 'month' | 'week' | 'day' | 'year'
export function calendarDate(year: number, month: number, day = 1) {
  const date = new Date(2000, 0, 1, 12)
  date.setFullYear(year, month, day)
  return date
}
export function dateKey(date: Date) {
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export function parseCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = calendarDate(year, month - 1, day)
  return year >= 1 && year <= 9999 && dateKey(date) === value ? date : null
}
export function addDays(date: Date, count: number) {
  return calendarDate(date.getFullYear(), date.getMonth(), date.getDate() + count)
}
export function weekDates(date: Date) {
  const start = addDays(date, -date.getDay())
  return Array.from({length: 7}, (_, index) => addDays(start, index))
}
export function monthDates(date: Date) {
  const first = calendarDate(date.getFullYear(), date.getMonth())
  const start = weekDates(first)[0]
  const days = calendarDate(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  const count = Math.ceil((first.getDay() + days) / 7) * 7
  return Array.from({length: count}, (_, index) => addDays(start, index))
}
export function moveCalendar(date: Date, view: CalendarView, direction: number) {
  if (view === 'day' || view === 'week') return addDays(date, direction * (view === 'week' ? 7 : 1))
  const target = calendarDate(date.getFullYear() + (view === 'year' ? direction : 0), date.getMonth() + (view === 'month' ? direction : 0))
  const last = calendarDate(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  return calendarDate(target.getFullYear(), target.getMonth(), Math.min(date.getDate(), last))
}
export function indexCalendarTasks<T extends {dueDate?: string; dueTime?: string; title: string}>(tasks: T[]) {
  const byDate = new Map<string, T[]>()
  const undated: T[] = []
  for (const task of tasks) {
    if (!task.dueDate || !parseCalendarDate(task.dueDate)) { undated.push(task); continue }
    const list = byDate.get(task.dueDate) ?? []
    list.push(task)
    byDate.set(task.dueDate, list)
  }
  for (const list of byDate.values()) list.sort((a,b) => (a.dueTime || '99:99').localeCompare(b.dueTime || '99:99') || a.title.localeCompare(b.title))
  return {byDate, undated}
}
