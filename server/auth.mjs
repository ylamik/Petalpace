import { clientIP } from './client-ip.mjs'
import { createPlannerHandler } from './planner.mjs'
import { randomBytes, randomUUID, createHash, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
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

export function createAuthHandler({ db, env = process.env, send = fetch, now = Date.now }) {
  const production = env.NODE_ENV === 'production'
  const trustedProxy = env.TRUSTED_PROXY || ''
  const cookieName = production ? '__Host-petalpace' : 'petalpace_session'
  const ipFrom = req => clientIP(req, trustedProxy)
  const publicUrl = new URL(env.APP_URL || 'http://localhost:5173')
  if (production && publicUrl.protocol !== 'https:') throw new Error('APP_URL must use HTTPS in production.')
  const origins = (env.APP_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173').split(',').map(x => x.trim())
  let hashing = 0
  const runHash = async (work) => {
    if (hashing >= 2) throw Object.assign(new Error('Please wait a moment and try again.'), { status: 429 })
    hashing++
    try { return await work() } finally { hashing-- }
  }
  const cookie = (value, age) => `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${production ? '; Secure' : ''}`
  const sessionHash = req => {
    const value = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(cookieName + '='))?.slice(cookieName.length + 1)
    return value && tokenPattern.test(value) ? digest(value) : ''
  }
  const userView = row => {
    const photo = db.prepare('SELECT version FROM profile_photos WHERE user_id = ?').get(row.id)
    return { id: row.id, name: row.name, email: row.email, photoUrl: photo ? `/api/auth/photo?v=${photo.version}` : null }
  }
  const findSession = req => db.prepare('SELECT users.* FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.hash = ? AND sessions.expires > ? AND users.verified = 1').get(sessionHash(req), now())
  function limit(key, max, period = 15 * 60000) {
    db.prepare('DELETE FROM auth_limits WHERE expires <= ?').run(now())
    const row = db.prepare('SELECT count FROM auth_limits WHERE key = ?').get(key)
    if (!row && db.prepare('SELECT COUNT(*) AS count FROM auth_limits').get().count >= 10000) throw Object.assign(new Error('Please try again later.'), { status: 429 })
    if ((row?.count || 0) >= max) throw Object.assign(new Error('Too many attempts. Please try again in 15 minutes.'), { status: 429 })
    db.prepare('INSERT INTO auth_limits (key, count, expires) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = count + 1').run(key, now() + period)
  }
  async function emailToken(user, purpose) {
    const from = env.AUTH_FROM || env.FEEDBACK_FROM
    if (!env.RESEND_API_KEY || !from) throw Object.assign(new Error('Account email delivery is not configured yet. Please try again later.'), { status: 503 })
    const token = randomBytes(32).toString('hex')
    const hash = digest(token)
    const route = purpose === 'verify' ? '/verify-email' : '/reset-password'
    const link = new URL(route, publicUrl)
    link.hash = `token=${token}`
    const action = purpose === 'verify' ? 'Verify your Petalpace email' : 'Reset your Petalpace password'
    db.prepare('INSERT INTO auth_tokens (hash, user_id, purpose, expires) VALUES (?, ?, ?, ?)').run(hash, user.id, purpose, now() + 30 * 60000)
    try {
      const response = await send('https://api.resend.com/emails', {
        method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [user.email], subject: action,
          text: `${action}\n\nOpen this link and confirm on the page:\n${link.href}\n\nThis link expires in 30 minutes and can be used once. If you did not request this, ignore this email. Never forward this link.` }),
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
  const planner = createPlannerHandler({db,findSession,origins,limit,now})
  return async function handleAuth(req, res) {
    if (req.url === '/api/auth/planner') return planner(req,res)
    const reply = (status, data, headers = {}) => {
      res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', ...headers })
      res.end(JSON.stringify(data))
    }
    try {
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
      if (req.url === '/api/auth/export' && req.method === 'GET') {
        const user = findSession(req)
        if (!user) return reply(401, { error: 'Please sign in.' })
        const row = db.prepare('SELECT revision,data FROM planners WHERE user_id = ?').get(user.id)
        const activityRows = db.prepare('SELECT day,COUNT(*) AS count FROM completions WHERE user_id=? GROUP BY day ORDER BY day').all(user.id)
        const exportData = JSON.stringify({
          exportedAt: new Date().toISOString(),
          account: { name: user.name, email: user.email },
          planner: row ? JSON.parse(row.data) : { spaces: [], tasks: [] },
          activity: activityRows,
          bin: db.prepare('SELECT data,deleted_at FROM task_trash WHERE user_id=? AND data IS NOT NULL AND deleted_at>?').all(user.id,now()-30*86400000).map(row=>({...JSON.parse(row.data),deletedAt:row.deleted_at})),
          revision: row?.revision ?? 0,
        }, null, 2)
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': 'attachment; filename="petalpace-export.json"',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        })
        return res.end(exportData)
      }
      const actions = ['register', 'login', 'logout', 'verify', 'resend', 'forgot-password', 'reset-password', 'photo', 'photo-remove', 'delete-account']
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
      limit(`${action}:${digest(email)}`, action === 'login' ? 10 : 3)
      const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
      if (action === 'forgot-password') {
        if (user) await emailToken(user, 'reset')
        return reply(200, { ok: true, message: 'If this email has an account, a password reset link will arrive shortly.' })
      }
      const password = data.password
      if (typeof password !== 'string' || !password || [...password].length > 128) return reply(400, { error: 'Enter your password (up to 128 characters).' })
      if (action === 'register') {
        const name = typeof data.name === 'string' ? data.name.trim() : ''
        if (!name || name.length > 100 || !validPassword(password)) return reply(400, { error: 'Enter your name and a password with 15–128 characters.' })
        const passwordHash = await runHash(() => hashPassword(password))
        // INSERT OR IGNORE also handles concurrent requests for the same email.
        db.prepare('INSERT OR IGNORE INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)').run(randomUUID(), email, name, passwordHash)
        const account = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
        if (!account.verified && await runHash(() => checkPassword(password, account.password_hash))) await emailToken(account, 'verify')
        return reply(200, { ok: true, message: 'If this address is available, check your inbox for a verification link. Already registered? Sign in or reset your password.' })
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
      return reply(error.status || 500, { error: error.status ? error.message : 'Something went wrong. Please try again.' })
    }
  }
}
