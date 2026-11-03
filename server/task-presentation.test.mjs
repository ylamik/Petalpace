import test from 'node:test'
import assert from 'node:assert/strict'
import { deadlineText, isDeadlineOverdue, validDueTime, daysUntil, getStatus, statusChange, compareTasks, remapCompleted, matchesDeadline, localDateKey } from '../src/features/tasks/components/taskPresentation.ts'
test('statuses are exclusive and can be reopened from Done', () => {
  for (const status of ['todo','progress','done','blocked']) assert.equal(getStatus(statusChange(status)), status)
  assert.deepEqual(statusChange('todo'), {done:false,started:false,blocked:false})
})
test('deadline boundaries use calendar days, including overdue and missing dates', () => {
  const now = new Date(2026,10,1,23,59)
  assert.equal(daysUntil('2026-11-01',now),0)
  assert.equal(daysUntil('2026-11-04',now),3)
  assert.equal(daysUntil('2026-11-05',now),4)
  assert.equal(daysUntil('2026-10-31',now),-1)
  assert.equal(daysUntil('',now),null)
  assert.equal(daysUntil('2026-02-31',now),null)
})
test('deadline filters separate overdue from the next three days', () => {
  const today = new Date(), later = new Date(), past = new Date()
  later.setDate(later.getDate()+3); past.setDate(past.getDate()-1)
  assert.ok(matchesDeadline({dueDate:localDateKey(today)},'soon'))
  assert.ok(matchesDeadline({dueDate:localDateKey(later)},'soon'))
  assert.ok(!matchesDeadline({dueDate:localDateKey(past)},'soon'))
  assert.ok(matchesDeadline({dueDate:localDateKey(past)},'overdue'))
  assert.ok(matchesDeadline({},'none'))
})
test('deadline sort always leaves undated tasks last', () => {
  const tasks = [{title:'No date',priority:'Low'}, {title:'Later',priority:'High',dueDate:'2026-11-06'}, {title:'Soon',priority:'Medium',dueDate:'2026-11-02'}]
  assert.deepEqual([...tasks].sort((a,b)=>compareTasks(a,b,'nearest')).map(t=>t.title),['Soon','Later','No date'])
  assert.deepEqual([...tasks].sort((a,b)=>compareTasks(a,b,'farthest')).map(t=>t.title),['Later','Soon','No date'])
})
test('editing or removing steps does not transfer completion to another step', () => {
  assert.deepEqual(remapCompleted(['A','B','C'],['B','C'],[0,2]),[1])
  assert.deepEqual(remapCompleted(['A','A'],['A','A','A'],[1]),[1])
  assert.deepEqual(remapCompleted(['A'],['Edited'],[0]),[])
})

test('only transitions into or out of Done need confirmation', async () => {
  const { needsStatusConfirmation } = await import('../src/features/tasks/components/taskPresentation.ts')
  for (const from of ['todo','progress','blocked','done']) {
    for (const to of ['todo','progress','blocked','done']) {
      assert.equal(needsStatusConfirmation(from,to),from !== to && (from === 'done' || to === 'done'))
    }
  }
})
test('title limit blocks extra characters without splitting emoji', async () => {
  const { limitTaskTitle, TITLE_LIMIT } = await import('../src/features/tasks/components/taskPresentation.ts')
  assert.equal(limitTaskTitle('a'.repeat(200)), 'a'.repeat(TITLE_LIMIT))
  assert.equal(Array.from(limitTaskTitle('🌱'.repeat(200))).length,TITLE_LIMIT)
  assert.equal(limitTaskTitle('Short title'),'Short title')
})


test('deadline times show 12-hour labels and become overdue after the chosen minute',()=>{
  const task={dueDate:'2026-11-02',dueTime:'23:59'}
  assert.equal(deadlineText(task,new Date(2026,10,2,12,0)), 'Due Today \u00b7 11:59 PM')
  assert.equal(isDeadlineOverdue(task,new Date(2026,10,2,23,58)),false)
  assert.equal(isDeadlineOverdue(task,new Date(2026,10,2,23,59,1)),true)
  assert.equal(isDeadlineOverdue({dueDate:'2026-11-02'},new Date(2026,10,2,23,59,59)),false)
  assert.equal(isDeadlineOverdue({dueDate:'2026-11-02'},new Date(2026,10,3,0,0)),true)
  assert.ok(!deadlineText({...task,done:true},new Date(2026,10,3)).startsWith('Overdue'))
  for(const invalid of ['24:00','12:60','9:00','10:00:30','abc'])assert.equal(validDueTime(invalid),false)
  assert.equal(validDueTime('00:00'),true)
})
test('deadline sort includes time within each date; date-only tasks finish the day',()=>{
  const base={title:'Task',priority:'Low',dueDate:'2026-11-02'}
  const tasks=[{...base,dueTime:''},{...base,dueTime:'23:59'},{...base,dueTime:'08:30'}]
  assert.deepEqual([...tasks].sort((a,b)=>compareTasks(a,b,'nearest')).map(t=>t.dueTime),['08:30','23:59',''])
  assert.deepEqual([...tasks].sort((a,b)=>compareTasks(a,b,'farthest')).map(t=>t.dueTime),['','23:59','08:30'])
})


test('reminders cover to-do tasks due soon, never in-progress, done, or blocked',async()=>{
  const {needsTaskReminder}=await import('../src/features/tasks/components/taskPresentation.ts')
  const now=new Date(2026,10,2,12)
  for(const date of ['2026-11-01','2026-11-02','2026-11-05']) assert.ok(needsTaskReminder({done:false,dueDate:date},now))
  assert.ok(!needsTaskReminder({done:false,dueDate:'2026-11-06'},now))
  assert.ok(!needsTaskReminder({done:false},now))
  assert.ok(!needsTaskReminder({done:false,pinned:true},now))
  for(const status of ['progress','done','blocked']) assert.ok(!needsTaskReminder({...statusChange(status),pinned:true,dueDate:'2026-11-01'},now))
})


test('missed deadlines form a separate group, preserve status, and move after completion or rescheduling',async()=>{
  const {groupTasksByDeadline}=await import('../src/features/tasks/components/taskPresentation.ts')
  const now=new Date(2026,10,2,12)
  const past={id:'past',done:false,started:true,dueDate:'2026-11-01'}
  const timed={id:'timed',done:false,dueDate:'2026-11-02',dueTime:'11:59'}
  const today={id:'today',done:false,dueDate:'2026-11-02'}
  const completed={id:'done',done:true,dueDate:'2026-11-01'}
  const groups=groupTasksByDeadline([past,timed,today,completed,{id:'undated',done:false}],now)
  assert.deepEqual(groups.active.map(t=>t.id),['today','undated'])
  assert.deepEqual(groups.missed.map(t=>t.id),['past','timed'])
  assert.deepEqual(groups.completed.map(t=>t.id),['done'])
  assert.equal(groups.missed[0].started,true)
  assert.equal(groupTasksByDeadline([{...past,done:true}],now).completed.length,1)
  assert.equal(groupTasksByDeadline([{...past,dueDate:'2026-11-03'}],now).active.length,1)
  assert.equal(groupTasksByDeadline([timed],new Date(2026,10,2,11,58)).active.length,1)
})
