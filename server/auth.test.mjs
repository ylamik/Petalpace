import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createAuthStore } from './auth-store.mjs'
import { createAuthHandler } from './auth.mjs'
import { createFeedbackServer } from './feedback.mjs'

const password = 'My little garden grows!'
const email = 'mikyla@example.com'
const origin = 'http://localhost:5173'
async function fixture(t, options = {}) {
  const db = createAuthStore(options.path)
  const messages = []
  let clock = Date.now()
  const env = { APP_URL: origin, APP_ORIGINS: origin, RESEND_API_KEY: 'fake-test-key', FEEDBACK_FROM: 'test@example.com', ...options.env }
  const handler = createAuthHandler({ db, env, now: () => clock, send: async (_, request) => {
    messages.push(JSON.parse(request.body))
    return Response.json(options.failEmail ? { error: 'failure' } : { id: 'mock-id' }, { status: options.failEmail ? 403 : 200 })
  } })
  const server = createFeedbackServer({ auth: handler, env: {} })
  await new Promise((resolve, reject) => { server.on('error', reject); server.listen(0, '127.0.0.1', resolve) })
  const stop = async () => { await new Promise(resolve => { server.close(resolve); server.closeAllConnections() }); db.close() }
  t.after(stop)
  const request = (action, data, cookie = '', requestOrigin = origin) => fetch(`http://127.0.0.1:${server.address().port}/api/auth/${action}`, {
    method: data === undefined ? 'GET' : 'POST', headers: { Origin: requestOrigin, 'Content-Type': 'application/json', Cookie: cookie }, body: data === undefined ? undefined : JSON.stringify(data),
  })
  const token = () => /#token=([a-f0-9]+)/.exec(messages.at(-1).text)[1]
  const signup = (overrides = {}) => request('register', { email, password, name: 'Mikyla', ...overrides })
  return { db, messages, request, signup, token, advance: ms => { clock += ms } }
}

test('verified account survives restart; login, logout and session revocation work', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'petalpace-auth-test-'))
  const path = join(directory, 'accounts.sqlite')
  const f = await fixture(t, { path })
  t.after(() => {
    for (const suffix of ['', '-wal', '-shm']) rmSync(path + suffix, { force: true })
    rmdirSync(directory)
  })
  assert.equal((await f.request('me')).status, 401)
  assert.equal((await f.signup()).status, 200)
  assert.equal(f.messages.length, 1)
  assert.deepEqual(f.messages[0].to, [email])
  assert.equal((await f.request('login', { email, password })).status, 403)
  const stored = f.db.prepare('SELECT * FROM users').get()
  assert.notEqual(stored.password_hash, password)
  assert.ok(!stored.password_hash.includes(password))
  const verificationToken = f.token()
  assert.notEqual(f.db.prepare('SELECT hash FROM auth_tokens').get().hash, verificationToken)
  assert.equal((await f.request('verify', { token: verificationToken })).status, 200)
  assert.equal((await f.request('verify', { token: verificationToken })).status, 400)
  const wrong = await f.request('login', { email, password: 'Wrong password here' })
  assert.equal(wrong.status, 401)
  assert.equal((await wrong.json()).error, 'Email or password is incorrect.')
  const login = await f.request('login', { email: 'MIKYLA@example.com', password })
  assert.equal(login.status, 200)
  const setCookie = login.headers.get('set-cookie')
  assert.match(setCookie, /HttpOnly/)
  assert.match(setCookie, /SameSite=Lax/)
  const cookie = setCookie.split(';')[0]
  assert.equal((await (await f.request('me', undefined, cookie)).json()).user.name, 'Mikyla')
  const reopened = createAuthStore(path)
  assert.equal(reopened.prepare('SELECT verified FROM users WHERE email = ?').get(email).verified, 1)
  reopened.close()
  assert.equal((await f.request('logout', {}, cookie)).status, 200)
  assert.equal((await f.request('me', undefined, cookie)).status, 401)
  assert.equal((await f.request('login', { email, password })).status, 200)
})

test('SQL injection strings remain data; invalid input and foreign origins are rejected', async t => {
  const f = await fixture(t)
  assert.equal((await f.signup({ email: 'invented' })).status, 400)
  assert.equal((await f.signup({ email: 'two..dots@example.com' })).status, 400)
  assert.equal((await f.signup({ email: '.leading@example.com' })).status, 400)
  assert.equal((await f.signup({ password: 'short' })).status, 400)
  assert.equal((await f.request('register', { email, password, name: 'Mikyla' }, '', 'https://evil.example')).status, 403)
  const name = "Mikyla'); DROP TABLE users; --"
  assert.equal((await f.signup({ name })).status, 200)
  assert.equal(f.db.prepare('SELECT name FROM users').get().name, name)
  assert.equal((await f.request('login', { email: "' OR 1=1 --", password })).status, 400)
  assert.equal((await f.request('login', { email, password: "' OR 1=1 --" })).status, 401)
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM users').get().n, 1)
})

