import test from 'node:test'
import assert from 'node:assert/strict'
import { allowAttempt, createFeedbackServer } from './feedback.mjs'

async function fixture(t, { configured = true, fails = false } = {}) {
  const sent = []
  const env = configured ? { RESEND_API_KEY: 'test-only', FEEDBACK_FROM: 'test@example.com', FEEDBACK_TO: 'owner@example.com' } : {}
  const server = createFeedbackServer({ env, send: async (_, options) => { sent.push(JSON.parse(options.body)); return Response.json(fails ? { error: 'Rejected' } : { id: 'test-id' }, { status: fails ? 500 : 200 }) } })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections() }))
  const post = (data, origin = 'http://localhost:5173') => fetch(`http://127.0.0.1:${server.address().port}/api/feedback`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(data) })
  return { post, sent }
}
const valid = { feedbackType: 'Suggestion', message: 'Please add a calendar.' }
test('anonymous feedback reaches the fixed recipient without Reply-To', async (t) => {
  const { post, sent } = await fixture(t)
  assert.equal((await post(valid)).status, 200)
  assert.deepEqual(sent[0].to, ['owner@example.com'])
  assert.equal(sent[0].reply_to, undefined)
})
test('optional email becomes Reply-To, never the recipient', async (t) => {
  const { post, sent } = await fixture(t)
  assert.equal((await post({ ...valid, email: 'visitor@example.com', to: 'attacker@example.com' })).status, 200)
  assert.equal(sent[0].reply_to, 'visitor@example.com')
  assert.deepEqual(sent[0].to, ['owner@example.com'])
})
test('invalid input and foreign origins do not send', async (t) => {
  const { post, sent } = await fixture(t)
  assert.equal((await post({ ...valid, message: ' ' })).status, 400)
  assert.equal((await post({ ...valid, email: 'bad' })).status, 400)
  assert.equal((await post({ ...valid, message: 'x'.repeat(5001) })).status, 400)
  assert.equal((await post(valid, 'https://other.example')).status, 403)
  assert.equal(sent.length, 0)
})
test('missing configuration and provider errors never report success', async (t) => {
  const missing = await fixture(t, { configured: false })
  assert.equal((await missing.post(valid)).status, 503)
  const broken = await fixture(t, { fails: true })
  assert.equal((await broken.post(valid)).status, 502)
})
test('rate limit rejects excess submissions', async (t) => {
  const { post, sent } = await fixture(t)
  for (let i = 0; i < 5; i++) assert.equal((await post(valid)).status, 200)
  assert.equal((await post(valid)).status, 429)
  assert.equal(sent.length, 5)
})

test('a full feedback attempt map drops the oldest visitor instead of blocking everyone', () => {
  const attempts = new Map()
  for (let i = 0; i < 3; i++) assert.equal(allowAttempt(attempts, 'ip' + i, 0, 3), true)
  assert.equal(allowAttempt(attempts, 'new visitor', 0, 3), true)
  assert.equal(attempts.size, 3)
  assert.equal(attempts.has('ip0'), false)
  for (let i = 0; i < 4; i++) assert.equal(allowAttempt(attempts, 'new visitor', 0, 3), true)
  assert.equal(allowAttempt(attempts, 'new visitor', 0, 3), false)
})
