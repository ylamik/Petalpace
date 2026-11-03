import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import sharp from 'sharp'
import { prepareProfilePhoto, MAX_PHOTO_BYTES } from './profile-photo.mjs'
import { createAuthStore } from './auth-store.mjs'
import { createAuthHandler } from './auth.mjs'
import { createFeedbackServer } from './feedback.mjs'

const photo = () => sharp({ create: { width: 80, height: 40, channels: 3, background: '#ffaabb' } }).png().toBuffer()
test('photos are resized and re-encoded without metadata', async () => {
  const output = await prepareProfilePhoto((await photo()).toString('base64'))
  const info = await sharp(output).metadata()
  assert.equal(info.format, 'webp')
  assert.equal(info.width, 512)
  assert.equal(info.height, 512)
  assert.equal(info.exif, undefined)
  assert.equal(info.icc, undefined)
})
test('invalid, SVG, GIF, oversized and corrupt files are rejected', async () => {
  const big = await sharp({ create: { width: 4097, height: 1, channels: 3, background: '#ffffff' } }).png().toBuffer()
  const gif = await sharp(await photo()).gif().toBuffer()
  const invalid = ['', 'not-base64!!', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"></svg>').toString('base64'), Buffer.from('fake.jpg').toString('base64'), Buffer.alloc(MAX_PHOTO_BYTES + 1).toString('base64'), big.toString('base64'), gif.toString('base64'), (await photo()).subarray(0, 30).toString('base64')]
  for (const input of invalid) await assert.rejects(prepareProfilePhoto(input))
})
test('photo API enforces sessions, origins and ownership; removal restores initials', async t => {
  const db = createAuthStore()
  const tokens = ['a'.repeat(64), 'b'.repeat(64)]
  for (const [i, token] of tokens.entries()) {
    db.prepare('INSERT INTO users (id, email, name, password_hash, verified) VALUES (?, ?, ?, ?, 1)').run(String(i), `user${i}@example.com`, i ? 'Mikyla Caras' : 'Mikyla', 'test-only')
    db.prepare('INSERT INTO sessions (hash, user_id, expires) VALUES (?, ?, ?)').run(createHash('sha256').update(token).digest('hex'), String(i), Date.now() + 60000)
  }
  const server = createFeedbackServer({ env: {}, auth: createAuthHandler({ db, env: {}, send: () => { throw new Error('No real email expected') } }) })
  await new Promise((resolve, reject) => { server.on('error', reject); server.listen(0, '127.0.0.1', resolve) })
  t.after(async () => { await new Promise(resolve => { server.close(resolve); server.closeAllConnections() }); db.close() })
  const request = (action, data, user = 0, origin = 'http://localhost:5173') => fetch(`http://127.0.0.1:${server.address().port}/api/auth/${action}`, {
    method: data ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', Origin: origin, Cookie: user === null ? '' : `petalpace_session=${tokens[user]}` }, body: data ? JSON.stringify(data) : undefined,
  })
  const payload = { image: (await photo()).toString('base64'), userId: '1' }
  assert.equal((await request('photo', payload, null)).status, 401)
  assert.equal((await request('photo', payload, 0, 'https://evil.example')).status, 403)
  const uploaded = await request('photo', payload)
  assert.equal(uploaded.status, 200)
  assert.ok((await uploaded.json()).user.photoUrl.startsWith('/api/auth/photo?v='))
  assert.equal((await request('photo')).headers.get('content-type'), 'image/webp')
  assert.equal((await request('photo', undefined, 1)).status, 404)
  assert.equal((await request('photo', undefined, null)).status, 401)
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM profile_photos WHERE user_id = ?').get('0').n, 1)
  assert.ok((await (await request('me')).json()).user.photoUrl)
  assert.equal((await request('photo-remove', {})).status, 200)
  assert.equal((await (await request('me')).json()).user.photoUrl, null)
  assert.equal((await request('photo')).status, 404)
})
