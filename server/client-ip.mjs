import { isIP } from 'node:net'
const normalize = value => value.trim().replace(/^::ffff:/, '')
export function clientIP(req, trustedProxy = '') {
  const peer = normalize(req.socket.remoteAddress || '')
  const trusted = new Set(trustedProxy.split(',').map(normalize).filter(value => isIP(value)))
  if (!trusted.has(peer)) return peer || 'unknown'
  const header = req.headers['x-forwarded-for']
  if (typeof header !== 'string' || header.length > 2048) return peer
  const chain = header.split(',').map(normalize)
  if (chain.length > 20 || chain.some(value => !isIP(value))) return peer
  // Walk from the socket toward the visitor, stopping at the first untrusted hop.
  let current = peer
  for (let i = chain.length - 1; i >= 0 && trusted.has(current); i--) current = chain[i]
  return current
}
