import net from 'node:net'
import tls from 'node:tls'
import { randomBytes } from 'node:crypto'

// Email goes through Gmail (or any SMTP server) when SMTP_USER and SMTP_PASS are set,
// otherwise through Resend. Both paths take the same Resend-style message.
export const smtpConfigured = env => !!(env.SMTP_USER?.trim() && env.SMTP_PASS?.trim())
export const emailReady = env => !!env.RESEND_API_KEY?.trim() || smtpConfigured(env)

// A fetch-shaped sender, so callers can stay written against Resend's API.
export function mailSender(env = process.env) {
  if (!smtpConfigured(env)) return fetch
  return async (_url, options) => {
    try {
      const id = await sendSmtp(env, JSON.parse(options.body))
      return Response.json({ id })
    } catch (error) {
      console.error(`SMTP delivery failed: ${error.message}`)
      return Response.json({ error: 'Email could not be sent.' }, { status: 502 })
    }
  }
}

const address = value => (/<([^<>]+)>/.exec(value)?.[1] ?? value).trim()
const clean = value => String(value).replace(/[\r\n]+/g, ' ').trim()
const encodeHeader = value => /^[\x20-\x7e]*$/.test(value) ? value : `=?UTF-8?B?${Buffer.from(value).toString('base64')}?=`
// Quoted-printable keeps the text readable in the raw message. Spam filters score base64
// text parts higher, since spammers use base64 to hide words from them.
export function quotedPrintable(text) {
  const out = []
  for (const hardLine of String(text).split(/\r?\n/)) {
    const bytes = Buffer.from(hardLine)
    let line = ''
    bytes.forEach((byte, index) => {
      const last = index === bytes.length - 1
      let token = (byte >= 33 && byte <= 126 && byte !== 61) || ((byte === 32 || byte === 9) && !last)
        ? String.fromCharCode(byte) : `=${byte.toString(16).toUpperCase().padStart(2, '0')}`
      if (line.length + token.length > 75) { out.push(line + '='); line = '' }
      // A leading dot would end the SMTP DATA block, and a leading "From " gets mangled by some servers.
      if (!line && (token === '.' || (token === 'F' && bytes.subarray(index, index + 5).toString() === 'From '))) token = `=${byte.toString(16).toUpperCase()}`
      line += token
    })
    out.push(line)
  }
  return out.join('\r\n')
}

export function buildMessage(message, now = new Date()) {
  const from = clean(message.from), to = message.to.map(clean)
  const boundary = `petalpace-${randomBytes(12).toString('hex')}`
  const domain = address(from).split('@')[1] || 'localhost'
  const headers = [
    `From: ${from}`,
    `To: ${to.join(', ')}`,
    ...(message.reply_to ? [`Reply-To: ${clean(message.reply_to)}`] : []),
    `Subject: ${encodeHeader(clean(message.subject))}`,
    `Date: ${now.toUTCString()}`,
    `Message-ID: <${randomBytes(16).toString('hex')}@${domain}>`,
    'MIME-Version: 1.0',
  ]
  const part = (type, body) => [`--${boundary}`, `Content-Type: ${type}; charset=utf-8`, 'Content-Transfer-Encoding: quoted-printable', '', quotedPrintable(body)].join('\r\n')
  const parts = [part('text/plain', message.text || ''), ...(message.html ? [part('text/html', message.html)] : [])]
  return [...headers, `Content-Type: multipart/alternative; boundary="${boundary}"`, '', ...parts, `--${boundary}--`, ''].join('\r\n')
}

function openSocket({ host, port, secure, timeout }) {
  return new Promise((resolve, reject) => {
    const socket = secure ? tls.connect({ host, port, servername: host }) : net.connect({ host, port })
    socket.setTimeout(timeout, () => socket.destroy(new Error('SMTP server timed out.')))
    socket.once(secure ? 'secureConnect' : 'connect', () => resolve(socket))
    socket.once('error', reject)
  })
}

// Reads one complete reply, including multi-line ones such as the EHLO list.
function replies(socket) {
  let buffer = '', failure = null
  const lines = [], waiting = []
  const settle = () => {
    while (waiting.length) {
      const end = lines.findIndex(line => line[3] !== '-')
      if (end >= 0) { const reply = lines.splice(0, end + 1); waiting.shift().resolve({ code: Number(reply[0].slice(0, 3)), text: reply.join('\n') }) }
      else if (failure) waiting.shift().reject(failure)
      else return
    }
  }
  socket.on('data', chunk => {
    buffer += chunk
    let at
    while ((at = buffer.indexOf('\r\n')) >= 0) { lines.push(buffer.slice(0, at)); buffer = buffer.slice(at + 2) }
    settle()
  })
  socket.on('error', error => { failure = error; settle() })
  socket.on('close', () => { failure ??= new Error('SMTP connection closed.'); settle() })
  return () => new Promise((resolve, reject) => { waiting.push({ resolve, reject }); settle() })
}

export async function sendSmtp(env, message) {
  const host = env.SMTP_HOST || 'smtp.gmail.com'
  const port = Number(env.SMTP_PORT || 465)
  const user = env.SMTP_USER.trim(), pass = env.SMTP_PASS.replace(/\s+/g, '')
  const socket = await openSocket({ host, port, secure: env.SMTP_SECURE !== 'false', timeout: 15000 })
  const next = replies(socket)
  const expect = async (command, codes) => {
    if (command !== null) socket.write(command + '\r\n')
    const reply = await next()
    if (!codes.includes(reply.code)) throw new Error(`SMTP server answered ${reply.code} to ${command === null ? 'the greeting' : command.split(' ')[0]}`)
    return reply
  }
  try {
    await expect(null, [220])
    await expect(`EHLO ${address(message.from).split('@')[1] || 'localhost'}`, [250])
    await expect(`AUTH PLAIN ${Buffer.from(`\0${user}\0${pass}`).toString('base64')}`, [235])
    await expect(`MAIL FROM:<${address(message.from)}>`, [250])
    for (const recipient of message.to) await expect(`RCPT TO:<${address(clean(recipient))}>`, [250, 251])
    await expect('DATA', [354])
    const accepted = await expect(`${buildMessage(message)}\r\n.`, [250])
    socket.write('QUIT\r\n')
    return accepted.text.slice(4).trim() || randomBytes(8).toString('hex')
  } finally {
    socket.end()
  }
}
