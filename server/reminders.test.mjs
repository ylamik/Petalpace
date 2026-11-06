import test from 'node:test'
import assert from 'node:assert/strict'
import { createAuthStore } from './auth-store.mjs'
import { createPlannerHandler } from './planner.mjs'
import { createReminderWorker } from './reminders.mjs'
import { deadlineInstant, dateInZone, taskIdentity } from '../src/features/tasks/deadlineZone.ts'
test('fixed-zone deadlines survive travel, DST gaps, overlaps and future years',()=>{
 assert.equal(new Date(deadlineInstant('2026-11-30','23:59','Asia/Manila')).toISOString(),'2026-11-30T15:59:00.000Z')
 assert.equal(deadlineInstant('2026-03-08','02:30','America/New_York'),null)
 assert.equal(new Date(deadlineInstant('2026-11-01','01:30','America/New_York')).toISOString(),'2026-11-01T05:30:00.000Z')
 assert.ok(deadlineInstant('2400-02-29','12:00','Asia/Manila'))
 assert.equal(deadlineInstant('2100-02-29','12:00','Asia/Manila'),null)
 assert.equal(dateInZone(new Date('2026-11-02T18:00Z'),'Asia/Manila'),'2026-11-03')
 const task={title:' My task ',space:'School',priority:'High',dueDate:'2026-11-03'}
 assert.equal(taskIdentity(task),taskIdentity({...task,title:'my TASK'}))
 assert.notEqual(taskIdentity(task),taskIdentity({...task,dueDate:'2026-11-04'}))
})
test('email reminders opt in, skip active work, deduplicate restarts and retry safely',async()=>{
 const db=createAuthStore();let clock=Date.parse('2026-11-03T00:00Z'),messages=[],fails=true
 db.prepare('INSERT INTO users VALUES(?,?,?,?,1)').run('u','u@example.com','User','hash')
 createPlannerHandler({db,findSession:()=>null,origins:[],limit:()=>{}})
 const task={id:'task',title:'<Task>',dueDate:'2026-11-04',dueTime:'08:00',dueZone:'Asia/Manila',done:false}
 db.prepare('INSERT INTO planners VALUES(?,?,?)').run('u',1,JSON.stringify({spaces:[],tasks:[task,{...task,id:'started',started:true},{...task,id:'done',done:true}]}))
 const opts={db,now:()=>clock,env:{RESEND_API_KEY:'test-only',AUTH_FROM:'test@example.com',APP_URL:'https://petalpace.example'},send:async(url,request)=>{messages.push({body:request.body,key:request.headers['Idempotency-Key']});return {ok:!fails,json:async()=>fails?{}:{id:'accepted'}}}}
 let run=createReminderWorker(opts);await run();assert.equal(messages.length,0)
 db.prepare('INSERT INTO reminder_settings VALUES(?,?,?)').run('u',1,'Asia/Manila')
 await run();assert.equal(messages.length,1);assert.match(JSON.parse(messages[0].body).html,/&lt;Task&gt;/)
 await run();assert.equal(messages.length,1)
 clock+=16*60000;fails=false;run=createReminderWorker(opts);await run();assert.equal(messages.length,2);assert.deepEqual(messages[0],messages[1])
 await run();assert.equal(messages.length,2)
 clock+=86400000;await run();assert.equal(messages.length,3);assert.match(JSON.parse(messages[2].body).subject,/passed/)
 await run();assert.equal(messages.length,3)
 db.close()
})
test('reminder scans read planner JSON only after its revision changes',async()=>{
 const db=createAuthStore();const clock=Date.parse('2026-11-03T00:00Z');let messages=0,reads=0
 db.prepare('INSERT INTO users VALUES(?,?,?,?,1)').run('u','u@example.com','User','hash')
 createPlannerHandler({db,findSession:()=>null,origins:[],limit:()=>{}})
 const prepare=db.prepare.bind(db)
 db.prepare=sql=>{if(sql.startsWith('SELECT data FROM planners'))reads++;return prepare(sql)}
 const task={id:'task',title:'Essay',dueDate:'2026-11-04',dueTime:'08:00',dueZone:'Asia/Manila',done:false}
 const save=(revision,tasks)=>prepare('INSERT INTO planners VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET revision=excluded.revision,data=excluded.data').run('u',revision,JSON.stringify({spaces:[],tasks}))
 save(1,[task])
 const run=createReminderWorker({db,now:()=>clock,env:{RESEND_API_KEY:'test-only',AUTH_FROM:'test@example.com'},send:async()=>{messages++;return {ok:true,json:async()=>({id:'sent'})}}})
 prepare('INSERT INTO reminder_settings VALUES(?,?,?)').run('u',1,'Asia/Manila')
 await run();await run();await run()
 assert.equal(reads,1);assert.equal(messages,1)
 save(2,[task,{...task,id:'next',title:'Report'}])
 await run();await run()
 assert.equal(reads,2);assert.equal(messages,2)
 save(3,[{...task,id:'next',title:'Report',done:true},{...task,id:'late',title:'Slides'}])
 await run();assert.equal(reads,3);assert.equal(messages,3)
 prepare('DELETE FROM planners WHERE user_id=?').run('u')
 await run();assert.equal(reads,3);assert.equal(messages,3)
 db.close()
})
