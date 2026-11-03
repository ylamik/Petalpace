import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createHash } from 'node:crypto'
import { mkdtempSync,rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createAuthStore } from './auth-store.mjs'
import { createAuthHandler } from './auth.mjs'
import { validatePlanner } from './planner.mjs'
const task=(changes={})=>({id:'task-1',title:changes.id?`Read notes ${changes.id}`:'Read notes',space:'School',priority:'Medium',dueDate:'',notes:'',steps:[],completedSteps:[],files:[],links:[],pinned:false,done:false,...changes})
async function fixture(t,path=':memory:',cleanup=()=>{}){
  const db=createAuthStore(path);let clock=Date.UTC(2026,10,1,12)
  const tokens=['a'.repeat(64),'b'.repeat(64)]
  tokens.forEach((token,i)=>{
    db.prepare('INSERT OR IGNORE INTO users(id,email,name,password_hash,verified) VALUES(?,?,?,?,1)').run('user'+i,`u${i}@example.com`,'Example','unused-test-hash')
    db.prepare('INSERT OR REPLACE INTO sessions(hash,user_id,expires) VALUES(?,?,?)').run(createHash('sha256').update(token).digest('hex'),'user'+i,clock+10*86400000)
  })
  const handler=createAuthHandler({db,env:{APP_URL:'http://localhost:5173'},now:()=>clock})
  const server=createServer(handler);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));db.close();cleanup()})
  const request=async(data,user=0,origin='http://localhost:5173')=>{
    const response=await fetch(`http://127.0.0.1:${server.address().port}/api/auth/planner`,{method:data?'PUT':'GET',headers:{...(user===null?{}:{cookie:`petalpace_session=${tokens[user]}`}),...(data?{'content-type':'application/json',origin}:{})},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(5000)})
    return {status:response.status,body:await response.json()}
  }
  return {request,db,advance:days=>{clock+=days*86400000}}
}
test('new accounts start empty; spaces/tasks/files persist and remain isolated',async t=>{
  const directory=mkdtempSync(join(tmpdir(),'petalpace-planner-test-')),path=join(directory,'test.sqlite')
  const f=await fixture(t,path,()=>rmSync(directory,{recursive:true,force:true})),first=await f.request()
  assert.equal(first.status,200);assert.deepEqual(first.body.tasks,[]);assert.deepEqual(first.body.activity,[])
  const custom={id:'custom',name:'Work',color:'#123456'}
  const file={name:'notes.pdf',type:'application/pdf',lastModified:1,data:Buffer.from('%PDF-test').toString('base64')}
  const saved=await f.request({...first.body,spaces:[...first.body.spaces,custom],tasks:[task({space:'Work',files:[file],links:['https://example.com']})],user_id:'user1'})
  assert.equal(saved.status,200)
  const other=await f.request(undefined,1);assert.deepEqual(other.body.tasks,[])
  const reread=createAuthStore(path)
  assert.equal(JSON.parse(reread.prepare('SELECT data FROM planners WHERE user_id=?').get('user0').data).tasks[0].files[0].data,file.data);reread.close()
  const own=await f.request();assert.equal(own.body.tasks[0].spaceId,'custom');assert.equal(own.body.spaces.at(-1).color,'#123456')
})
test('heatmap counts real transitions, not edits; reopening removes count, deletion preserves history',async t=>{
  const f=await fixture(t);let state=(await f.request()).body
  async function save(tasks){const result=await f.request({...state,tasks,timeZone:'Asia/Manila'});assert.equal(result.status,200);state={...state,tasks,revision:result.body.revision};return result.body.activity}
  assert.deepEqual(await save([task()]),[])
  assert.deepEqual(await save([task({done:true})]),[{day:'2026-11-01',count:1}])
  f.advance(1)
  assert.deepEqual(await save([task({done:true,title:'Changed title'})]),[{day:'2026-11-01',count:1}])
  assert.deepEqual(await save([task()]),[])
  assert.deepEqual(await save([task({done:true})]),[{day:'2026-11-02',count:1}])
  assert.deepEqual(await save([]),[{day:'2026-11-02',count:1}])
})
test('stale revisions, missing session and foreign origins cannot overwrite data',async t=>{
  const f=await fixture(t);const state=(await f.request()).body
  assert.equal((await f.request(undefined,null)).status,401)
  assert.equal((await f.request({...state,tasks:[task()]},0,'https://evil.example')).status,403)
  assert.equal((await f.request({...state,tasks:[task()]})).status,200)
  assert.equal((await f.request({...state,tasks:[]})).status,409)
  assert.equal((await f.request()).body.tasks.length,1)
})
test('unsafe links, invalid dates/title, excess pins and invalid attachments are rejected',async t=>{
  const f=await fixture(t),state=(await f.request()).body
  for(const bad of [task({title:'x'.repeat(161)}),task({dueDate:'2026-13-01'}),task({space:'Missing'}),task({links:['javascript:alert(1)']}),task({files:[{name:'run.html',type:'text/html',data:'AAAA'}]}),task({files:[{name:'fake.pdf',type:'application/pdf',data:Buffer.from('not-a-real-pdf').toString('base64')}]})]) assert.equal((await f.request({...state,tasks:[bad]})).status,400)
  assert.equal((await f.request({...state,tasks:Array.from({length:4},(_,i)=>task({id:String(i),pinned:true}))})).status,400)
  const text="Robert'); DROP TABLE users;--"
  assert.equal((await f.request({...state,tasks:[task({title:text})]})).status,200)
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM users').get().n,2)
})
test('attachment removal is saved without affecting another account',async t=>{
  const f=await fixture(t);let state=(await f.request()).body
  const file={name:'notes.pdf',type:'application/pdf',lastModified:1,data:Buffer.from('%PDF-test').toString('base64')}
  let result=await f.request({...state,tasks:[task({files:[file],links:['https://example.com']})]});assert.equal(result.status,200)
  state=(await f.request()).body
  result=await f.request({...state,tasks:[task()]});assert.equal(result.status,200)
  assert.deepEqual((await f.request()).body.tasks[0].files,[])
  assert.deepEqual((await f.request()).body.tasks[0].links,[])
})
test('validator normalizes task space IDs and counts title characters',()=>{
  const data={revision:0,spaces:[{id:'school',name:'School',color:'#123456'}],tasks:[task({title:'🌱'.repeat(160),spaceId:'other-user-space'})]}
  assert.equal(validatePlanner(data).tasks[0].spaceId,'school')
})