test('password reset expires, is single-use, and revokes prior sessions', async t => {
  const f = await fixture(t)
  await f.signup()
  await f.request('verify', { token: f.token() })
  const login = await f.request('login', { email, password })
  const cookie = login.headers.get('set-cookie').split(';')[0]
  assert.equal((await f.request('forgot-password', { email })).status, 200)
  const expired = f.token()
  f.advance(31 * 60000)
  assert.equal((await f.request('reset-password', { token: expired, password: 'Another secure passphrase!' })).status, 400)
  await f.request('forgot-password', { email })
  const fresh = f.token()
  assert.equal((await f.request('reset-password', { token: fresh, password: 'Another secure passphrase!' })).status, 200)
  assert.equal((await f.request('reset-password', { token: fresh, password })).status, 400)
  assert.equal((await f.request('me', undefined, cookie)).status, 401)
  assert.equal((await f.request('login', { email, password })).status, 401)
  assert.equal((await f.request('login', { email, password: 'Another secure passphrase!' })).status, 200)
})

test('verification expires and failed email delivery never grants access', async t => {
  const f = await fixture(t)
  await f.signup()
  const token = f.token()
  f.advance(31 * 60000)
  assert.equal((await f.request('verify', { token })).status, 400)
  assert.equal((await f.request('resend', { email, password })).status, 200)
  assert.notEqual(f.token(), token)
  const failed = await fixture(t, { failEmail: true })
  assert.equal((await failed.signup()).status, 503)
  assert.equal(failed.db.prepare('SELECT verified FROM users').get().verified, 0)
  assert.equal(failed.db.prepare('SELECT COUNT(*) AS n FROM auth_tokens').get().n, 0)
  assert.equal((await failed.request('login', { email, password })).status, 403)
})

test('duplicate signup cannot replace a password; login attempts are limited', async t => {
  const f = await fixture(t)
  await f.signup()
  const original = f.db.prepare('SELECT password_hash FROM users').get().password_hash
  await f.signup({ password: 'An attacker password here' })
  assert.equal(f.db.prepare('SELECT password_hash FROM users').get().password_hash, original)
  assert.equal(f.messages.length, 1)
  for (let i = 0; i < 10; i++) assert.equal((await f.request('login', { email, password: 'incorrect password' })).status, 401)
  assert.equal((await f.request('login', { email, password })).status, 429)
})

test('expired sessions fail and production cookies are Secure', async t => {
  const f = await fixture(t, { env: { NODE_ENV: 'production', APP_URL: 'https://petalpace.example' } })
  await f.signup()
  await f.request('verify', { token: f.token() })
  const response = await f.request('login', { email, password })
  const setCookie = response.headers.get('set-cookie')
  assert.match(setCookie, /__Host-petalpace=/)
  assert.match(setCookie, /; Secure/)
  const cookie = setCookie.split(';')[0]
  const raw = cookie.split('=')[1]
  assert.equal(f.db.prepare('SELECT hash FROM sessions').get().hash, createHash('sha256').update(raw).digest('hex'))
  f.advance(8 * 86400000)
  assert.equal((await f.request('me', undefined, cookie)).status, 401)
})


test('export is private and password-confirmed deletion revokes account access',async t=>{
  const f=await fixture(t)
  await f.signup();await f.request('verify',{token:f.token()})
  const response=await f.request('login',{email,password});const cookie=response.headers.get('set-cookie').split(';')[0]
  assert.equal((await f.request('export')).status,401)
  const exported=await f.request('export',undefined,cookie);const contents=await exported.json()
  assert.equal(contents.account.email,email);assert.ok(Array.isArray(contents.bin));assert.ok(!JSON.stringify(contents).includes('password_hash'))
  assert.equal((await f.request('delete-account',{password:'wrong'},cookie)).status,401)
  assert.equal((await f.request('delete-account',{password},cookie,'https://foreign.example')).status,403)
  assert.equal((await f.request('delete-account',{password},cookie)).status,200)
  assert.equal((await f.request('me',undefined,cookie)).status,401)
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM users').get().n,0)
})
