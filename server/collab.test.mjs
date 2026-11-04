import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createAuthStore } from './auth-store.mjs'
import { createAuthHandler } from './auth.mjs'
import { createFeedbackServer } from './feedback.mjs'
async function fixture(t){
 const db=createAuthStore(),tokens=['a'.repeat(64),'b'.repeat(64),'c'.repeat(64)],messages=[]
 tokens.forEach((token,i)=>{db.prepare('INSERT INTO users VALUES(?,?,?,?,1)').run('u'+i,`u${i}@example.com`,'User '+i,'test');db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(createHash('sha256').update(token).digest('hex'),'u'+i,Date.now()+86400000)})
 let reject=false
 const env={APP_URL:'http://localhost:5173',RESEND_API_KEY:'test-only',AUTH_FROM:'test@example.com'}
 const auth=createAuthHandler({db,env,send:async(url,opts)=>{messages.push(JSON.parse(opts.body));return {ok:!reject,json:async()=>reject?{}:{id:'mail'}}}})
 const server=createFeedbackServer({auth,env});await new Promise(r=>server.listen(0,'127.0.0.1',r))
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));db.close()})
 const base=`http://127.0.0.1:${server.address().port}`
 async function request(path,method='GET',body,user=0){const response=await fetch(base+path,{method,headers:{cookie:`petalpace_session=${tokens[user]}`,...(body?{'Content-Type':'application/json'}:{}),...(method!=='GET'?{origin:'http://localhost:5173'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(5000)});const type=response.headers.get('content-type');return {status:response.status,body:type?.includes('json')?await response.json():Buffer.from(await response.arrayBuffer())}}
 const create=async()=>{const result=await request('/api/collab/tasks','POST',{title:'Shared task',priority:'Medium',color:'#D7E7FD',dueDate:'2026-11-30',dueTime:'23:59',dueZone:'Asia/Manila'});assert.equal(result.status,200,JSON.stringify(result.body));return result.body.task}
 return {db,request,create,messages,rejectEmail:()=>reject=true,base,tokens}
}
test('shared task routes, role restrictions, assignees, revision conflicts and file deletion',async t=>{
 const f=await fixture(t);let task=await f.create();const path='/api/collab/tasks/'+task.id
 assert.equal((await f.request(path,'GET',undefined,1)).status,403)
 assert.equal((await f.request(path,'PUT',{revision:0,notes:'owner notes'})).status,200)
 assert.equal((await f.request(path,'PUT',{revision:0,notes:'stale'})).status,409)
 let invite=await f.request(path+'/invite','POST',{email:'u1@example.com',permission:'steps'});assert.equal(invite.status,200)
 const token=f.messages.at(-1).text.match(/token=([a-f0-9]{64})/)[1]
 assert.equal((await f.request('/api/collab/join/'+token,'POST',{},2)).status,403)
 assert.equal((await f.request('/api/collab/join/'+token,'POST',{},1)).status,200)
 assert.equal((await f.request('/api/collab/join/'+token,'POST',{},1)).status,400)
 task=(await f.request(path)).body.task
 let result=await f.request(path,'PUT',{revision:task.revision,subtasks:[{title:'Assigned',done:false,assignedTo:'u1'},{title:'Owner step',done:false,assignedTo:'u0'}]});assert.equal(result.status,200);task=result.body.task
 assert.equal((await f.request(path,'PUT',{revision:task.revision,notes:'not allowed'},1)).status,403)
 assert.equal((await f.request(path,'PUT',{revision:task.revision,subtasks:task.subtasks.map(s=>({...s,done:true}))},1)).status,403)
 result=await f.request(path,'PUT',{revision:task.revision,subtasks:task.subtasks.map((s,i)=>({...s,done:i===0}))},1);assert.equal(result.status,200);task=result.body.task
 assert.equal((await f.request(path,'PUT',{revision:task.revision,assignedTo:'u2'})).status,400)
 const file={name:'notes.pdf',type:'application/pdf',data:Buffer.from('%PDF-test').toString('base64'),lastModified:1,subtaskId:task.subtasks[0].id}
 assert.equal((await f.request(path,'PUT',{revision:task.revision,files:[{...file,data:Buffer.from('wrong').toString('base64')}]})).status,400)
 result=await f.request(path,'PUT',{revision:task.revision,files:[file]});assert.equal(result.status,200);task=result.body.task
 const filePath=path+'/files/'+task.files[0].id
 assert.equal((await f.request(filePath,'GET',undefined,1)).status,200)
 assert.equal((await f.request(filePath,'GET',undefined,2)).status,403)
 result=await f.request(path,'PUT',{revision:task.revision,files:[]});assert.equal(result.status,200);assert.deepEqual(result.body.task.files,[])
 assert.equal((await f.request(filePath)).status,404)
 assert.equal((await f.request(path+'/members/u1','PATCH',{permission:'viewer'})).status,200)
 task=(await f.request(path)).body.task
 assert.equal((await f.request(path,'PUT',{revision:task.revision,subtasks:task.subtasks},1)).status,403)
 assert.equal((await f.request(path+'/members/u1','DELETE')).status,200)
 assert.equal((await f.request(path,'GET',undefined,1)).status,403)
})
test('invitation failures and invalid deadlines do not report successful delivery',async t=>{
 const f=await fixture(t),task=await f.create(),path='/api/collab/tasks/'+task.id
 f.rejectEmail();assert.equal((await f.request(path+'/invite','POST',{email:'u1@example.com',permission:'editor'})).status,503)
 assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM collab_invites').get().n,0)
 assert.equal((await f.request(path+'/invite','POST',{email:'not-an-email'})).status,400)
 assert.equal((await f.request(path,'PUT',{revision:0,dueDate:'2026-02-30'})).status,400)
})
test('authenticated SSE opens once and broadcasts without duplicate headers',async t=>{
 const f=await fixture(t),abort=new AbortController()
 const response=await fetch(f.base+'/api/auth/stream',{headers:{cookie:`petalpace_session=${f.tokens[0]}`},signal:abort.signal})
 assert.equal(response.status,200)
 const reader=response.body.getReader();assert.match(new TextDecoder().decode((await reader.read()).value),/connected/)
 await f.create()
 const timeout=setTimeout(()=>abort.abort(),3000)
 try{assert.match(new TextDecoder().decode((await reader.read()).value),/planner-changed/)}finally{clearTimeout(timeout);abort.abort();await reader.cancel().catch(()=>{})}
})

test('delegated resources persist, editors edit unassigned work, limited members change only their status',async t=>{
 const f=await fixture(t);let task=await f.create();const path='/api/collab/tasks/'+task.id
 f.db.prepare('INSERT INTO collab_members VALUES(?,?,?,?)').run(task.id,'u1','editor',Date.now())
 f.db.prepare('INSERT INTO collab_members VALUES(?,?,?,?)').run(task.id,'u2','steps',Date.now())
 let result=await f.request(path,'PUT',{revision:task.revision,subtasks:[{title:'Research',done:false,assignedTo:'u2',notes:'Brief',links:['https://example.com/source']}],links:['https://example.com/group']},1)
 assert.equal(result.status,200,JSON.stringify(result.body));task=result.body.task
 assert.equal(task.subtasks[0].notes,'Brief');assert.deepEqual(task.subtasks[0].links,['https://example.com/source'])
 const edit=patch=>f.request(path,'PUT',{revision:task.revision,...patch},2)
 assert.equal((await edit({subtasks:task.subtasks.map(s=>({...s,notes:'unauthorized'}))})).status,403)
 assert.equal((await edit({subtasks:task.subtasks.map(s=>({...s,links:['https://example.com/other']}))})).status,403)
 assert.equal((await edit({files:[]})).status,403)
 result=await edit({subtasks:task.subtasks.map(s=>({...s,done:true}))});assert.equal(result.status,200);task=result.body.task
 const sharp=(await import('sharp')).default
 const data=(await sharp({create:{width:2,height:2,channels:3,background:'#ffffff'}}).png().toBuffer()).toString('base64')
 const file={name:'reference.png',type:'image/png',data,lastModified:1,subtaskId:task.subtasks[0].id}
 assert.equal((await f.request(path,'PUT',{revision:task.revision,files:[{...file,data:Buffer.from('invalid').toString('base64')}]},1)).status,400)
 result=await f.request(path,'PUT',{revision:task.revision,files:[file],notes:'Editor may change group notes'},1)
 assert.equal(result.status,200,JSON.stringify(result.body));task=result.body.task
 const saved=(await f.request(path,'GET',undefined,2)).body.task
 assert.equal(saved.files[0].subtaskId,task.subtasks[0].id)
 assert.equal(saved.subtasks[0].notes,'Brief');assert.equal(saved.links[0].url,'https://example.com/group')
 assert.equal((await f.request(path,'PUT',{revision:task.revision,subtasks:task.subtasks.map(s=>({...s,links:['javascript:alert(1)']}))},1)).status,400)
 result=await f.request(path,'PUT',{revision:task.revision,subtasks:[]},1)
 assert.equal(result.status,200);assert.equal(result.body.task.files.length,0);assert.equal(result.body.task.links.length,1)
 assert.equal((await f.request(path+'/members/u2','PATCH',{permission:'editor'},1)).status,403)
})