test('deleting a space moves tasks atomically and preserves attachments and completion history',async t=>{
  const f=await fixture(t)
  let state=(await f.request()).body
  const file={name:'notes.pdf',type:'application/pdf',lastModified:1,data:Buffer.from('%PDF-test').toString('base64')}
  assert.equal((await f.request({...state,tasks:[task({done:true,files:[file],links:['https://example.com']})]})).status,200)
  state=(await f.request()).body
  const spaces=state.spaces.filter(space=>space.id!=='school')
  // A space cannot be removed while its tasks still point to it.
  assert.equal((await f.request({...state,spaces})).status,400)
  assert.ok((await f.request()).body.spaces.some(space=>space.id==='school'))
  const result=await f.request({...state,spaces,tasks:state.tasks.map(item=>({...item,space:'Personal',spaceId:'personal'}))})
  assert.equal(result.status,200)
  const restored=(await f.request()).body
  assert.equal(restored.spaces.some(space=>space.id==='school'),false)
  assert.equal(restored.tasks[0].spaceId,'personal')
  assert.deepEqual(restored.tasks[0].files,[file])
  assert.deepEqual(restored.tasks[0].links,['https://example.com'])
  assert.deepEqual(restored.activity,state.activity)
  assert.ok((await f.request(undefined,1)).body.spaces.some(space=>space.id==='school'))
  assert.equal((await f.request({...state,spaces:[],tasks:[]})).status,409)
})

