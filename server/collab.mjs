import sharp from 'sharp'
import { deadlineInstant, validZone } from '../src/features/tasks/deadlineZone.ts'
import { checkFileSignature } from './planner.mjs'
import { emailLayout, escapeHtml, logoUrl, taskPanel } from './email-layout.mjs'
/**
 * Collaboration endpoints — shared tasks that live outside the personal planner.
 *
 * Permissions:
 *   owner  — full control (create, edit all fields, manage members, delete)
 *   editor — edits task content and assignments, not membership or deletion
 *   steps/member — edits notes, links and completion of their assigned steps only
 *   viewer — read/download only
 *
 * All routes are under /api/collab/
 */

import { randomBytes, createHash } from 'node:crypto'
import { notifyPlannerChanged } from './sse-broker.mjs'
import { emailReady, mailSender } from './mailer.mjs'

// Delegated-task status. `done` stays the source of truth for completion;
// status adds To do / In progress / Blocked for items that aren't done.
const stepStatuses = ['todo', 'progress', 'done', 'blocked']
function stepStatus(step, old) {
  if (step.done) return 'done'
  if (stepStatuses.includes(step.status) && step.status !== 'done') return step.status
  return old && old.status && old.status !== 'done' && !old.done ? old.status : 'todo'
}

const digest = v => createHash('sha256').update(v).digest('hex')
const text = (s, n) => typeof s === 'string' && s.length <= n
const validUrl = s => { try { return ['http:', 'https:'].includes(new URL(s).protocol) } catch { return false } }
const DAY = 86400000

// Maximum sizes (consistent with personal planner)
const MAX_SUBTASKS = 100
const MAX_FILES = 10
const MAX_FILE_BYTES = 10 * 1024 * 1024
const MAX_LINKS = 50

function taskView(db, task) {
  const members = db.prepare(
    'SELECT u.id, u.name, u.email, cm.role, p.version AS photoVersion FROM collab_members cm JOIN users u ON u.id = cm.user_id LEFT JOIN profile_photos p ON p.user_id = u.id WHERE cm.task_id = ? ORDER BY cm.joined_at'
  ).all(task.id)
  const subtasks = db.prepare('SELECT * FROM collab_subtasks WHERE task_id = ? ORDER BY position, rowid').all(task.id)
  const files = db.prepare('SELECT id, name, type, last_modified, subtask_id FROM collab_files WHERE task_id = ?').all(task.id)
  const links = db.prepare('SELECT id, url FROM collab_links WHERE task_id = ?').all(task.id)
  return {
    id: task.id,
    title: task.title,
    notes: task.notes,
    priority: task.priority,
    dueDate: task.due_date,
    dueTime: task.due_time,
    status: task.status,
    color: task.color,
    ownerId: task.owner_id,
    createdAt: task.created_at,
    updatedAt: task.updated_at, revision:task.revision, dueZone:task.due_zone, assignedTo:task.assigned_to,
    members: members.map(m => ({
      id: m.id, name: m.name, email: m.email, role: m.role,
      photoUrl: m.photoVersion ? `/api/collab/tasks/${task.id}/members/${m.id}/photo?v=${m.photoVersion}` : null,
    })),
    subtasks: subtasks.map(s => ({
      id: s.id, title: s.title, done: !!s.done, status: s.done ? 'done' : (s.status==='done' ? 'todo' : s.status || 'todo'),
      assignedTo: s.assigned_to, position: s.position, notes:s.notes, links:JSON.parse(s.links),
    })),
    files: files.map(f => ({ id: f.id, name: f.name, type: f.type, lastModified: f.last_modified, subtaskId:f.subtask_id })),
    links: links.map(l => ({ id: l.id, url: l.url })),
  }
}

