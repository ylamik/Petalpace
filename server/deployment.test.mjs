import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createFeedbackServer } from './feedback.mjs'
import { clientIP } from './client-ip.mjs'
import { createAuthStore } from './auth-store.mjs'
import { copyDatabase } from './database-backup.mjs'
import { cleanupExpired } from './maintenance.mjs'
import { createPlannerHandler } from './planner.mjs'

test('SPA routes, malformed URLs, missing assets and cache policy', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'petalpace-static-'))
  writeFileSync(join(dir, 'index.html'), '<html>Petalpace test</html>')
  writeFileSync(join(dir, 'theme-init.js'), '// fixed name')
  mkdirSync(join(dir, 'assets')); writeFileSync(join(dir, 'assets', 'index-Abc12345.js'), '// versioned')
  const server = createFeedbackServer({ env: {}, staticDir: dir })
  await new Promise(r => server.listen(0, '127.0.0.1', r))
  t.after(async () => { server.closeAllConnections(); await new Promise(r => server.close(r)); rmSync(dir, { recursive: true, force: true }) })
  const get = path => fetch(`http://127.0.0.1:${server.address().port}${path}`)
  for (const path of ['/', '/today', '/calendar']) { const r = await get(path); assert.equal(r.status, 200); assert.match(await r.text(), /Petalpace/) }
  assert.equal((await get('/%ZZ')).status, 400)
  assert.equal((await get('/missing.js')).status, 404)
  assert.equal((await get('/theme-init.js')).headers.get('cache-control'), 'no-cache')
  assert.match((await get('/assets/index-Abc12345.js')).headers.get('cache-control'), /immutable/)
  assert.equal((await get('/api/health')).status, 200)
})
test('proxy chain stops at nearest untrusted address and ignores spoofed headers', () => {
  const req = (peer, header) => ({ socket: { remoteAddress: peer }, headers: { 'x-forwarded-for': header } })
  assert.equal(clientIP(req('203.0.113.2', '1.1.1.1'), '127.0.0.1'), '203.0.113.2')
  assert.equal(clientIP(req('127.0.0.1', '1.1.1.1, 198.51.100.3'), '127.0.0.1'), '198.51.100.3')
  assert.equal(clientIP(req('::ffff:127.0.0.1', '198.51.100.3, 10.0.0.1'), '127.0.0.1,10.0.0.1'), '198.51.100.3')
  assert.equal(clientIP(req('127.0.0.1', 'invented, 198.51.100.3'), '127.0.0.1'), '127.0.0.1')
  assert.equal(clientIP(req('127.0.0.1', '1.1.1.1'), '*'), '127.0.0.1')
})
test('consistent backup restores committed WAL data and refuses overwrites', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'petalpace-backup-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const source = join(dir, 'live.sqlite'), copy = join(dir, 'backup.sqlite'), restored = join(dir, 'restored.sqlite')
  const db = createAuthStore(source)
  db.prepare('INSERT INTO users(id,email,name,password_hash,verified) VALUES(?,?,?,?,1)').run('u','test@example.com','Test','not-a-real-password')
  await copyDatabase(source, copy)
  await assert.rejects(copyDatabase(source, copy))
  db.close()
  await copyDatabase(copy, restored)
  const check = createAuthStore(restored)
  assert.equal(check.prepare('SELECT name FROM users WHERE id=?').get('u').name, 'Test')
  check.close()
})
test('scheduled cleanup expires Bin content without a planner request', () => {
  const db = createAuthStore()
  createPlannerHandler({ db, findSession: () => null, origins: [], limit: () => {} })
  db.prepare('INSERT INTO users(id,email,name,password_hash,verified) VALUES(?,?,?,?,1)').run('u','test@example.com','Test','unused')
  db.prepare('INSERT INTO task_trash VALUES(?,?,?,?)').run('u','old',1,'{}')
  cleanupExpired(db, 31 * 86400000)
  assert.equal(db.prepare('SELECT data FROM task_trash').get().data, null)
  db.close()
})


test('production settings fail closed without durable storage and trusted origins', async () => {
  const {validateProductionConfig}=await import('./production-config.mjs')
  const env={NODE_ENV:'production',APP_URL:'https://petalpace.example',APP_ORIGINS:'https://petalpace.example',DATA_DIR:join(tmpdir(),'petalpace-data'),RESEND_API_KEY:'test-only',FEEDBACK_FROM:'test@example.com',FEEDBACK_TO:'owner@example.com'}
  assert.doesNotThrow(()=>validateProductionConfig(env))
  for (const changes of [{DATA_DIR:''},{DATA_DIR:'relative'},{APP_URL:'http://petalpace.example'},{APP_ORIGINS:'https://other.example'},{TRUSTED_PROXY:'*'},{RESEND_API_KEY:''}]) assert.throws(()=>validateProductionConfig({...env,...changes}))
})
