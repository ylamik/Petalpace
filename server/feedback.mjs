import { createServer } from 'node:http'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join, extname, normalize, sep } from 'node:path'

const emailPattern = /^[^\s@\r\n]+@[^\s@\r\n]+\.[^\s@\r\n]+$/

import { clientIP } from './client-ip.mjs'
export { clientIP } from './client-ip.mjs'

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json',
  '.wasm': 'application/wasm',
}

// Serves built SPA assets with path-traversal protection and SPA fallback.
async function serveStatic(req, res, staticDir) {
  const url = new URL(req.url, 'http://localhost')
  let pathname
  try { pathname = decodeURIComponent(url.pathname) } catch { res.writeHead(400); res.end('Invalid URL'); return true }
  if (pathname.includes('\\') || pathname.includes('\0')) { res.writeHead(400); res.end('Invalid URL'); return true }
  // Reject path traversal attempts
  if (pathname.includes('..')) return false
  const filePath = normalize(join(staticDir, pathname))
  if (!filePath.startsWith(staticDir + sep)) return false
  const ext = extname(filePath).toLowerCase()
  // Try the exact file first if it has a known extension
  if (ext && mimeTypes[ext]) {
    try {
      const data = await readFile(filePath)
      res.writeHead(200, {
        'Content-Type': mimeTypes[ext],
        'Cache-Control': /^\/assets\/[^/]+-[A-Za-z0-9_-]{8,}\.[a-z0-9]+$/i.test(pathname) ? 'public, max-age=31536000, immutable' : 'no-cache',
        'X-Content-Type-Options': 'nosniff',
      })
      res.end(data)
      return true
    } catch { return false }
  } else if (ext) {
    return false
  }
  // SPA fallback: serve index.html for client-side routes
  try {
    const data = await readFile(join(staticDir, 'index.html'))
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    })
    res.end(data)
    return true
  } catch {
    return false
  }
}

export function createFeedbackServer({ env = process.env, send = fetch, auth, staticDir, checkHealth = () => true } = {}) {
  const attempts = new Map()
  const trustedProxy = env.TRUSTED_PROXY || ''
  const spaDir = staticDir || null
  const hasSpa = spaDir && existsSync(join(spaDir, 'index.html'))
  return createServer(async (req, res) => {
    // Health check endpoint for monitoring and load balancers
    if (req.url === '/api/health' && req.method === 'GET') {
      let healthy = false
      try { healthy = checkHealth() === true } catch { /* Do not expose database details. */ }
      res.writeHead(healthy ? 200 : 503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
      return res.end(JSON.stringify({ status: healthy ? 'ok' : 'unavailable', time: Date.now() }))
    }
    if (auth && (req.url?.startsWith('/api/auth/') || req.url?.startsWith('/api/collab/'))) {
      try { return await auth(req, res) } catch { if (!res.headersSent) res.writeHead(500, {'Content-Type':'application/json'}); return res.end(JSON.stringify({error:'Could not complete this request. Please try again.'})) }
    }
    const reply = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
      res.end(JSON.stringify(data))
    }
    if (req.url === '/api/feedback') {
      if (req.method !== 'POST') return reply(405, { error: 'Use POST.' })
      const allowed = (env.APP_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173').split(',').map((value) => value.trim())
      if (!allowed.includes(req.headers.origin)) return reply(403, { error: 'This website is not allowed to submit feedback.' })
      if (!req.headers['content-type']?.startsWith('application/json')) return reply(415, { error: 'Use JSON.' })
      const now = Date.now()
      for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key)
      const ip = clientIP(req, trustedProxy)
      const window = attempts.get(ip) ?? { count: 0, until: now + 600000 }
      if (window.count >= 5 || attempts.size >= 10000) return reply(429, { error: 'Too many submissions. Please try again in 10 minutes.' })
      window.count++; attempts.set(ip, window)
      try {
        let body = ''
        for await (const chunk of req) {
          body += chunk
          if (Buffer.byteLength(body) > 24000) { reply(413, { error: 'Your message is too large.' }); return }
        }
        let data
        try { data = JSON.parse(body) } catch { return reply(400, { error: 'Invalid request.' }) }
        if (!data || typeof data !== 'object' || Array.isArray(data)) return reply(400, { error: 'Invalid request.' })
        if (data.website) return reply(400, { error: 'Unable to submit this form.' })
        const { feedbackType, message, email = '' } = data
        if (!['Suggestion', 'Report a bug', 'Something else'].includes(feedbackType) || typeof message !== 'string' || !message.trim() || message.length > 5000 || typeof email !== 'string' || email.length > 254 || (email.trim() && !emailPattern.test(email.trim()))) {
          return reply(400, { error: 'Choose a feedback type, write up to 5,000 characters, and check your email if provided.' })
        }
        if (!env.RESEND_API_KEY || !env.FEEDBACK_FROM || !emailPattern.test(env.FEEDBACK_TO || '')) return reply(503, { error: 'Feedback delivery is not ready yet. Please use the contact email below.' })
        const result = await send('https://api.resend.com/emails', {
          method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: env.FEEDBACK_FROM, to: [env.FEEDBACK_TO], subject: `Petalpace feedback: ${feedbackType}`, text: `Type: ${feedbackType}\nReply email: ${email.trim() || 'Not provided'}\n\n${message.trim()}`, ...(email.trim() ? { reply_to: email.trim() } : {}) }),
          signal: AbortSignal.timeout(12000),
        })
        const accepted = await result.json().catch(() => null)
        if (!result.ok || !accepted?.id) return reply(502, { error: 'Feedback could not be sent. Please try again later.' })
        reply(200, { ok: true })
      } catch { reply(502, { error: 'Feedback could not be sent. Please try again later.' }) }
      return
    }
    // SPA fallback for non-API GET requests in production
    if (hasSpa && req.method === 'GET' && !req.url?.startsWith('/api/')) {
      try { if (await serveStatic(req, res, spaDir)) return }
      catch { return reply(500, { error: 'Could not load this page. Please try again.' }) }
    }
    return reply(404, { error: 'Not found.' })
  })
}
