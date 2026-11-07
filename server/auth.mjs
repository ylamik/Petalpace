import { createReminderSettingsHandler } from './reminders.mjs'
import { clientIP } from './client-ip.mjs'
import { createWorkQueue, hashConcurrency } from './work-queue.mjs'
import { emailReady, mailSender } from './mailer.mjs'
import { emailLayout, escapeHtml } from './email-layout.mjs'
import { createPlannerHandler } from './planner.mjs'
import { buildZip } from './zip-builder.mjs'
import { registerSSE } from './sse-broker.mjs'
import { createCollabHandler } from './collab.mjs'
import { randomBytes, randomUUID, createHash, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { passwordError, passwordProblems } from '../src/features/auth/passwordRules.ts'
import { prepareProfilePhoto } from './profile-photo.mjs'

const derive = promisify(scrypt)
const digest = value => createHash('sha256').update(value).digest('hex')
const emailPattern = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i
const validEmail = email => {
  if (email.length > 254 || !emailPattern.test(email)) return false
  const [local, domain] = email.split('@')
  return local.length <= 64 && !local.startsWith('.') && !local.endsWith('.') && !local.includes('..') && domain.split('.').every(label => label.length <= 63)
}
const validPassword = p => typeof p === 'string' && [...p].length >= 15 && [...p].length <= 128
const tokenPattern = /^[a-f0-9]{64}$/
const DAY = 86400000

// OWASP scrypt baseline. Random salt per password; only the hash is stored.
async function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const hash = await derive(password, salt, 64, { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 })
  return `${salt}:${hash.toString('hex')}`
}
async function checkPassword(password, stored) {
  const salt = stored?.split(':')[0] || '00000000000000000000000000000000'
  const actual = (await hashPassword(password, salt)).split(':')[1]
  const expected = stored?.split(':')[1] || '0'.repeat(128)
  return timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex')) && !!stored
}

