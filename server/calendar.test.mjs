import test from 'node:test'
import assert from 'node:assert/strict'
import {calendarDate, dateKey, parseCalendarDate, monthDates, weekDates, moveCalendar, indexCalendarTasks} from '../src/features/tasks/calendarDates.ts'

test('month and week grids cross year boundaries without losing or repeating dates',()=>{
  const dates=monthDates(calendarDate(2026,11))
  assert.equal(dates.length,35)
  assert.equal(dates[0].getDay(),0)
  assert.equal(new Set(dates.map(dateKey)).size,35)
  assert.ok(dates.some(date=>dateKey(date)==='2027-01-01'))
  assert.deepEqual(weekDates(calendarDate(2027,0,1)).map(dateKey),['2026-12-27','2026-12-28','2026-12-29','2026-12-30','2026-12-31','2027-01-01','2027-01-02'])
})
test('navigation clamps month-end dates and handles leap years across centuries',()=>{
  assert.equal(dateKey(moveCalendar(calendarDate(2028,0,31),'month',1)),'2028-02-29')
  assert.equal(dateKey(moveCalendar(calendarDate(2028,1,29),'year',1)),'2029-02-28')
  assert.ok(parseCalendarDate('2400-02-29'))
  assert.equal(parseCalendarDate('2100-02-29'),null)
  assert.equal(parseCalendarDate('2026-02-30'),null)
  assert.equal(dateKey(moveCalendar(calendarDate(2030,11,31),'day',1)),'2031-01-01')
})
test('calendar indexing keeps all same-day tasks, completed tasks, and undated tasks',()=>{
  const tasks=[{title:'Late',dueDate:'2040-11-30',dueTime:'23:59'},{title:'Done',done:true,dueDate:'2040-11-30',dueTime:'08:00'},{title:'Any time',dueDate:'2040-11-30'},{title:'Undated',dueDate:''},{title:'Invalid',dueDate:'2040-13-01'}]
  const {byDate,undated}=indexCalendarTasks(tasks)
  assert.deepEqual(byDate.get('2040-11-30').map(task=>task.title),['Done','Late','Any time'])
  assert.deepEqual(undated.map(task=>task.title),['Undated','Invalid'])
  assert.equal(byDate.get('2040-11-30')[0].done,true)
  assert.equal(tasks[0].title,'Late')
})
test('date generation stays local across daylight saving changes',()=>{
  const old=process.env.TZ
  try {
    process.env.TZ='America/New_York'
    const days=weekDates(calendarDate(2027,2,14)).map(dateKey)
    assert.equal(new Set(days).size,7)
    assert.equal(days[0],'2027-03-14')
    assert.equal(dateKey(moveCalendar(calendarDate(2027,2,14),'day',1)),'2027-03-15')
  }finally {if(old===undefined)delete process.env.TZ;else process.env.TZ=old}
})