test('deleting the last empty space persists without restoring default spaces',async t=>{
  const f=await fixture(t)
  const state=(await f.request()).body
  assert.equal((await f.request({...state,spaces:[],tasks:[]})).status,200)
  assert.deepEqual((await f.request()).body.spaces,[])
})


test('deadline times persist, can be edited or cleared, and require a date',async t=>{
  const f=await fixture(t);let state=(await f.request()).body
  for(const dueTime of ['23:59','00:00','']) {
    assert.equal((await f.request({...state,tasks:[task({dueDate:'2026-11-02',dueTime})]})).status,200)
    state=(await f.request()).body
    assert.equal(state.tasks[0].dueTime,dueTime)
  }
  for(const dueTime of ['24:00','12:60','9:00',123,null])assert.equal((await f.request({...state,tasks:[task({dueDate:'2026-11-02',dueTime})]})).status,400)
  assert.equal((await f.request({...state,tasks:[task({dueTime:'12:00'})]})).status,400)
  assert.equal((await f.request({...state,tasks:[task()]})).status,200)
  assert.equal((await f.request()).body.tasks[0].dueTime,'')
})


test('bulk deletion archives attachments; restore keeps original completion day and stays account isolated',async t=>{
  const f=await fixture(t);let state=(await f.request()).body
  const file={name:'notes.pdf',type:'application/pdf',lastModified:1,data:Buffer.from('%PDF-test').toString('base64')}
  await f.request({...state,tasks:[task({done:true,notes:'Keep this',steps:['First step'],completedSteps:[0],files:[file],links:['https://example.com'],dueDate:'2026-11-02',dueTime:'23:59'}),task({id:'task-2'})]})
  state=(await f.request()).body
  const original=state.tasks[0],history=state.activity
  const removed=await f.request({...state,tasks:[]})
  assert.equal(removed.status,200);assert.equal(removed.body.trash.length,2)
  assert.deepEqual(removed.body.trash.find(item=>item.id===original.id).files,[file])
  assert.equal(removed.body.trash[0].expiresAt-removed.body.trash[0].deletedAt,30*86400000)
  assert.deepEqual((await f.request(undefined,1)).body.trash,[])
  assert.equal((await f.request({...state,tasks:[original]})).status,409)
  f.advance(1)
  state=(await f.request()).body
  const restored=await f.request({...state,tasks:[original]})
  assert.equal(restored.status,200)
  state=(await f.request()).body
  assert.deepEqual(state.tasks[0],original)
  assert.deepEqual(state.activity,history)
  assert.equal(state.trash.length,1)
  assert.equal(state.trash[0].id,'task-2')
})

test('recovery expires at 30 days; expired content is purged and stale clients cannot restore it',async t=>{
  const f=await fixture(t);let state=(await f.request()).body
  await f.request({...state,tasks:[task()]});state=(await f.request()).body
  const original=state.tasks[0]
  await f.request({...state,tasks:[]})
  f.db.prepare('UPDATE sessions SET expires=expires+?').run(60*86400000)
  f.advance(29)
  state=(await f.request()).body;assert.equal(state.trash.length,1)
  f.advance(1)
  state=(await f.request()).body;assert.deepEqual(state.trash,[])
  assert.equal(f.db.prepare('SELECT data FROM task_trash WHERE user_id=? AND task_id=?').get('user0',original.id).data,null)
  const result=await f.request({...state,tasks:[original]})
  assert.equal(result.status,400)
  assert.deepEqual((await f.request()).body.tasks,[])
})

test('restoring to a different space works after the original space has been removed',async t=>{
  const f=await fixture(t);let state=(await f.request()).body
  await f.request({...state,tasks:[task()]});state=(await f.request()).body
  await f.request({...state,tasks:[],spaces:state.spaces.filter(space=>space.id!=='school')})
  state=(await f.request()).body
  assert.equal((await f.request({...state,tasks:[state.trash[0]]})).status,400)
  assert.equal((await f.request({...state,tasks:[{...state.trash[0],space:'Personal'}]})).status,200)
  state=(await f.request()).body
  assert.equal(state.tasks[0].spaceId,'personal');assert.deepEqual(state.trash,[])
})


