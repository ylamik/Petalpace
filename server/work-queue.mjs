import { availableParallelism, totalmem } from 'node:os'

const SCRYPT_BYTES = 128 * 1024 * 1024
// Node runs scrypt on its 4-thread pool, so more slots than that would only wait there.
const THREAD_POOL = 4

// Parallel hashes that fit in a quarter of this machine's memory and its CPUs.
export function hashConcurrency(env = process.env, cpus = availableParallelism(), memory = process.constrainedMemory() || totalmem()) {
  const configured = Number(env.HASH_CONCURRENCY)
  if (Number.isInteger(configured) && configured >= 1 && configured <= 16) return configured
  return Math.max(1, Math.min(THREAD_POOL, cpus, Math.floor(memory / 4 / SCRYPT_BYTES)))
}

// Runs jobs first come, first served. A job waits for a free slot, and is refused
// only when too many are already waiting or its wait runs out.
export function createWorkQueue({ concurrency, maxWaiting = 20, waitMs = 8000 }) {
  let running = 0
  const waiting = []
  const busy = () => Object.assign(new Error('Please wait a moment and try again.'), { status: 429 })
  const start = job => {
    running++
    Promise.resolve().then(job.work).then(job.resolve, job.reject).finally(() => {
      running--
      const next = waiting.shift()
      if (next) { clearTimeout(next.timer); start(next) }
    })
  }
  return work => new Promise((resolve, reject) => {
    const job = { work, resolve, reject }
    if (running < concurrency) return start(job)
    if (waiting.length >= maxWaiting) return reject(busy())
    job.timer = setTimeout(() => { waiting.splice(waiting.indexOf(job), 1); reject(busy()) }, waitMs)
    waiting.push(job)
  })
}
