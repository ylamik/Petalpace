import { deadlineInstant, validZone, taskIdentity } from '../src/features/tasks/deadlineZone.ts'
import { isOfficePackage } from './document-format.mjs'
import { notifyPlannerChanged } from './sse-broker.mjs'
const defaults = [{id:'school',name:'School',color:'#D7E7FD'},{id:'personal',name:'Personal',color:'#FDDCCD'},{id:'creative',name:'Creative',color:'#D6DDC9'}]
const fail = message => { throw Object.assign(new Error(message),{status:400}) }
const text = (s,n) => typeof s==='string' && [...s].length<=n
const dateOK = s => { try { return s==='' || (/^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s) } catch { return false } }

// Magic-byte signatures for document types.  Verifies the actual file content
// matches the claimed extension, not just the filename.
const fileSignatures = {
  pdf:  [0x25, 0x50, 0x44, 0x46],                                       // %PDF
  docx: [0x50, 0x4B, 0x03, 0x04],                                       // PK (ZIP / OOXML)
  pptx: [0x50, 0x4B, 0x03, 0x04],                                       // PK (ZIP / OOXML)
  doc:  [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1],               // OLE2 compound
  ppt:  [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1],               // OLE2 compound
}
export function checkFileSignature(buffer, name) {
  const ext = name.toLowerCase().split('.').pop()
  const sig = fileSignatures[ext]
  if (!sig) return false
  if (ext === 'docx' || ext === 'pptx') return isOfficePackage(buffer, ext)
  return buffer.length >= sig.length && buffer.subarray(0, sig.length).equals(Buffer.from(sig))
}
export function validatePlanner(data) {
  if(!data || !Number.isSafeInteger(data.revision) || data.revision<0 || !Array.isArray(data.spaces) || data.spaces.length>100 || !Array.isArray(data.tasks) || data.tasks.length>2000) fail('Invalid planner data or account limit reached.')
  const ids=new Set(), names=new Set()
  const spaces=data.spaces.map(s=>{
    if(!s || !text(s.id,100) || !s.id || ids.has(s.id) || !text(s.name,40) || !s.name.trim() || names.has(s.name.trim().toLowerCase()) || !/^#[a-f0-9]{6}$/i.test(s.color)) fail('Check your space names and colors.')
    ids.add(s.id);names.add(s.name.trim().toLowerCase());return {id:s.id,name:s.name.trim(),color:s.color}
  })
  const taskIds=new Set();let bytes=0
  const tasks=data.tasks.map(t=>{
    if(!t || !text(t.id,100) || !t.id || taskIds.has(t.id) || !text(t.title,160) || !t.title.trim() || !['High','Medium','Low'].includes(t.priority) || !text(t.notes,20000) || !text(t.dueDate,10) || !dateOK(t.dueDate)) fail('Check the task title, priority, notes, and due date.')
    if(t.dueTime!==undefined && (typeof t.dueTime!=='string' || (t.dueTime!=='' && (!/^([01]\d|2[0-3]):[0-5]\d$/.test(t.dueTime) || !t.dueDate)))) fail('Choose a valid due date and time.')
    if(t.dueZone !== undefined && !validZone(t.dueZone)) fail('Choose a valid deadline timezone.')
    if(t.dueDate && t.dueZone && deadlineInstant(t.dueDate,t.dueTime,t.dueZone)===null) fail('This local deadline does not exist because the clocks change. Choose another time.')
    taskIds.add(t.id)
    const space=spaces.find(s=>s.name===t.space)
    if(!space) fail('Select an existing space for each task.')
    if(typeof t.done!=='boolean' || typeof t.pinned!=='boolean' || (t.started!==undefined && typeof t.started!=='boolean') || (t.blocked!==undefined && typeof t.blocked!=='boolean')) fail('Invalid task status.')
    if(!Array.isArray(t.steps) || t.steps.length>100 || t.steps.some(s=>!text(s,500)) || !Array.isArray(t.completedSteps) || t.completedSteps.some(i=>!Number.isInteger(i) || i<0 || i>=t.steps.length)) fail('Check your task steps.')
    if(!Array.isArray(t.links) || t.links.length>50 || t.links.some(s=>{try{return !text(s,2048) || !['http:','https:'].includes(new URL(s).protocol)}catch{return true}})) fail('Use valid http or https links.')
    if(!Array.isArray(t.files) || t.files.length>10) fail('Attach up to 10 files per task.')
    const files=t.files.map(f=>{
      if(!f || !text(f.name,255) || !/\.(pdf|docx?|pptx?)$/i.test(f.name) || !text(f.type,100) || typeof f.data!=='string' || f.data.length>13981016 || f.data.length%4!==0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(f.data)) fail('Use PDF, Word or PowerPoint attachments, up to 10 MB each.')
      const buffer=Buffer.from(f.data,'base64')
      if(!checkFileSignature(buffer,f.name)) fail('The file content does not match its type. Use a valid PDF, Word, or PowerPoint document.')
      const size=buffer.length;bytes+=size
      if(size>10*1024*1024 || bytes>30*1024*1024) fail('Attachments must be at most 10 MB each and 30 MB total per account.')
      return {name:f.name,type:f.type,lastModified:Number.isFinite(f.lastModified)?f.lastModified:0,data:f.data}
    })
    return {id:t.id,title:t.title.trim(),spaceId:space.id,space:space.name,priority:t.priority,dueDate:t.dueDate,dueTime:t.dueTime??'',...(t.dueZone?{dueZone:t.dueZone}:{}),notes:t.notes,steps:t.steps,completedSteps:[...new Set(t.completedSteps)],files,links:[...new Set(t.links)],pinned:t.pinned,done:t.done,started:!t.done && !t.blocked && !!t.started,blocked:!t.done && !!t.blocked}
  })
  if(tasks.filter(t=>t.pinned&&!t.done).length>3) fail('Your top 3 is full. Unpin one task first.')
  return {spaces,tasks}
}
export function createPlannerHandler({db,findSession,origins,limit,now=Date.now}) {
  db.exec(`CREATE TABLE IF NOT EXISTS planners(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, revision INTEGER NOT NULL, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS completions(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, task_id TEXT NOT NULL, day TEXT NOT NULL, PRIMARY KEY(user_id,task_id));`)
  db.exec(`CREATE TABLE IF NOT EXISTS task_trash(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, task_id TEXT NOT NULL, deleted_at INTEGER NOT NULL, data TEXT, PRIMARY KEY(user_id,task_id));`)
  const retention=30*86400000
  const purge=()=>db.prepare('UPDATE task_trash SET data=NULL WHERE deleted_at<=? AND data IS NOT NULL').run(now()-retention)
  const trash=user=>db.prepare('SELECT data,deleted_at FROM task_trash WHERE user_id=? AND data IS NOT NULL AND deleted_at>? ORDER BY deleted_at DESC').all(user,now()-retention).map(row=>({...JSON.parse(row.data),deletedAt:row.deleted_at,expiresAt:row.deleted_at+retention}))
  const activity=user=>db.prepare('SELECT day,COUNT(*) AS count FROM completions WHERE user_id=? GROUP BY day ORDER BY day').all(user)
  return async (req,res)=>{
    const reply=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data))}
    try {
      const user=findSession(req)
      if(!user) return reply(401,{error:'Please sign in again.'})
      purge()
      if(req.url==='/api/auth/planner/version' && req.method==='GET')return reply(200,{revision:db.prepare('SELECT revision FROM planners WHERE user_id=?').get(user.id)?.revision ?? 0})
      if(req.method==='GET') {
        const row=db.prepare('SELECT revision,data FROM planners WHERE user_id=?').get(user.id)
        return reply(200,{revision:row?.revision??0,...(row?JSON.parse(row.data):{spaces:defaults,tasks:[]}),activity:activity(user.id),trash:trash(user.id),binVersion:1})
      }
      // DELETE /api/auth/planner/activity — resets completion history to zero
      if(req.method==='DELETE') {
        if(!origins.includes(req.headers.origin)) return reply(403,{error:'Please use the Petalpace website.'})
        db.prepare('DELETE FROM completions WHERE user_id=?').run(user.id)
        db.prepare('UPDATE planners SET revision=revision+1 WHERE user_id=?').run(user.id)
        const revision=db.prepare('SELECT revision FROM planners WHERE user_id=?').get(user.id)?.revision ?? 0
        notifyPlannerChanged(user.id)
        return reply(200,{activity:[],revision,message:'Activity history cleared.'})
      }
      if(req.method!=='PUT') return reply(405,{error:'Use GET or PUT.'})
      if(!origins.includes(req.headers.origin)) return reply(403,{error:'Please use the Petalpace website.'})
      if(!req.headers['content-type']?.startsWith('application/json')) return reply(415,{error:'Use JSON.'})
      limit(`planner:${user.id}`,300)
      const chunks=[];let received=0;for await(const chunk of req){received+=chunk.length;if(received>44*1024*1024) return reply(413,{error:'Planner attachments exceed the account limit.'});chunks.push(chunk)}
      const body=Buffer.concat(chunks).toString('utf8')
      let data;try{data=JSON.parse(body)}catch{return reply(400,{error:'Invalid planner data.'})}
      const purgeIds=data.purgeIds ?? []
      if(!Array.isArray(purgeIds) || purgeIds.length>2000 || purgeIds.some(id=>!text(id,100) || !id) || new Set(purgeIds).size!==purgeIds.length) fail('Select valid tasks from the Bin.')
      if(findSession(req)?.id!==user.id) return reply(401,{error:'Please sign in again.'})
      let zone=data.timeZone
      try{new Intl.DateTimeFormat('en',{timeZone:zone}).format(new Date(now()))}catch{zone='UTC'}
      const parts=new Intl.DateTimeFormat('en',{timeZone:zone||'UTC',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now()))
      const day=['year','month','day'].map(k=>parts.find(p=>p.type===k).value).join('-')
      db.exec('BEGIN IMMEDIATE')
      try {
        const previous=db.prepare('SELECT revision,data FROM planners WHERE user_id=?').get(user.id)
        if((previous?.revision??0)!==data.revision){db.exec('ROLLBACK');return reply(409,{error:'Your planner changed in another tab. Reload to get the latest saved version.'})}
        const old=previous?JSON.parse(previous.data).tasks:[]
        const currentTrash=trash(user.id)
        // Existing files are referenced by their owning task, never uploaded on every edit.
        const ownedFiles=new Map([...old,...currentTrash].map(task=>[task.id,task.files]))
        const hydrated={...data,tasks:Array.isArray(data.tasks)?data.tasks.map(task=>({...task,files:Array.isArray(task?.files)?task.files.map(file=>{
          if (!file?.ref) return file
          const {taskId,index}=file.ref
          const stored=typeof taskId==='string' && Number.isInteger(index) && index>=0 ? ownedFiles.get(taskId)?.[index] : null
          if (!stored) fail('An attachment changed or expired. Reload your saved planner and try again.')
          return stored
        }):task?.files})):data.tasks}
        const snapshot=validatePlanner(hydrated)
        const identities=new Map()
        for(const task of snapshot.tasks){
          const identity=taskIdentity(task)
          const other=identities.get(identity)
          if(other && (!old.some(t=>t.id===task.id && taskIdentity(t)===identity) || !old.some(t=>t.id===other && taskIdentity(t)===identity))) fail('A task with this title, space, priority and deadline already exists. Change one of these fields.')
          identities.set(identity,task.id)
        }
        const activeIds=new Set(snapshot.tasks.map(task=>task.id))
        const purgeSet=new Set(purgeIds)
        const removed=old.filter(task=>!activeIds.has(task.id))
        const nextTrash=[...currentTrash.filter(task=>!activeIds.has(task.id) && !purgeSet.has(task.id)),...removed]
        const bytes=tasks=>tasks.reduce((sum,task)=>sum+task.files.reduce((n,file)=>n+Buffer.byteLength(file.data,'base64'),0),0)
        const before=bytes([...old,...currentTrash]), after=bytes([...snapshot.tasks,...nextTrash])
        // Permit cleanup of legacy over-quota accounts, but never further growth.
        if(after>50*1024*1024 && after>before) fail('Your total attachment storage including the Bin exceeds 50 MB. Remove files or empty the Bin to free space.')
        if(nextTrash.length>2000 && nextTrash.length>currentTrash.length) fail('Your Bin holds 2,000 tasks. Empty some Bin items before deleting more tasks.')
        for(const removed of old.filter(task=>!snapshot.tasks.some(current=>current.id===task.id))) {
          db.prepare('INSERT INTO task_trash(user_id,task_id,deleted_at,data) VALUES(?,?,?,?) ON CONFLICT(user_id,task_id) DO UPDATE SET deleted_at=excluded.deleted_at,data=excluded.data').run(user.id,removed.id,now(),JSON.stringify(removed))
        }
        for(const t of snapshot.tasks){
          const deleted=db.prepare('SELECT data,deleted_at FROM task_trash WHERE user_id=? AND task_id=?').get(user.id,t.id)
          if(deleted){
            if(!deleted.data || deleted.deleted_at<=now()-retention) fail('This task has passed its 30-day recovery window.')
            db.prepare('DELETE FROM task_trash WHERE user_id=? AND task_id=?').run(user.id,t.id)
          }
          if(t.done && !(old.find(p=>p.id===t.id) ?? (deleted?.data ? JSON.parse(deleted.data) : null))?.done) db.prepare('INSERT INTO completions(user_id,task_id,day) VALUES(?,?,?) ON CONFLICT(user_id,task_id) DO UPDATE SET day=excluded.day').run(user.id,t.id,day)
          if(!t.done) db.prepare('DELETE FROM completions WHERE user_id=? AND task_id=?').run(user.id,t.id)
        }
        for(const id of purgeIds){
          const entry=db.prepare('SELECT data FROM task_trash WHERE user_id=? AND task_id=?').get(user.id,id)
          if(!entry || !entry.data || snapshot.tasks.some(task=>task.id===id)) fail('A selected task is no longer in your Bin. Reload and try again.')
          db.prepare('UPDATE task_trash SET data=NULL WHERE user_id=? AND task_id=?').run(user.id,id)
        }
        db.prepare('INSERT INTO planners(user_id,revision,data) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET revision=excluded.revision,data=excluded.data').run(user.id,data.revision+1,JSON.stringify(snapshot))
        db.exec('COMMIT')
      }catch(error){db.exec('ROLLBACK');throw error}
      // Notify all other open tabs/devices for this user that the planner changed
      notifyPlannerChanged(user.id)
      return reply(200,{revision:data.revision+1,activity:activity(user.id),trash:trash(user.id),binVersion:1})
    }catch(error){return reply(error.status||500,{error:error.status?error.message:'Could not save your planner. Please try again.'})}
  }
}