test('Bin contract is explicit and permanent deletion is account scoped and cannot be restored',async t=>{
  const f=await fixture(t);let state=(await f.request()).body
  assert.equal(state.binVersion,1)
  await f.request({...state,tasks:[task(),task({id:'task-2'})]})
  state=(await f.request()).body
  const originals=state.tasks
  await f.request({...state,tasks:[]})
  state=(await f.request()).body
  assert.equal(state.trash.length,2)
  const other=(await f.request(undefined,1)).body
  assert.equal((await f.request({...other,purgeIds:['task-1']},1)).status,400)
  assert.equal((await f.request()).body.trash.length,2)
  const result=await f.request({...state,purgeIds:['task-1','task-2']})
  assert.equal(result.status,200);assert.equal(result.body.binVersion,1);assert.deepEqual(result.body.trash,[])
  state=(await f.request()).body
  assert.deepEqual(state.trash,[])
  assert.equal((await f.request({...state,tasks:originals})).status,400)
  assert.deepEqual((await f.request()).body.tasks,[])
})

test('Bin deletion rejects invalid selections, active task IDs and stale revisions atomically',async t=>{
  const f=await fixture(t);let state=(await f.request()).body
  await f.request({...state,tasks:[task(),task({id:'task-2'})]})
  state=(await f.request()).body
  const stale=state
  await f.request({...state,tasks:state.tasks.filter(task=>task.id==='task-2')})
  state=(await f.request()).body
  assert.equal((await f.request({...stale,purgeIds:['task-1']})).status,409)
  for(const ids of [['task-1','missing'],['task-2'],['task-1','task-1'],[1]])assert.equal((await f.request({...state,purgeIds:ids})).status,400)
  const kept=(await f.request()).body
  assert.equal(kept.trash.length,1);assert.equal(kept.tasks.length,1)
})


test('calendar tasks retain future dates and status through edit, delete, restore and reload',async t=>{
  const f=await fixture(t)
  let state=(await f.request()).body
  let result=await f.request({...state,tasks:[task({dueDate:'2040-11-30',dueTime:'23:59'})]})
  assert.equal(result.status,200)
  state=(await f.request()).body
  assert.equal(state.tasks[0].dueDate,'2040-11-30')
  result=await f.request({...state,tasks:state.tasks.map(item=>({...item,dueDate:'2044-02-29',done:true}))})
  assert.equal(result.status,200)
  state=(await f.request()).body
  assert.equal(state.tasks[0].done,true)
  assert.equal(state.tasks[0].dueDate,'2044-02-29')
  assert.equal((await f.request({...state,tasks:[]})).status,200)
  state=(await f.request()).body
  assert.equal(state.tasks.length,0)
  assert.equal(state.trash[0].dueDate,'2044-02-29')
  assert.equal((await f.request({...state,tasks:[state.trash[0]]})).status,200)
  state=(await f.request()).body
  assert.equal(state.tasks[0].dueDate,'2044-02-29')
  assert.equal(state.tasks[0].dueTime,'23:59')
  assert.equal(state.tasks[0].done,true)
  assert.equal((await f.request(undefined,1)).body.tasks.length,0)
})