export function createCollabHandler({ db, findSession, origins, limit, send, env = process.env, now = Date.now }) {
  send ??= mailSender(env)
  // Used when a request has no timezone: the owner's reminder zone, or UTC.
  const defaultZone = userId => {
    const zone = db.prepare('SELECT zone FROM reminder_settings WHERE user_id = ?').get(userId)?.zone
    return validZone(zone) ? zone : 'UTC'
  }
  const reply = (res, status, data) => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
    res.end(JSON.stringify(data))
  }

  async function readBody(req, max = 44 * 1024 * 1024) {
    const chunks = []; let received = 0
    for await (const chunk of req) {
      received += chunk.length
      if (received > max) throw Object.assign(new Error('Request too large.'), { status: 413 })
      chunks.push(chunk)
    }
    return Buffer.concat(chunks).toString('utf8')
  }

  async function sendInviteEmail(task, inviteeEmail, inviterName, token) {
    const from = env.AUTH_FROM || env.FEEDBACK_FROM
    if (!emailReady(env) || !from) throw Object.assign(new Error('Invite email is not configured. Please try again later.'),{status:503})
    const publicUrl = new URL(env.APP_URL || 'http://localhost:5173')
    const link = new URL('/collaboration/join', publicUrl)
    link.hash = `token=${token}`
    const response=await send('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [inviteeEmail],
        subject: `${inviterName} invited you to a shared task on Petalpace`,
        html:emailLayout('You’re invited to a shared task', `<p style="margin:0">${escapeHtml(inviterName)} would like you to work on this together in Petalpace.</p>${taskPanel(task.title,[['Invited by',inviterName],['Expires','In 7 days']],task.color)}<p style="margin:18px 0 0">Sign in with this email address to accept. You’ll need a Petalpace account.</p>`,link.href,'Review invitation',{preheader:`${inviterName} invited you to “${task.title}”`,footer:'If you weren’t expecting this, you can ignore it.',logo:logoUrl(env)}),
        text: `Hi,\n\n${inviterName} has invited you to collaborate on "${task.title}" in Petalpace.\n\nOpen this link to join:\n${link.href}\n\nThis invite expires in 7 days. You'll need a Petalpace account to accept it.\n\nIf you didn't expect this, you can ignore it.`,
      }),
      signal: AbortSignal.timeout(12000),
    })
    const result=await response.json().catch(()=>null)
    if(!response.ok || !result?.id) throw Object.assign(new Error('The email provider did not accept this invitation. Please try again.'),{status:503})
  }

  return async function handleCollab(req, res) {
    const user = findSession(req)
    const url = req.url ?? ''
    const method = req.method ?? ''
    if(method!=='GET' && !user)return reply(res,401,{error:'Please sign in.'})

    // ── GET /api/collab/tasks — list all tasks the user owns or is a member of
    if (url === '/api/collab/tasks' && method === 'GET') {
      if (!user) return reply(res, 401, { error: 'Please sign in.' })
      const tasks = db.prepare(
        'SELECT ct.* FROM collab_tasks ct JOIN collab_members cm ON cm.task_id = ct.id WHERE cm.user_id = ? ORDER BY ct.created_at DESC'
      ).all(user.id)
      return reply(res, 200, { tasks: tasks.map(t => taskView(db, t)) })
    }

    // ── POST /api/collab/tasks — create a shared task
    if (url === '/api/collab/tasks' && method === 'POST') {
      if (!user) return reply(res, 401, { error: 'Please sign in.' })
      if (!origins.includes(req.headers.origin)) return reply(res, 403, { error: 'Forbidden.' })
      if (!req.headers['content-type']?.startsWith('application/json')) return reply(res, 415, { error: 'Use JSON.' })
      limit(`collab:${user.id}`, 60)
      let data; try { data = JSON.parse(await readBody(req, 8192)) } catch (e) { return reply(res, e.status || 400, { error: e.message || 'Invalid request.' }) }
      const title = typeof data.title === 'string' ? data.title.trim() : ''
      if (!title || title.length > 160) return reply(res, 400, { error: 'Enter a task title (1–160 characters).' })
      if (!['High', 'Medium', 'Low'].includes(data.priority)) return reply(res, 400, { error: 'Choose a priority.' })
      if (!/^#[0-9a-f]{6}$/i.test(data.color || '')) return reply(res, 400, { error: 'Use a valid hex color.' })
      if((data.dueDate!==undefined && typeof data.dueDate!=='string') || (data.dueTime!==undefined && typeof data.dueTime!=='string'))return reply(res,400,{error:'Choose a valid date and time.'})
      const dueZone=data.dueZone || defaultZone(user.id)
      if(!text(data.notes || '',20000) || (data.dueDate && deadlineInstant(data.dueDate,data.dueTime,dueZone)===null) || (data.dueTime && !data.dueDate) || (data.dueZone && !validZone(data.dueZone))) return reply(res,400,{error:'Check your notes and deadline.'})
      if(db.prepare('SELECT COUNT(*) AS n FROM collab_tasks WHERE owner_id=?').get(user.id).n>=100)return reply(res,400,{error:'Up to 100 shared tasks per owner.'})
      if(!findSession(req))return reply(res,401,{error:'Please sign in.'})
      if(db.prepare('SELECT title,priority,due_date,due_time FROM collab_tasks WHERE owner_id=?').all(user.id).some(t=>t.title.trim().toLowerCase()===title.toLowerCase() && t.priority===data.priority && t.due_date===(data.dueDate || '') && t.due_time===(data.dueTime || '')))return reply(res,400,{error:'This shared task already exists. Change the title, priority or deadline.'})
      const id = randomBytes(16).toString('hex')
      const ts = now()
      db.exec('BEGIN IMMEDIATE')
      try {
        db.prepare('INSERT INTO collab_tasks (id, owner_id, title, notes, priority, due_date, due_time, status, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, user.id, title, data.notes || '', data.priority, data.dueDate || '', data.dueTime || '', 'todo', data.color, ts, ts)
        db.prepare('INSERT INTO collab_members (task_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)').run(id, user.id, 'owner', ts)
        db.prepare('UPDATE collab_tasks SET due_zone=? WHERE id=?').run(dueZone,id)
        db.exec('COMMIT')
      } catch (err) { db.exec('ROLLBACK'); throw err }
      notifyPlannerChanged(`collab:${user.id}`)
      const task = db.prepare('SELECT * FROM collab_tasks WHERE id = ?').get(id)
      return reply(res, 200, { task: taskView(db, task) })
    }

    const download=url.match(/^\/api\/collab\/tasks\/([a-f0-9]{32})\/files\/([a-f0-9]{16})$/)
    if(download && method==='GET'){
      if(!user || !db.prepare('SELECT 1 FROM collab_members WHERE task_id=? AND user_id=?').get(download[1],user.id))return reply(res,403,{error:'Access denied.'})
      const file=db.prepare('SELECT * FROM collab_files WHERE task_id=? AND id=?').get(download[1],download[2])
      if(!file)return reply(res,404,{error:'File not found.'})
      res.writeHead(200,{'Content-Type':'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Disposition':`attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(file.name).replace(/'/g,'%27')}`})
      return res.end(Buffer.from(file.data,'base64'))
    }
    // ── GET /api/collab/tasks/:id/members/:userId/photo — only people on the same shared task can see each other's photo
    const photoMatch = url.split('?')[0].match(/^\/api\/collab\/tasks\/([a-f0-9]{32})\/members\/([^/]+)\/photo$/)
    if (photoMatch && method === 'GET') {
      const inTask = id => db.prepare('SELECT 1 FROM collab_members WHERE task_id = ? AND user_id = ?').get(photoMatch[1], id)
      if (!user || !inTask(user.id) || !inTask(photoMatch[2])) return reply(res, 403, { error: 'Access denied.' })
      const photo = db.prepare('SELECT image FROM profile_photos WHERE user_id = ?').get(photoMatch[2])
      if (!photo) return reply(res, 404, { error: 'No profile photo.' })
      res.writeHead(200, { 'Content-Type': 'image/webp', 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff' })
      return res.end(Buffer.from(photo.image))
    }
    // ── GET /api/collab/tasks/:id
    const taskMatch = url.match(/^\/api\/collab\/tasks\/([a-f0-9]{32})$/)
    if (taskMatch && method === 'GET') {
      if (!user) return reply(res, 401, { error: 'Please sign in.' })
      const task = db.prepare('SELECT * FROM collab_tasks WHERE id = ?').get(taskMatch[1])
      if (!task) return reply(res, 404, { error: 'Task not found.' })
      const membership = db.prepare('SELECT role FROM collab_members WHERE task_id = ? AND user_id = ?').get(task.id, user.id)
      if (!membership) return reply(res, 403, { error: 'You are not a member of this task.' })
      return reply(res, 200, { task: taskView(db, task) })
    }

    // ── PUT /api/collab/tasks/:id — update task fields
    if (taskMatch && method === 'PUT') {
      if (!user) return reply(res, 401, { error: 'Please sign in.' })
      if (!origins.includes(req.headers.origin)) return reply(res, 403, { error: 'Forbidden.' })
      if (!req.headers['content-type']?.startsWith('application/json')) return reply(res, 415, { error: 'Use JSON.' })
      limit(`collab:${user.id}`, 120)
      const task = db.prepare('SELECT * FROM collab_tasks WHERE id = ?').get(taskMatch[1])
      if (!task) return reply(res, 404, { error: 'Task not found.' })
      const membership = db.prepare('SELECT role FROM collab_members WHERE task_id = ? AND user_id = ?').get(task.id, user.id)
      if (!membership) return reply(res, 403, { error: 'You are not a member of this task.' })
      const isOwner = membership.role === 'owner'
      let data; try { data = JSON.parse(await readBody(req, 44 * 1024 * 1024)) } catch (e) { return reply(res, e.status || 400, { error: e.message || 'Invalid request.' }) }

      const freshTask=db.prepare('SELECT * FROM collab_tasks WHERE id=?').get(task.id)
      const freshMember=db.prepare('SELECT role FROM collab_members WHERE task_id=? AND user_id=?').get(task.id,user.id)
      if(!findSession(req) || !freshMember || !freshTask)return reply(res,403,{error:'Your access has changed. Reload this page.'})
      if(data.revision!==freshTask.revision)return reply(res,409,{error:'This task changed on another device. Reload the task before saving.'})
      const editor=isOwner || freshMember.role==='editor'
      if(!editor){
        if(freshMember.role!=='steps' && freshMember.role!=='member')return reply(res,403,{error:'You have view-only access.'})
        if(Object.keys(data).some(k=>!['revision','subtasks'].includes(k)))return reply(res,403,{error:'You can only update your assigned steps.'})
        const oldSteps=db.prepare('SELECT * FROM collab_subtasks WHERE task_id=? ORDER BY position').all(task.id)
        if(!Array.isArray(data.subtasks) || data.subtasks.length!==oldSteps.length || data.subtasks.some((step,i)=>{const old=oldSteps[i];return !step || step.id!==old.id || step.title!==old.title || (step.assignedTo || null)!==old.assigned_to || (old.assigned_to!==user.id && ((step.notes ?? old.notes)!==old.notes || JSON.stringify(step.links ?? JSON.parse(old.links))!==old.links || Boolean(step.done)!==Boolean(old.done) || stepStatus(step,old)!==stepStatus(old,old)))}))return reply(res,403,{error:'You can only update the notes, links and completion of your assigned steps.'})
      }
      if(data.assignedTo!==undefined && data.assignedTo!==null && typeof data.assignedTo!=='string')return reply(res,400,{error:'Choose a member to assign.'})
      if(data.assignedTo && !db.prepare('SELECT 1 FROM collab_members WHERE task_id=? AND user_id=?').get(task.id,data.assignedTo))return reply(res,400,{error:'Assign this task to a member.'})
      const dueDate=data.dueDate ?? freshTask.due_date, dueTime=data.dueTime ?? freshTask.due_time, dueZone=data.dueZone ?? freshTask.due_zone
      if(typeof dueDate!=='string' || typeof dueTime!=='string' || !validZone(dueZone) || (dueDate && deadlineInstant(dueDate,dueTime,dueZone)===null) || (dueTime && !dueDate))return reply(res,400,{error:'Choose a valid deadline and timezone.'})
      if(!isOwner && dueZone!==freshTask.due_zone)return reply(res,403,{error:'Only the task owner can change the timezone.'})
      // Fields only the owner can change
      if (!editor && (data.title !== undefined || data.priority !== undefined || data.dueDate !== undefined || data.dueTime !== undefined || data.color !== undefined)) {
        return reply(res, 403, { error: 'Only the task owner can edit the title, priority, deadline, and color.' })
      }
      // Validate owner-only fields if present
      if (editor) {
        if (data.title !== undefined) {
          const t = typeof data.title === 'string' ? data.title.trim() : ''
          if (!t || t.length > 160) return reply(res, 400, { error: 'Enter a task title (1–160 characters).' })
        }
        if (data.priority !== undefined && !['High', 'Medium', 'Low'].includes(data.priority)) return reply(res, 400, { error: 'Choose a valid priority.' })
        if (data.color !== undefined && !/^#[0-9a-f]{6}$/i.test(data.color)) return reply(res, 400, { error: 'Use a valid hex color.' })
      }
      // Validate shared fields
      if (data.status !== undefined && !['todo', 'progress', 'done', 'blocked'].includes(data.status)) return reply(res, 400, { error: 'Invalid status.' })
      if (data.notes !== undefined && !text(data.notes, 20000)) return reply(res, 400, { error: 'Notes must be 20,000 characters or fewer.' })

      // Files
      if (data.files !== undefined) {
        if (!Array.isArray(data.files) || data.files.length > MAX_FILES) return reply(res, 400, { error: 'Up to 10 files per task.' })
        let totalBytes = 0
        for (const f of data.files) {
          if (!f || !text(f.type || '',100) || !text(f.name, 255) || !/\.(pdf|docx?|pptx?|png|jpe?g|webp)$/i.test(f.name)) return reply(res, 400, { error: 'Use PDF, Word, PowerPoint, PNG, JPEG, or WebP files.' })
          // If data is empty string and id is provided, it's a "keep existing" signal — validate id exists
          if (!f.data) {
            if (!f.id) return reply(res, 400, { error: 'File ID required when keeping existing file.' })
            const existing = db.prepare('SELECT id,data FROM collab_files WHERE id = ? AND task_id = ?').get(f.id, task.id)
            if (!existing) return reply(res, 400, { error: 'File not found.' })
            totalBytes+=Buffer.byteLength(existing.data,'base64')
            continue
          }
          if (typeof f.data !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(f.data)) return reply(res, 400, { error: 'Invalid file data.' })
          if(f.data.length%4 || f.data.length>13981016)return reply(res,400,{error:'Invalid file data.'})
          const buffer=Buffer.from(f.data,'base64')
          if(/\.(png|jpe?g|webp)$/i.test(f.name)) {
            try {
              const image=sharp(buffer,{limitInputPixels:25000000,failOn:'warning'})
              const meta=await image.metadata()
              const expected=/\.png$/i.test(f.name)?'png':/\.webp$/i.test(f.name)?'webp':'jpeg'
              if(meta.format!==expected || (meta.pages || 1)>1)throw new Error('Invalid image')
              await image.stats()
            } catch {return reply(res,400,{error:'Use a valid PNG, JPEG, or WebP image up to 25 megapixels.'})}
          } else if(!checkFileSignature(buffer,f.name))return reply(res,400,{error:'The file content does not match its document type.'})
          if(f.subtaskId && !db.prepare('SELECT 1 FROM collab_subtasks WHERE task_id=? AND id=?').get(task.id,f.subtaskId))return reply(res,400,{error:'Choose an existing subtask for this file.'})
          const size = Buffer.byteLength(f.data, 'base64')
          if (size > MAX_FILE_BYTES) return reply(res, 400, { error: 'Each file must be 10 MB or smaller.' })
          totalBytes += size
          if (totalBytes > 30 * 1024 * 1024) return reply(res, 400, { error: 'Total file size must be 30 MB or less.' })
        }
      }
        if(data.files){
          const ownBytes=db.prepare('SELECT f.data FROM collab_files f JOIN collab_tasks t ON t.id=f.task_id WHERE t.owner_id=? AND t.id!=?').all(task.owner_id,task.id).reduce((n,f)=>n+Buffer.byteLength(f.data,'base64'),0)
          const finalBytes=data.files.reduce((n,f)=>n+Buffer.byteLength(f.data || db.prepare('SELECT data FROM collab_files WHERE id=? AND task_id=?').get(f.id,task.id)?.data || '', 'base64'),0)
          if(ownBytes+finalBytes>30*1024*1024)return reply(res,400,{error:'Shared attachments are limited to 30 MB per owner.'})
        }
      // Links
      if (data.links !== undefined) {
        if (!Array.isArray(data.links) || data.links.length > MAX_LINKS || data.links.some(l => !text(l, 2048) || !validUrl(l))) return reply(res, 400, { error: 'Use valid http/https links, up to 50 per task.' })
      }
      // Subtasks
      if (data.subtasks !== undefined) {
        if (!Array.isArray(data.subtasks) || data.subtasks.length > MAX_SUBTASKS) return reply(res, 400, { error: 'Up to 100 subtasks per task.' })
        const ids=data.subtasks.filter(s=>s?.id).map(s=>s.id)
        if(new Set(ids).size!==ids.length || ids.some(id=>!db.prepare('SELECT 1 FROM collab_subtasks WHERE id=? AND task_id=?').get(id,task.id)))return reply(res,400,{error:'A step has changed. Reload this task.'})
        for (const s of data.subtasks) {
          if (!s || !text(s.title, 500) || !s.title.trim()) return reply(res, 400, { error: 'Each subtask needs a title up to 500 characters.' })
          if(s.notes!==undefined && !text(s.notes,20000))return reply(res,400,{error:'Delegated notes must be 20,000 characters or fewer.'})
          if(s.links!==undefined && (!Array.isArray(s.links) || s.links.length>50 || s.links.some(url=>!text(url,2048) || !validUrl(url))))return reply(res,400,{error:'Use up to 50 valid http/https links per delegated task.'})
          if(typeof s.done!=='boolean' || (s.status!==undefined && !stepStatuses.includes(s.status)))return reply(res,400,{error:'Invalid step status.'})
          if(s.assignedTo!==undefined && s.assignedTo!==null && typeof s.assignedTo!=='string')return reply(res,400,{error:'Choose a member for this step.'})
          if(s.assignedTo && !db.prepare('SELECT 1 FROM collab_members WHERE task_id=? AND user_id=?').get(task.id,s.assignedTo))return reply(res,400,{error:'Assign steps only to task members.'})
          if (s.assignedTo !== undefined && s.assignedTo !== null && typeof s.assignedTo !== 'string') return reply(res, 400, { error: 'Invalid assignee.' })
        }
      }

      if(!findSession(req) || db.prepare('SELECT role FROM collab_members WHERE task_id=? AND user_id=?').get(task.id,user.id)?.role!==freshMember.role)return reply(res,403,{error:'Your access changed. Reload the task.'})
      if(db.prepare('SELECT revision FROM collab_tasks WHERE id=?').get(task.id)?.revision!==data.revision)return reply(res,409,{error:'This task changed. Reload before saving.'})
      db.exec('BEGIN IMMEDIATE')
      try {
        const ts = now()
        db.prepare('UPDATE collab_tasks SET revision=revision+1,updated_at=?,due_zone=?,assigned_to=? WHERE id=?').run(ts,dueZone,data.assignedTo===undefined?freshTask.assigned_to:data.assignedTo,task.id)
        if (editor) {
          if (data.title !== undefined) db.prepare('UPDATE collab_tasks SET title = ?, updated_at = ? WHERE id = ?').run(data.title.trim(), ts, task.id)
          if (data.priority !== undefined) db.prepare('UPDATE collab_tasks SET priority = ?, updated_at = ? WHERE id = ?').run(data.priority, ts, task.id)
          if (data.dueDate !== undefined) db.prepare('UPDATE collab_tasks SET due_date = ?, updated_at = ? WHERE id = ?').run(data.dueDate || '', ts, task.id)
          if (data.dueTime !== undefined) db.prepare('UPDATE collab_tasks SET due_time = ?, updated_at = ? WHERE id = ?').run(data.dueTime || '', ts, task.id)
          if (data.color !== undefined) db.prepare('UPDATE collab_tasks SET color = ?, updated_at = ? WHERE id = ?').run(data.color, ts, task.id)
        }
        if (data.status !== undefined) db.prepare('UPDATE collab_tasks SET status = ?, updated_at = ? WHERE id = ?').run(data.status, ts, task.id)
        if (data.notes !== undefined) db.prepare('UPDATE collab_tasks SET notes = ?, updated_at = ? WHERE id = ?').run(data.notes, ts, task.id)

        if (data.files !== undefined) {
          // Delete all existing files first, then re-insert
          // Files with empty data + id = keep existing record unchanged
          const keepIds = data.files.filter(f => !f.data && f.id).map(f => f.id)
          if(keepIds.length)db.prepare('DELETE FROM collab_files WHERE task_id = ? AND id NOT IN ('+keepIds.map(()=>'?').join(',')+')').run(task.id,...keepIds)
          else db.prepare('DELETE FROM collab_files WHERE task_id=?').run(task.id)
          for (const f of data.files) {
            if (!f.data) continue  // keep-existing signal, already handled above
            db.prepare('INSERT INTO collab_files (id, task_id, name, type, data, last_modified, subtask_id) VALUES (?, ?, ?, ?, ?, ?, ?)').run(randomBytes(8).toString('hex'), task.id, f.name, f.type || '', f.data, Number(f.lastModified) || 0,f.subtaskId || null)
          }
        }
        if (data.links !== undefined) {
          db.prepare('DELETE FROM collab_links WHERE task_id = ?').run(task.id)
          for (const url of [...new Set(data.links)]) {
            db.prepare('INSERT INTO collab_links (id, task_id, url) VALUES (?, ?, ?)').run(randomBytes(8).toString('hex'), task.id, url)
          }
        }
        if (data.subtasks !== undefined) {
          const oldRows = db.prepare('SELECT * FROM collab_subtasks WHERE task_id = ?').all(task.id)
          const existing = oldRows.map(r => r.id)
          const incoming = data.subtasks.map(s => s.id).filter(Boolean)
          for (const id of existing.filter(id => !incoming.includes(id))) {
            db.prepare('DELETE FROM collab_files WHERE subtask_id=? AND task_id=?').run(id,task.id)
            db.prepare('DELETE FROM collab_subtasks WHERE id = ? AND task_id = ?').run(id, task.id)
          }
          data.subtasks.forEach((s, pos) => {
            if (s.id && existing.includes(s.id)) {
              db.prepare('UPDATE collab_subtasks SET title = ?, done = ?, status = ?, assigned_to = ?, position = ?, notes=COALESCE(?,notes), links=COALESCE(?,links) WHERE id = ? AND task_id = ?').run(s.title.trim(), s.done ? 1 : 0, stepStatus(s, oldRows.find(r => r.id === s.id)), s.assignedTo || null, pos, s.notes ?? null, s.links===undefined?null:JSON.stringify(s.links), s.id, task.id)
            } else {
              db.prepare('INSERT INTO collab_subtasks (id, task_id, title, done, status, assigned_to, position, notes, links) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(randomBytes(8).toString('hex'), task.id, s.title.trim(), s.done ? 1 : 0, stepStatus(s), s.assignedTo || null, pos, s.notes || '', JSON.stringify(s.links || []))
            }
          })
        }
        db.exec('COMMIT')
      } catch (err) { db.exec('ROLLBACK'); throw err }

      // Notify all members via SSE
      const members = db.prepare('SELECT user_id FROM collab_members WHERE task_id = ?').all(task.id)
      for (const m of members) notifyPlannerChanged(`collab:${m.user_id}`)

      const updated = db.prepare('SELECT * FROM collab_tasks WHERE id = ?').get(task.id)
      return reply(res, 200, { task: taskView(db, updated) })
    }

    // ── DELETE /api/collab/tasks/:id — owner only
    if (taskMatch && method === 'DELETE') {
      if (!user) return reply(res, 401, { error: 'Please sign in.' })
      if (!origins.includes(req.headers.origin)) return reply(res, 403, { error: 'Forbidden.' })
      const task = db.prepare('SELECT * FROM collab_tasks WHERE id = ?').get(taskMatch[1])
      if (!task) return reply(res, 404, { error: 'Task not found.' })
      if (task.owner_id !== user.id) return reply(res, 403, { error: 'Only the task owner can delete it.' })
      const members = db.prepare('SELECT user_id FROM collab_members WHERE task_id = ?').all(task.id)
      db.prepare('DELETE FROM collab_tasks WHERE id = ?').run(task.id)
      for (const m of members) notifyPlannerChanged(`collab:${m.user_id}`)
      return reply(res, 200, { ok: true })
    }

    // ── POST /api/collab/tasks/:id/invite — owner sends email invite
    const inviteMatch = url.match(/^\/api\/collab\/tasks\/([a-f0-9]{32})\/invite$/)
    if (inviteMatch && method === 'POST') {
      if (!user) return reply(res, 401, { error: 'Please sign in.' })
      if (!origins.includes(req.headers.origin)) return reply(res, 403, { error: 'Forbidden.' })
      if (!req.headers['content-type']?.startsWith('application/json')) return reply(res, 415, { error: 'Use JSON.' })
      limit(`collab-invite:${user.id}`, 20)
      const task = db.prepare('SELECT * FROM collab_tasks WHERE id = ?').get(inviteMatch[1])
      if (!task) return reply(res, 404, { error: 'Task not found.' })
      if (task.owner_id !== user.id) return reply(res, 403, { error: 'Only the task owner can invite members.' })
      let data; try { data = JSON.parse(await readBody(req, 1024)) } catch { return reply(res, 400, { error: 'Invalid request.' }) }
      const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : ''
      if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply(res, 400, { error: 'Enter a valid email address.' })
      if(!findSession(req))return reply(res,401,{error:'Please sign in.'})
      const permission=data.permission || 'steps'
      if(!['editor','steps','viewer'].includes(permission))return reply(res,400,{error:'Choose a valid permission.'})
      if(db.prepare('SELECT COUNT(*) AS n FROM collab_members WHERE task_id=?').get(task.id).n>=50)return reply(res,400,{error:'Up to 50 members per task.'})
      // Already a member?
      const existing = db.prepare('SELECT u.id FROM users u JOIN collab_members cm ON cm.user_id = u.id WHERE u.email = ? AND cm.task_id = ?').get(email, task.id)
      if (existing) return reply(res, 400, { error: 'This person is already a member.' })
      // Create invite token
      const token = randomBytes(32).toString('hex')
      const tokenHash = digest(token)
      db.prepare('DELETE FROM collab_invites WHERE task_id = ? AND email = ?').run(task.id, email)
      db.prepare('INSERT INTO collab_invites (token_hash, task_id, email, created_by, expires) VALUES (?, ?, ?, ?, ?)').run(tokenHash, task.id, email, user.id, now() + 7 * DAY)
      db.prepare('UPDATE collab_invites SET permission=? WHERE token_hash=?').run(permission,tokenHash)
      try{await sendInviteEmail(task, email, user.name, token)}catch(e){db.prepare('DELETE FROM collab_invites WHERE token_hash=?').run(tokenHash);return reply(res,e.status || 503,{error:e.message || 'Could not send invitation.'})}
      return reply(res, 200, { ok: true, message: `Invite sent to ${email}. They'll need a Petalpace account to accept it.` })
    }

    // ── GET /api/collab/join/:token — preview invite (before accepting)
    const joinMatch = url.match(/^\/api\/collab\/join\/([a-f0-9]{64})$/)
    if (joinMatch && method === 'GET') {
      const invite = db.prepare('SELECT * FROM collab_invites WHERE token_hash = ? AND expires > ?').get(digest(joinMatch[1]), now())
      if (!invite) return reply(res, 400, { error: 'This invite link is invalid or has expired.' })
      const task = db.prepare('SELECT * FROM collab_tasks WHERE id = ?').get(invite.task_id)
      const owner = db.prepare('SELECT name FROM users WHERE id = ?').get(task.owner_id)
      return reply(res, 200, { taskTitle: task.title, ownerName: owner?.name ?? 'Someone', email: invite.email })
    }

    // ── POST /api/collab/join/:token — accept invite
    if (joinMatch && method === 'POST') {
      if (!user) return reply(res, 401, { error: 'Please sign in to accept this invite.' })
      if (!origins.includes(req.headers.origin)) return reply(res, 403, { error: 'Forbidden.' })
      const invite = db.prepare('SELECT * FROM collab_invites WHERE token_hash = ? AND expires > ?').get(digest(joinMatch[1]), now())
      if (!invite) return reply(res, 400, { error: 'This invite link is invalid or has expired.' })
      if (user.email.toLowerCase() !== invite.email.toLowerCase()) return reply(res, 403, { error: `This invite was sent to ${invite.email}. Please sign in with that account.` })
      const already = db.prepare('SELECT 1 FROM collab_members WHERE task_id = ? AND user_id = ?').get(invite.task_id, user.id)
      if (already) { db.prepare('DELETE FROM collab_invites WHERE token_hash = ?').run(digest(joinMatch[1])); return reply(res, 200, { taskId: invite.task_id }) }
      db.exec('BEGIN IMMEDIATE')
      try {
        db.prepare('INSERT INTO collab_members (task_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)').run(invite.task_id, user.id, invite.permission, now())
        db.prepare('DELETE FROM collab_invites WHERE token_hash = ?').run(digest(joinMatch[1]))
        db.exec('COMMIT')
      } catch (err) { db.exec('ROLLBACK'); throw err }
      // Notify all members including new one
      const members = db.prepare('SELECT user_id FROM collab_members WHERE task_id = ?').all(invite.task_id)
      for (const m of members) notifyPlannerChanged(`collab:${m.user_id}`)
      return reply(res, 200, { taskId: invite.task_id })
    }

    // ── DELETE /api/collab/tasks/:id/members/:userId — owner removes a member
    const memberMatch = url.match(/^\/api\/collab\/tasks\/([a-f0-9]{32})\/members\/(.+)$/)
    if(memberMatch && method==='PATCH'){
      if(!user || !origins.includes(req.headers.origin))return reply(res,403,{error:'Access denied.'})
      limit('collab-permission:'+user.id,60)
      const task=db.prepare('SELECT * FROM collab_tasks WHERE id=?').get(memberMatch[1])
      if(!task || task.owner_id!==user.id || memberMatch[2]===user.id)return reply(res,403,{error:'Only the owner can change member permissions.'})
      let body;try{body=JSON.parse(await readBody(req,1024))}catch{return reply(res,400,{error:'Invalid request.'})}
      if(!['editor','steps','viewer'].includes(body.permission))return reply(res,400,{error:'Choose a valid permission.'})
      if(!findSession(req))return reply(res,401,{error:'Please sign in.'})
      db.prepare('UPDATE collab_members SET role=? WHERE task_id=? AND user_id=?').run(body.permission,task.id,memberMatch[2])
      db.prepare('UPDATE collab_tasks SET revision=revision+1 WHERE id=?').run(task.id)
      for(const member of db.prepare('SELECT user_id FROM collab_members WHERE task_id=?').all(task.id))notifyPlannerChanged(`collab:${member.user_id}`)
      return reply(res,200,{task:taskView(db,db.prepare('SELECT * FROM collab_tasks WHERE id=?').get(task.id))})
    }
    if (memberMatch && method === 'DELETE') {
      if (!user) return reply(res, 401, { error: 'Please sign in.' })
      if (!origins.includes(req.headers.origin)) return reply(res, 403, { error: 'Forbidden.' })
      const task = db.prepare('SELECT * FROM collab_tasks WHERE id = ?').get(memberMatch[1])
      if (!task) return reply(res, 404, { error: 'Task not found.' })
      if (task.owner_id !== user.id) return reply(res, 403, { error: 'Only the owner can remove members.' })
      if (memberMatch[2] === user.id) return reply(res, 400, { error: 'The owner cannot be removed.' })
      db.prepare('UPDATE collab_subtasks SET assigned_to=NULL WHERE task_id=? AND assigned_to=?').run(task.id,memberMatch[2])
      db.prepare('UPDATE collab_tasks SET assigned_to=NULL,revision=revision+1 WHERE id=? AND assigned_to=?').run(task.id,memberMatch[2])
      db.prepare('DELETE FROM collab_members WHERE task_id = ? AND user_id = ?').run(task.id, memberMatch[2])
      notifyPlannerChanged(`collab:${memberMatch[2]}`)
      const members = db.prepare('SELECT user_id FROM collab_members WHERE task_id = ?').all(task.id)
      for (const m of members) notifyPlannerChanged(`collab:${m.user_id}`)
      const updated = db.prepare('SELECT * FROM collab_tasks WHERE id = ?').get(task.id)
      return reply(res, 200, { task: taskView(db, updated) })
    }

    // ── DELETE /api/collab/tasks/:id/leave — member leaves
    const leaveMatch = url.match(/^\/api\/collab\/tasks\/([a-f0-9]{32})\/leave$/)
    if (leaveMatch && method === 'DELETE') {
      if (!user) return reply(res, 401, { error: 'Please sign in.' })
      if (!origins.includes(req.headers.origin)) return reply(res, 403, { error: 'Forbidden.' })
      const task = db.prepare('SELECT * FROM collab_tasks WHERE id = ?').get(leaveMatch[1])
      if (!task) return reply(res, 404, { error: 'Task not found.' })
      if (task.owner_id === user.id) return reply(res, 400, { error: 'The owner cannot leave. Delete the task instead.' })
      db.prepare('UPDATE collab_subtasks SET assigned_to=NULL WHERE task_id=? AND assigned_to=?').run(task.id,user.id)
      db.prepare('UPDATE collab_tasks SET assigned_to=NULL,revision=revision+1 WHERE id=? AND assigned_to=?').run(task.id,user.id)
      notifyPlannerChanged(`collab:${user.id}`)
      db.prepare('DELETE FROM collab_members WHERE task_id = ? AND user_id = ?').run(task.id, user.id)
      const members = db.prepare('SELECT user_id FROM collab_members WHERE task_id = ?').all(task.id)
      for (const m of members) notifyPlannerChanged(`collab:${m.user_id}`)
      return reply(res, 200, { ok: true })
    }

    return null  // not handled here
  }
}
