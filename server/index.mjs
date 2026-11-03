import { closeStreams } from './sse-broker.mjs'
import { createReminderWorker } from './reminders.mjs'
import { validateProductionConfig } from './production-config.mjs'
import { cleanupExpired } from './maintenance.mjs'
import { createFeedbackServer } from './feedback.mjs'
import { mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, dirname, resolve } from 'node:path'
import { createAuthStore } from './auth-store.mjs'
import { createAuthHandler } from './auth.mjs'

validateProductionConfig(process.env)
const __dirname = dirname(fileURLToPath(import.meta.url))
if (process.env.NODE_ENV === 'production' && !process.env.DATA_DIR) throw new Error('Set DATA_DIR to a persistent storage directory before starting production.')
const dataDirectory = resolve(process.env.DATA_DIR || join(__dirname, 'data'))
mkdirSync(dataDirectory, { recursive: true })
const db = createAuthStore(join(dataDirectory, 'accounts.sqlite'))
const auth = createAuthHandler({ db })

// In production, serve the built SPA from dist/.  In development, Vite handles this.
const distDir = join(__dirname, '..', 'dist')
const staticDir = existsSync(join(distDir, 'index.html')) ? distDir : undefined

if (process.env.NODE_ENV === 'production' && !staticDir) throw new Error('Build the frontend before starting production.')
const port = Number(process.env.PORT || process.env.FEEDBACK_PORT || 3001)
const host = process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1')
const server = createFeedbackServer({ auth, staticDir, checkHealth: () => db.prepare('SELECT 1 AS ok').get().ok === 1 })
cleanupExpired(db)
const sendReminders=createReminderWorker({db})
const reminderTimer=setInterval(()=>{void sendReminders().catch(()=>console.error('Reminder scan failed.'))},60000)
reminderTimer.unref()
const cleanupTimer = setInterval(() => { try { cleanupExpired(db) } catch { console.error('Scheduled cleanup failed; check database health.') } }, 3600000)
cleanupTimer.unref()

server.on('error', error => {
  console.error(error.code === 'EADDRINUSE'
    ? `Port ${port} is already in use. Stop the older Petalpace server before running again.`
    : 'The Petalpace API could not start.')
  db.close()
  process.exitCode = 1
})

server.listen(port, host, () => {
  const mode = process.env.NODE_ENV === 'production' ? 'production' : 'development'
  console.log(`Petalpace API ready on ${host}:${port} (${mode})${staticDir ? ' with SPA fallback' : ''}`)
})

// Graceful shutdown: close connections before exiting so saves are not truncated.
let stopping = false
function shutdown(signal) {
  if (stopping) return
  stopping = true
  console.log(`${signal} received, finishing active requests...`)
  clearInterval(cleanupTimer)
  clearInterval(reminderTimer)
  closeStreams()
  server.close(() => { db.close(); process.exit(0) })
  // Stop accepting requests first; let current saves finish before forcing closure.
  setTimeout(() => { server.closeAllConnections(); process.exit(1) }, 35000).unref()
}
process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