test('moving a task between existing spaces preserves data and remains account scoped',async t=>{
  const f=await fixture(t)
  let state=(await f.request()).body
  const file={name:'notes.pdf',type:'application/pdf',lastModified:1,data:Buffer.from('%PDF-example').toString('base64')}
  const original=task({notes:'Keep my notes',steps:['Read','Summarize'],completedSteps:[0],files:[file],links:['https://example.com'],dueDate:'2032-11-30',dueTime:'09:30',started:true})
  assert.equal((await f.request({...state,tasks:[original]})).status,200)
  state=(await f.request()).body
  assert.equal((await f.request({...state,tasks:state.tasks.map(item=>({...item,space:'Personal'}))})).status,200)
  state=(await f.request()).body
  const moved=state.tasks[0]
  assert.equal(moved.spaceId,'personal')
  assert.equal(moved.space,'Personal')
  for(const key of ['id','notes','steps','completedSteps','files','links','dueDate','dueTime','started'])assert.deepEqual(moved[key],original[key])
  assert.deepEqual((await f.request(undefined,1)).body.tasks,[])
  assert.equal((await f.request({...state,tasks:[{...moved,space:'Other account space'}]})).status,400)
  assert.equal((await f.request()).body.tasks[0].spaceId,'personal')
})


test('existing file references survive edits and cannot read another account files', async t=>{
  const f=await fixture(t);let state=(await f.request()).body
  const file={name:'notes.pdf',type:'application/pdf',lastModified:1,data:Buffer.from('%PDF-test').toString('base64')}
  await f.request({...state,tasks:[task({files:[file]})]});state=(await f.request()).body
  assert.equal((await f.request({...state,tasks:[{...state.tasks[0],title:'Changed',files:[{ref:{taskId:'task-1',index:0}}]}]})).status,200)
  state=(await f.request()).body;assert.deepEqual(state.tasks[0].files,[file])
  const other=(await f.request(undefined,1)).body
  assert.equal((await f.request({...other,tasks:[task({files:[{ref:{taskId:'task-1',index:0}}]})]},1)).status,400)
  await f.request({...state,tasks:[]});state=(await f.request()).body
  assert.equal((await f.request({...state,tasks:[task({files:[{ref:{taskId:'task-1',index:0}}]})]})).status,200)
})

test('quota uses final raw bytes; restore and purge free storage without double counting', async t=>{
  const f=await fixture(t);let state=(await f.request()).body
  const file=mb=>{const b=Buffer.alloc(mb*1024*1024);b.write('%PDF');return {name:'notes.pdf',type:'application/pdf',lastModified:0,data:b.toString('base64')}}
  const active=[task({id:'a',files:[file(10)]}),task({id:'b',files:[file(10)]})]
  const deleted=['c','d','e'].map(id=>task({id,files:[file(9)]}))
  f.db.prepare('INSERT INTO planners VALUES(?,?,?)').run('user0',0,JSON.stringify({spaces:state.spaces,tasks:active}))
  for(const item of deleted)f.db.prepare('INSERT INTO task_trash VALUES(?,?,?,?)').run('user0',item.id,Date.UTC(2026,10,1,12),JSON.stringify(item))
  const refs=items=>items.map(item=>({...item,files:[{ref:{taskId:item.id,index:0}}]}))
  const restored=await f.request({...state,tasks:refs([...active,deleted[0]])})
  assert.equal(restored.status,200)
  const purged=await f.request({...state,revision:1,tasks:refs([...active,deleted[0]]),purgeIds:['d','e']})
  assert.equal(purged.status,200);assert.deepEqual(purged.body.trash,[])
  // Newly archived files must also count in the final state.
  const grow=await f.request({...state,revision:2,tasks:[task({id:'new1',files:[file(10)]}),task({id:'new2',files:[file(10)]}),task({id:'new3',files:[file(10)]})]})
  assert.equal(grow.status,400)
  assert.equal((await f.request()).body.revision,2)
})

test('duplicate core task fields are rejected but a different deadline is allowed',async t=>{
 const f=await fixture(t);const state=(await f.request()).body
 const first=task({dueDate:'2026-11-03',dueZone:'Asia/Manila'})
 assert.equal((await f.request({...state,tasks:[first,{...first,id:'second',title:' READ NOTES '}]})).status,400)
 assert.equal((await f.request({...state,tasks:[first,{...first,id:'second',dueDate:'2026-11-04'}]})).status,200)
})
