import { createHash } from 'node:crypto'
import { emailReady, mailSender } from './mailer.mjs'
import { deadlineInstant, validZone } from '../src/features/tasks/deadlineZone.ts'
export function setupReminders(db){db.exec(`CREATE TABLE IF NOT EXISTS reminder_settings(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,enabled INTEGER NOT NULL DEFAULT 0,zone TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS reminder_deliveries(key TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,payload TEXT NOT NULL,created_at INTEGER NOT NULL,next_try INTEGER NOT NULL,sent_at INTEGER,attempts INTEGER NOT NULL DEFAULT 0);`)}
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
export function emailLayout(title,body,link,label='Open Petalpace'){
 return `<html><body style="margin:0;background:#f8f5ee;color:#2f3c74;font-family:Georgia,serif"><div style="max-width:560px;margin:24px auto;padding:28px;background:#fff;border:1px solid #ddd9cf;border-radius:16px"><p style="color:#4c74a1">Petalpace</p><h1 style="font-size:26px">${escape(title)}</h1>${body}<p style="margin-top:24px"><a href="${escape(link)}" style="display:inline-block;background:#4c74a1;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">${escape(label)}</a></p><p style="font-size:14px;color:#595959">Small steps. Room to bloom.</p></div></body></html>`
}
export function reminderPhase(task,now,zone){
 if(task.done || task.started || task.blocked || !task.dueDate)return null
 const at=deadlineInstant(task.dueDate,task.dueTime,task.dueZone || zone)
 if(at===null)return null
 const remaining=at-now
 if(remaining<0)return remaining>=-7*86400000?'missed':null
 return remaining<=86400000?'day':remaining<=3*86400000?'soon':null
}
// Persistent phase receipts prevent repeats after restarts. A single-server
// worker scans once a minute and sends at most 20 messages in one pass.
export function createReminderWorker({db,env=process.env,send,now=Date.now}){
 send??=mailSender(env)
 setupReminders(db);let busy=false
 // A planner is parsed only when its revision changes, and only tasks that can
 // still need a reminder are kept, so idle scans never touch the planner JSON.
 const deadlines=new Map()
 const deadlineTasks=user=>{
  const revision=db.prepare('SELECT revision FROM planners WHERE user_id=?').get(user)?.revision
  if(revision===undefined){deadlines.delete(user);return []}
  const cached=deadlines.get(user)
  if(cached?.revision===revision)return cached.tasks
  const tasks=JSON.parse(db.prepare('SELECT data FROM planners WHERE user_id=?').get(user).data).tasks
   .filter(task=>task.dueDate && !task.done && !task.started && !task.blocked)
   .map(({id,title,dueDate,dueTime,dueZone})=>({id,title,dueDate,dueTime,dueZone}))
  deadlines.set(user,{revision,tasks})
  return tasks
 }
 return async()=>{
  if(busy || !emailReady(env) || !(env.AUTH_FROM || env.FEEDBACK_FROM))return
  busy=true
  try{
   const settings=db.prepare('SELECT r.*,u.email FROM reminder_settings r JOIN users u ON u.id=r.user_id WHERE r.enabled=1 AND u.verified=1').all()
   const active=new Set(settings.map(setting=>setting.user_id))
   for(const user of deadlines.keys())if(!active.has(user))deadlines.delete(user)
   let budget=20
   for(const setting of settings){
    if(budget<=0)break
    const tasks=deadlineTasks(setting.user_id)
    const shared=db.prepare('SELECT c.* FROM collab_tasks c JOIN collab_members m ON m.task_id=c.id WHERE m.user_id=?').all(setting.user_id).map(t=>({id:'shared:'+t.id,title:t.title,dueDate:t.due_date,dueTime:t.due_time,dueZone:t.due_zone,done:t.status==='done',started:t.status==='progress',blocked:t.status==='blocked'}))
    for(const task of [...tasks,...shared]){
     const phase=reminderPhase(task,now(),setting.zone)
     if(!phase)continue
     const key=createHash('sha256').update(JSON.stringify([setting.user_id,task.id,task.dueDate,task.dueTime,task.dueZone || setting.zone,phase])).digest('hex')
     db.prepare('INSERT OR IGNORE INTO reminder_deliveries(key,user_id,payload,created_at,next_try) VALUES(?,?,?,?,?)').run(key,setting.user_id,JSON.stringify({id:task.id,phase}),now(),now())
    }
    const queue=db.prepare('SELECT * FROM reminder_deliveries WHERE user_id=? AND sent_at IS NULL AND next_try<=? AND created_at>? ORDER BY created_at LIMIT 20').all(setting.user_id,now(),now()-23*3600000)
    for(const job of queue){
     if(budget--<=0)break
     const payload=JSON.parse(job.payload),task=[...tasks,...shared].find(t=>t.id===payload.id)
     if(!task || createHash('sha256').update(JSON.stringify([setting.user_id,task.id,task.dueDate,task.dueTime,task.dueZone || setting.zone,payload.phase])).digest('hex')!==job.key || reminderPhase(task,now(),setting.zone)!==payload.phase){db.prepare('UPDATE reminder_deliveries SET sent_at=? WHERE key=?').run(now(),job.key);continue}
     const title=payload.phase==='missed'?'A deadline has passed':payload.phase==='day'?'Due within 24 hours':'A deadline is approaching'
     const zone=task.dueZone || setting.zone
     const deadline=`${task.dueDate} ${task.dueTime || 'end of day'} (${zone})`
     const link=new URL(task.id.startsWith('shared:')?'/collaboration/'+task.id.slice(7):'/tasks',env.APP_URL || 'http://localhost:5173').href
     const text=`${title}\n${task.title}\nDue ${deadline}\n\n${link}\n\nYou can finish, reschedule, or mark the task done. Manage email reminders in your profile. In-progress and completed tasks do not receive reminders.`
     // Freeze message at first attempt for provider idempotency on retries.
     const message=payload.message || {from:env.AUTH_FROM || env.FEEDBACK_FROM,to:[setting.email],subject:`Petalpace · ${title}`,text,html:emailLayout(title,`<p style="font-size:18px">${escape(task.title)}</p><p>Due ${escape(deadline)}</p><p>You can finish, reschedule, or mark this task done.</p><p style="font-size:14px">Manage email reminders in your profile. In-progress and completed tasks do not receive these reminders.</p>`,link)}
     db.prepare('UPDATE reminder_deliveries SET payload=?,next_try=?,attempts=attempts+1 WHERE key=?').run(JSON.stringify({...payload,message}),now()+15*60000,job.key)
     try{
      const response=await send('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`reminder-${job.key}`},body:JSON.stringify(message),signal:AbortSignal.timeout(12000)})
      const result=await response.json().catch(()=>null)
      if(response.ok && result?.id)db.prepare('UPDATE reminder_deliveries SET sent_at=? WHERE key=?').run(now(),job.key)
     }catch{/* Retry within provider idempotency window. Never report delivery to inbox. */}
    }
   }
   // Keep phase receipts while retaining no email body after completion/expiry.
   db.prepare("UPDATE reminder_deliveries SET payload='{}' WHERE (sent_at IS NOT NULL OR created_at<?) AND payload!='{}'").run(now()-23*3600000)
  }finally{busy=false}
 }
}
export function createReminderSettingsHandler({db,findSession,origins,limit,env=process.env}){
 setupReminders(db)
 return async(req,res)=>{
  const reply=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data))}
  const user=findSession(req);if(!user)return reply(401,{error:'Please sign in.'})
  if(req.method==='GET'){const row=db.prepare('SELECT * FROM reminder_settings WHERE user_id=?').get(user.id);return reply(200,{enabled:!!row?.enabled,zone:row?.zone || '',ready:emailReady(env) && !!(env.AUTH_FROM || env.FEEDBACK_FROM)})}
  if(req.method!=='POST')return reply(405,{error:'Use POST.'})
  if(!origins.includes(req.headers.origin))return reply(403,{error:'Please use Petalpace.'})
  limit('reminders:'+user.id,30)
  let body='';for await(const c of req){body+=c;if(body.length>1024)return reply(413,{error:'Request too large.'})}
  let data;try{data=JSON.parse(body)}catch{return reply(400,{error:'Invalid request.'})}
  if(typeof data.enabled!=='boolean' || !validZone(data.zone))return reply(400,{error:'Choose a valid timezone and reminder preference.'})
  if(!findSession(req))return reply(401,{error:'Please sign in.'})
  db.prepare('INSERT INTO reminder_settings VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET enabled=excluded.enabled,zone=excluded.zone').run(user.id,data.enabled?1:0,data.zone)
  return reply(200,{enabled:data.enabled,zone:data.zone})
 }
}