export function createAuthHandler({ db, env = process.env, send, now = Date.now }) {
  send ??= mailSender(env)
  const production = env.NODE_ENV === 'production'
  const trustedProxy = env.TRUSTED_PROXY || ''
  const cookieName = production ? '__Host-petalpace' : 'petalpace_session'
  const ipFrom = req => clientIP(req, trustedProxy)
  const publicUrl = new URL(env.APP_URL || 'http://localhost:5173')
  if (production && publicUrl.protocol !== 'https:') throw new Error('APP_URL must use HTTPS in production.')
  const origins = (env.APP_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173').split(',').map(x => x.trim())
  const runHash = createWorkQueue({ concurrency: hashConcurrency(env) })
  const cookie = (value, age) => `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${production ? '; Secure' : ''}`
  const sessionHash = req => {
    const value = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(cookieName + '='))?.slice(cookieName.length + 1)
    return value && tokenPattern.test(value) ? digest(value) : ''
  }
  const userView = row => {
    const photo = db.prepare('SELECT version FROM profile_photos WHERE user_id = ?').get(row.id)
    return { id: row.id, name: row.name, email: row.email, photoUrl: photo ? `/api/auth/photo?v=${photo.version}` : null, showReminderTip: !!row.reminder_tip }
  }
  const findSession = req => db.prepare('SELECT users.* FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.hash = ? AND sessions.expires > ? AND users.verified = 1').get(sessionHash(req), now())
  function limit(key, max, period = 15 * 60000) {
    db.prepare('DELETE FROM auth_limits WHERE expires <= ?').run(now())
    const row = db.prepare('SELECT count FROM auth_limits WHERE key = ?').get(key)
    if ((row?.count || 0) >= max) throw Object.assign(new Error('Too many attempts. Please try again in 15 minutes.'), { status: 429 })
    db.prepare('INSERT INTO auth_limits (key, count, expires) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = count + 1').run(key, now() + period)
  }
  async function emailToken(user, purpose) {
    const from = env.AUTH_FROM || env.FEEDBACK_FROM
    if (!emailReady(env) || !from) throw Object.assign(new Error('Account email delivery is not configured yet. Please try again later.'), { status: 503 })
    const token = randomBytes(32).toString('hex')
    const hash = digest(token)
    const route = purpose === 'verify' ? '/verify-email' : '/reset-password'
    const link = new URL(route, publicUrl)
    link.hash = `token=${token}`
    db.prepare('INSERT INTO auth_tokens (hash, user_id, purpose, expires) VALUES (?, ?, ?, ?)').run(hash, user.id, purpose, now() + 30 * 60000)
    // Account emails read like a note from a person: a greeting, why it was sent, and what
    // happens next. A short button-only email from a new sender looks like phishing to spam filters.
    // They also skip the remote logo, since a lone image from an unknown site adds to the spam score.
    const name = String(user.name || '').trim().split(/\s+/)[0] || 'there'
    const verify = purpose === 'verify'
    const subject = verify ? `${name}, please confirm your email for Petalpace` : 'Your Petalpace password reset link'
    const paragraphs = verify ? [
      `Hi ${name},`,
      `Thanks for signing up for Petalpace, a calm planner for your studies and your days. Please confirm that ${user.email} is your email address so we can finish creating your account.`,
      'Once it is confirmed, you can sign in and start adding your spaces and tasks.',
    ] : [
      `Hi ${name},`,
      `Someone asked to reset the password for the Petalpace account that uses ${user.email}. If it was you, use the link below to choose a new password.`,
      'If you did not ask for this, you can ignore this email. Your password will stay the same.',
    ]
    const footer = verify
      ? 'This link works once and expires in 30 minutes. If you did not sign up for Petalpace, you can safely ignore this email.'
      : 'This link works once and expires in 30 minutes. For your security, please do not forward this email.'
    try {
      const response = await send('https://api.resend.com/emails', {
        method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [user.email], subject,
          text: `${paragraphs.join('\n\n')}\n\n${verify ? 'Confirm your email' : 'Choose a new password'}:\n${link.href}\n\n${footer}\n\nThe Petalpace team`,
          html: emailLayout(verify ? 'Welcome to Petalpace' : 'Reset your password',
            paragraphs.map((text, index) => `<p style="margin:${index ? '12px' : '0'} 0 0">${escapeHtml(text)}</p>`).join(''),
            link.href, verify ? 'Confirm my email' : 'Choose a new password',
            { preheader: verify ? 'One quick step to finish creating your Petalpace account.' : 'Use this link to choose a new Petalpace password.', footer: escapeHtml(footer) }) }),
        signal: AbortSignal.timeout(12000),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok || !result?.id) throw new Error('Email rejected')
      db.prepare('DELETE FROM auth_tokens WHERE user_id = ? AND purpose = ? AND hash != ?').run(user.id, purpose, hash)
    } catch {
      db.prepare('DELETE FROM auth_tokens WHERE hash = ?').run(hash)
      throw Object.assign(new Error('We could not send the account email. Please try again later. During local testing, the Resend test sender can only email its account owner.'), { status: 503 })
    }
  }
  // Sends without holding up the reply. Forgot-password answers the same way for every email,
  // so the send can't reveal an account through a failure or a slower response. Failures stay in the log.
  const emailInBackground = (user, purpose) => {
    emailToken(user, purpose).catch(error => console.error(`Account email (${purpose}) failed: ${error.message}`))
  }
  const reminderSettings=createReminderSettingsHandler({db,findSession,origins,limit,env})
  const planner = createPlannerHandler({db,findSession,origins,limit,now})
  const collab = createCollabHandler({db,findSession,origins,limit,send,env,now})
  return async function handleAuth(req, res) {
    const reply = (status, data, headers = {}) => {
      res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', ...headers })
      res.end(JSON.stringify(data))
    }
    try {
      // Every route sits inside this try, so a limit or database error keeps its proper status.
      if (req.url === '/api/auth/reminders') return await reminderSettings(req,res)
      if (req.url === '/api/auth/planner' || req.url === '/api/auth/planner/version' || req.url?.startsWith('/api/auth/planner/files/')) return await planner(req,res)
      if (req.url?.startsWith('/api/collab/')) {
        const handled = await collab(req, res)
        if (handled !== null) return
      }
      db.prepare('DELETE FROM sessions WHERE expires <= ?').run(now())
      db.prepare('DELETE FROM auth_tokens WHERE expires <= ?').run(now())
      if ((req.url === '/api/auth/photo' || req.url?.startsWith('/api/auth/photo?')) && req.method === 'GET') {
        const user = findSession(req)
        if (!user) return reply(401, { error: 'Please sign in.' })
        const photo = db.prepare('SELECT image FROM profile_photos WHERE user_id = ?').get(user.id)
        if (!photo) return reply(404, { error: 'No profile photo.' })
        res.writeHead(200, { 'Content-Type': 'image/webp', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' })
        return res.end(Buffer.from(photo.image))
      }
      if (req.url === '/api/auth/me' && req.method === 'GET') {
        const user = findSession(req)
        return reply(user ? 200 : 401, { user: user ? userView(user) : null })
      }
      if (req.url === '/api/auth/stream' && req.method === 'GET') {
        const user = findSession(req)
        if (!user) return reply(401, { error: 'Please sign in.' })
        // Subscribe to both personal planner changes and collaboration task changes
        registerSSE([user.id, `collab:${user.id}`], res, () => findSession(req)?.id === user.id)
        return
      }
      if (req.url === '/api/auth/export' && req.method === 'GET') {
        const user = findSession(req)
        if (!user) return reply(401, { error: 'Please sign in.' })
        const row = db.prepare('SELECT revision,data FROM planners WHERE user_id = ?').get(user.id)
        const planner = row ? JSON.parse(row.data) : { spaces: [], tasks: [] }
        const exportedAt = new Date().toISOString().slice(0, 10)

        // ── 1. Build tasks.csv ────────────────────────────────────────────
        const cell = value => {let v=value==null?'':String(value);if(/^[\s]*[=+@-]|^[\t\r\n]/.test(v))v="'"+v;return '"'+v.replace(/"/g,'""')+'"'}
        const csvLine = cols => cols.map(cell).join(',')
        const headers = ['Title','Space','Status','Priority','Due Date','Due Time','Timezone',
          'Notes','Pinned','Steps (total)','Steps (completed)','Step list','Links','Files']
        const dataRows = (planner.tasks ?? []).map(task => {
          const status = task.done ? 'Done' : task.blocked ? 'Blocked' : task.started ? 'In progress' : 'To do'
          return [
            task.title, task.space, status, task.priority,
            task.dueDate || '', task.dueTime || '', task.dueZone || '', task.notes || '',
            task.pinned ? 'Yes' : 'No',
            (task.steps ?? []).length,
            (task.completedSteps ?? []).length,
            (task.steps ?? []).join(' | '),
            (task.links ?? []).join(' | '),
            (task.files ?? []).map(f => f.name).join(' | '),
          ]
        })
        // UTF-8 BOM so Excel opens without an import wizard
        const csv = '\uFEFF' + [csvLine(headers), ...dataRows.map(csvLine)].join('\r\n')

        // ── 2. Collect file attachments ───────────────────────────────────
        const zipEntries = [{ name: 'tasks.csv', data: Buffer.from(csv, 'utf8') }]
        for (const task of (planner.tasks ?? [])) {
          for (const file of (task.files ?? [])) {
            const stored = db.prepare('SELECT data FROM planner_files WHERE id = ? AND user_id = ?').get(file.id, user.id)
            if (!file.name || !stored) continue
            // Sanitise the task title so it's safe as a folder name
            const folder = task.title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim().slice(0, 60) || task.id
            zipEntries.push({
              name: `files/${folder}-${String(task.id).replace(/[^a-zA-Z0-9_-]/g,'_')}/${(task.files ?? []).indexOf(file)}-${file.name.replace(/[<>:"/\\|?*\x00-\x1f]/g,'_')}`, 
              data: Buffer.from(stored.data),
            })
          }
        }

        const zipBuffer = buildZip(zipEntries)

        res.writeHead(200, {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="petalpace-export-${exportedAt}.zip"`,
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        })
        return res.end(zipBuffer)
      }
      const actions = ['register', 'login', 'logout', 'verify', 'resend', 'forgot-password', 'reset-password', 'photo', 'photo-remove', 'delete-account', 'reminder-tip-seen']
      const action = req.url?.slice('/api/auth/'.length)
      if (!actions.includes(action)) return reply(404, { error: 'Not found.' })
      if (req.method !== 'POST') return reply(405, { error: 'Use POST.' })
      // CSRF protection: exact trusted origin plus JSON; no permissive CORS.
      if (!origins.includes(req.headers.origin)) return reply(403, { error: 'Please submit from the Petalpace website.' })
      if (!req.headers['content-type']?.startsWith('application/json')) return reply(415, { error: 'Use JSON.' })
      const profileUser = action.startsWith('photo') ? findSession(req) : null
      if (action.startsWith('photo') && !profileUser) return reply(401, { error: 'Please sign in again.' })
      let body = ''
      for await (const chunk of req) {
        body += chunk
        if (Buffer.byteLength(body) > (action === 'photo' ? 2800000 : 8192)) return reply(413, { error: 'Request is too large. Photos must be 2 MB or smaller.' })
      }
      let data
      try { data = JSON.parse(body) } catch { return reply(400, { error: 'Invalid request.' }) }
      if (!data || typeof data !== 'object' || Array.isArray(data)) return reply(400, { error: 'Invalid request.' })
      if (action === 'logout') {
        db.prepare('DELETE FROM sessions WHERE hash = ?').run(sessionHash(req))
        return reply(200, { ok: true }, { 'Set-Cookie': cookie('', 0) })
      }
      if (action === 'reminder-tip-seen') {
        const member = findSession(req)
        if (!member) return reply(401, { error: 'Please sign in again.' })
        db.prepare('UPDATE users SET reminder_tip = 0 WHERE id = ?').run(member.id)
        return reply(200, { ok: true })
      }
      const ip = ipFrom(req)
      limit(`ip:${ip}`, 60)
      if (action === 'photo' || action === 'photo-remove') {
        limit(`photo:${profileUser.id}`, 10)
        if (action === 'photo-remove') db.prepare('DELETE FROM profile_photos WHERE user_id = ?').run(profileUser.id)
        else {
          const image = await prepareProfilePhoto(data.image)
          // Re-verify session atomically after the async sharp processing
          // to prevent a TOCTOU race between expiry check and DB write.
          db.exec('BEGIN IMMEDIATE')
          try {
            const stillValid = findSession(req)
            if (!stillValid || stillValid.id !== profileUser.id) {
              db.exec('ROLLBACK')
              return reply(401, { error: 'Please sign in again.' })
            }
            db.prepare('INSERT INTO profile_photos (user_id, image, version) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET image = excluded.image, version = excluded.version').run(profileUser.id, image, randomUUID())
            db.exec('COMMIT')
          } catch (err) { db.exec('ROLLBACK'); throw err }
        }
        return reply(200, { ok: true, user: userView(profileUser) })
      }
      if (action === 'delete-account') {
        const user = findSession(req)
        if (!user) return reply(401, { error: 'Please sign in.' })
        if (typeof data.password !== 'string' || !data.password || [...data.password].length > 128) return reply(400, { error: 'Enter your password to confirm deletion.' })
        const matches = await runHash(() => checkPassword(data.password, user.password_hash))
        if (!matches) return reply(401, { error: 'Password is incorrect.' })
        const current = findSession(req)
        if (!current || current.id !== user.id || current.password_hash !== user.password_hash) return reply(401, { error: 'Please sign in again before deleting your account.' })
        db.prepare('DELETE FROM users WHERE id = ?').run(user.id)
        return reply(200, { ok: true, message: 'Your account and all data have been deleted.' }, { 'Set-Cookie': cookie('', 0) })
      }
      if (action === 'verify' || action === 'reset-password') {
        if (typeof data.token !== 'string' || !tokenPattern.test(data.token)) return reply(400, { error: 'This link is invalid or expired. Please request a new one.' })
        const purpose = action === 'verify' ? 'verify' : 'reset'
        const record = db.prepare('SELECT * FROM auth_tokens WHERE hash = ? AND purpose = ? AND expires > ?').get(digest(data.token), purpose, now())
        if (!record) return reply(400, { error: 'This link is invalid or expired. Please request a new one.' })
        let passwordHash
        if (purpose === 'reset') {
          if (!validPassword(data.password)) return reply(400, { error: 'Use a password with 15–128 characters.' })
          const owner = db.prepare('SELECT email, name FROM users WHERE id = ?').get(record.user_id)
          const weak = passwordError(passwordProblems(data.password, owner || {}))
          if (weak) return reply(400, { error: weak })
          passwordHash = await runHash(() => hashPassword(data.password))
        }
        // Recheck after asynchronous hashing; consume and mutate atomically.
        db.exec('BEGIN IMMEDIATE')
        try {
          const consumed = db.prepare('DELETE FROM auth_tokens WHERE hash = ? AND expires > ?').run(digest(data.token), now())
          if (!consumed.changes) { db.exec('ROLLBACK'); return reply(400, { error: 'This link is invalid or expired. Please request a new one.' }) }
          if (purpose === 'reset') {
            db.prepare('UPDATE users SET password_hash = ?, verified = 1 WHERE id = ?').run(passwordHash, record.user_id)
            db.prepare('DELETE FROM sessions WHERE user_id = ?').run(record.user_id)
            db.prepare('DELETE FROM auth_tokens WHERE user_id = ?').run(record.user_id)
          } else db.prepare('UPDATE users SET verified = 1 WHERE id = ?').run(record.user_id)
          db.exec('COMMIT')
        } catch (error) { db.exec('ROLLBACK'); throw error }
        return reply(200, { ok: true, message: purpose === 'verify' ? 'Email verified! You can now sign in.' : 'Password updated. Please sign in with your new password.' })
      }
      const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : ''
      if (!validEmail(email)) return reply(400, { error: 'Enter a valid email address.' })
      // Login counts per email and IP first, so one attacker can't lock the real user out.
      // The wider per-email ceiling still stops guessing spread across many addresses.
      if (action === 'login') limit(`login:${digest(email)}:${digest(ip)}`, 10)
      limit(`${action}:${digest(email)}`, action === 'login' ? 50 : 3)
      const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
      if (action === 'forgot-password') {
        if (user) emailInBackground(user, 'reset')
        return reply(200, { ok: true, message: 'If this email has an account, a password reset link will arrive shortly.' })
      }
      const password = data.password
      if (typeof password !== 'string' || !password || [...password].length > 128) return reply(400, { error: 'Enter your password (up to 128 characters).' })
      if (action === 'register') {
        const name = typeof data.name === 'string' ? data.name.trim() : ''
        if (!name || name.length > 100 || !validPassword(password)) return reply(400, { error: 'Enter your name and a password with 15–128 characters.' })
        const weak = passwordError(passwordProblems(password, { email, name }))
        if (weak) return reply(400, { error: weak })
        const passwordHash = await runHash(() => hashPassword(password))
        // INSERT OR IGNORE also handles concurrent requests for the same email.
        const created = db.prepare('INSERT OR IGNORE INTO users (id, email, name, password_hash, reminder_tip) VALUES (?, ?, ?, ?, 1)').run(randomUUID(), email, name, passwordHash).changes === 1
        const account = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
        // Sign-up says plainly when an email is taken, so people aren't left waiting for an
        // email that will never come. The per-email and per-IP limits above slow bulk probing.
        if (account.verified) return reply(409, { error: 'An account with this email already exists. Sign in, or reset your password if you forgot it.', code: 'EMAIL_TAKEN' })
        // A new account skips the second (slow) hash: its password was just stored.
        if (created || await runHash(() => checkPassword(password, account.password_hash))) {
          emailInBackground(account, 'verify')
          return reply(200, { ok: true, code: created ? 'VERIFY_SENT' : 'VERIFY_RESENT', message: created
            ? `Almost done! We sent a verification link to ${email}. It usually arrives within a minute. Check Spam too.`
            : `You already started signing up with this email, so we sent a new verification link to ${email}. Check Spam too.` })
        }
        return reply(409, { error: 'This email already has an account waiting to be verified, with a different password. Reset your password to finish setting it up.', code: 'EMAIL_PENDING' })
      }
      const matches = await runHash(() => checkPassword(password, user?.password_hash))
      if (!matches || !user) return reply(401, { error: 'Email or password is incorrect.' })
      const current = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id)
      if (!current || current.password_hash !== user.password_hash) return reply(401, { error: 'Email or password is incorrect.' })
      if (action === 'resend') {
        if (!user.verified) await emailToken(user, 'verify')
        return reply(200, { ok: true, message: 'Check your inbox for a verification link. If already verified, you can sign in.' })
      }
      if (!current.verified) return reply(403, { error: 'Please verify your email before signing in.', code: 'EMAIL_UNVERIFIED' })
      // An existing session is rotated rather than reused on login.
      db.prepare('DELETE FROM sessions WHERE hash = ?').run(sessionHash(req))
      const token = randomBytes(32).toString('hex')
      db.prepare('INSERT INTO sessions (hash, user_id, expires) VALUES (?, ?, ?)').run(digest(token), user.id, now() + 7 * DAY)
      return reply(200, { user: userView(user) }, { 'Set-Cookie': cookie(token, 7 * 86400) })
    } catch (error) {
      if (res.headersSent) return res.destroy()
      return reply(error.status || 500, { error: error.status ? error.message : 'Something went wrong. Please try again.' })
    }
  }
}
