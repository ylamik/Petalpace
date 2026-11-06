import test from 'node:test'
import assert from 'node:assert/strict'
import net from 'node:net'

import { buildMessage, emailReady, mailSender, sendSmtp } from './mailer.mjs'
import { createAuthStore } from './auth-store.mjs'
import { createAuthHandler } from './auth.mjs'
import { createFeedbackServer } from './feedback.mjs'
import { validateProductionConfig } from './production-config.mjs'

// A tiny SMTP server that records what it receives. `rejectAuth` makes login fail.
async function fakeSmtp(t, { rejectAuth = false } = {}) {
  const mails = [], commands = []
  const server = net.createServer(socket => {
    let buffer = '', inData = false, data = ''
    socket.write('220 fake ready\r\n')
    socket.on('data', chunk => {
      buffer += chunk
      let at
      while ((at = buffer.indexOf('\r\n')) >= 0) {
        const line = buffer.slice(0, at); buffer = buffer.slice(at + 2)
        if (inData) {
          if (line === '.') { inData = false; mails.push(data); data = ''; socket.write('250 2.0.0 OK queued-123\r\n') } else data += line + '\r\n'
          continue
        }
        commands.push(line)
        if (line.startsWith('EHLO')) socket.write('250-fake\r\n250-AUTH PLAIN\r\n250 SIZE 1000000\r\n')
        else if (line.startsWith('AUTH')) socket.write(rejectAuth ? '535 5.7.8 Bad credentials\r\n' : '235 2.7.0 Accepted\r\n')
        else if (line === 'DATA') { inData = true; socket.write('354 Go ahead\r\n') }
        else if (line === 'QUIT') { socket.write('221 Bye\r\n'); socket.end() }
        else socket.write('250 OK\r\n')
      }
    })
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise(resolve => server.close(resolve)))
  const env = { SMTP_HOST: '127.0.0.1', SMTP_PORT: String(server.address().port), SMTP_SECURE: 'false', SMTP_USER: 'me@gmail.com', SMTP_PASS: 'abcd efgh ijkl mnop' }
  return { mails, commands, env }
}
const body = mail => mail.split('\r\n\r\n').slice(1).join('\r\n\r\n')
const decodedParts = mail => [...body(mail).matchAll(/base64\r\n\r\n([A-Za-z0-9+/=\r\n]+?)\r\n--/g)].map(m => Buffer.from(m[1].replace(/\r\n/g, ''), 'base64').toString())

test('sends a multipart message over SMTP with app-password login', async t => {
  const smtp = await fakeSmtp(t)
  const id = await sendSmtp(smtp.env, { from: 'Petalpace <me@gmail.com>', to: ['friend@example.com'], subject: 'Reset · your password', text: 'Plain .line\nTwo', html: '<p>Hi</p>', reply_to: 'someone@example.com' })
  assert.equal(id, '2.0.0 OK queued-123')
  assert.ok(smtp.commands.includes(`AUTH PLAIN ${Buffer.from('\0me@gmail.com\0abcdefghijklmnop').toString('base64')}`))
  assert.ok(smtp.commands.includes('MAIL FROM:<me@gmail.com>'));assert.ok(smtp.commands.includes('RCPT TO:<friend@example.com>'))
  const [mail] = smtp.mails
  assert.match(mail, /^From: Petalpace <me@gmail.com>\r\n/m);assert.match(mail, /^Reply-To: someone@example.com\r\n/m)
  assert.match(mail, new RegExp(`^Subject: =\\?UTF-8\\?B\\?${Buffer.from('Reset · your password').toString('base64').replace(/[+/=]/g, c => '\\' + c)}\\?=`, 'm'))
  assert.deepEqual(decodedParts(mail), ['Plain .line\nTwo', '<p>Hi</p>'])
})

test('header injection is flattened and failures surface as errors', async t => {
  const message = buildMessage({ from: 'me@gmail.com', to: ['a@example.com'], subject: 'Hi\r\nBcc: evil@example.com', text: 'x' })
  assert.doesNotMatch(message, /^Bcc:/m)
  const smtp = await fakeSmtp(t, { rejectAuth: true })
  await assert.rejects(sendSmtp(smtp.env, { from: 'me@gmail.com', to: ['a@example.com'], subject: 'x', text: 'x' }), /535 to AUTH/)
  const response = await mailSender(smtp.env)('', { body: JSON.stringify({ from: 'me@gmail.com', to: ['a@example.com'], subject: 'x', text: 'x' }) })
  assert.equal(response.ok, false)
})

test('Gmail settings make email ready, in production config too', () => {
  assert.equal(emailReady({}), false);assert.equal(emailReady({ SMTP_USER: 'me@gmail.com' }), false)
  assert.equal(emailReady({ SMTP_USER: 'me@gmail.com', SMTP_PASS: 'x' }), true);assert.equal(emailReady({ RESEND_API_KEY: 'k' }), true)
  const env = { NODE_ENV: 'production', APP_URL: 'https://petalpace.duckdns.org', APP_ORIGINS: 'https://petalpace.duckdns.org', DATA_DIR: '/var/lib/petalpace', FEEDBACK_FROM: 'me@gmail.com', FEEDBACK_TO: 'me@gmail.com' }
  assert.throws(() => validateProductionConfig(env), /RESEND_API_KEY or SMTP_USER and SMTP_PASS/)
  assert.doesNotThrow(() => validateProductionConfig({ ...env, SMTP_USER: 'me@gmail.com', SMTP_PASS: 'app password' }))
})

test('a password reset reaches the inbox through Gmail settings, with no Resend key', async t => {
  const smtp = await fakeSmtp(t)
  const db = createAuthStore()
  db.prepare('INSERT INTO users (id, email, name, password_hash, verified) VALUES (?,?,?,?,1)').run('u', 'friend@example.com', 'Friend', 'x')
  const env = { ...smtp.env, APP_URL: 'http://localhost:5173', FEEDBACK_FROM: 'Petalpace <me@gmail.com>' }
  const server = createFeedbackServer({ auth: createAuthHandler({ db, env }), env })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); db.close() })
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/forgot-password`, { method: 'POST', headers: { Origin: 'http://localhost:5173', 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'friend@example.com' }) })
  assert.equal(response.status, 200)
  for (let i = 0; i < 50 && !smtp.mails.length; i++) await new Promise(resolve => setTimeout(resolve, 20))
  assert.equal(smtp.mails.length, 1)
  assert.match(decodedParts(smtp.mails[0])[0], /reset-password#token=[a-f0-9]{64}/)
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM auth_tokens').get().n, 1)

})
