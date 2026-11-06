import test from 'node:test'
import assert from 'node:assert/strict'
import { createWorkQueue, hashConcurrency } from './work-queue.mjs'

const gate = () => { let open; const opened = new Promise(resolve => { open = resolve }); return { open, opened } }
const GB = 1024 ** 3

test('jobs wait for a free slot and run in arrival order', async () => {
  const queue = createWorkQueue({ concurrency: 1 }), first = gate(), order = []
  const jobs = [queue(async () => { await first.opened; order.push(1) }), queue(async () => order.push(2)), queue(async () => order.push(3))]
  await Promise.resolve()
  assert.deepEqual(order, [])
  first.open()
  await Promise.all(jobs)
  assert.deepEqual(order, [1, 2, 3])
})

test('never runs more jobs than its concurrency', async () => {
  const queue = createWorkQueue({ concurrency: 2 });let running = 0, peak = 0
  await Promise.all(Array.from({ length: 8 }, () => queue(async () => { peak = Math.max(peak, ++running); await new Promise(resolve => setTimeout(resolve, 5)); running-- })))
  assert.equal(peak, 2)
})

test('a full queue or an expired wait is refused with 429, and work continues', async () => {
  const queue = createWorkQueue({ concurrency: 1, maxWaiting: 1, waitMs: 20 }), slot = gate()
  const running = queue(() => slot.opened), expires = queue(() => 'never')
  await assert.rejects(queue(() => 'never'), { status: 429, message: 'Please wait a moment and try again.' })
  await assert.rejects(expires, { status: 429 })
  slot.open();await running
  assert.equal(await queue(() => 'ok'), 'ok')
})

test('a failed job frees its slot for the next one', async () => {
  const queue = createWorkQueue({ concurrency: 1 })
  const failed = queue(async () => { throw new Error('boom') }), next = queue(() => 'ok')
  await assert.rejects(failed, /boom/)
  assert.equal(await next, 'ok')
})

test('hash concurrency fits the machine and can be set by env', () => {
  assert.equal(hashConcurrency({}, 1, GB), 1)
  assert.equal(hashConcurrency({}, 2, GB), 2)
  assert.equal(hashConcurrency({}, 8, 512 * 1024 * 1024), 1)
  assert.equal(hashConcurrency({}, 16, 32 * GB), 4)
  assert.equal(hashConcurrency({ HASH_CONCURRENCY: '3' }, 1, GB), 3)
  assert.equal(hashConcurrency({ HASH_CONCURRENCY: 'many' }, 2, GB), 2)
  assert.equal(hashConcurrency({ HASH_CONCURRENCY: '0' }, 2, GB), 2)
})
