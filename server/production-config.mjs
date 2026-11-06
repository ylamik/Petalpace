import { isAbsolute } from 'node:path'
import { isIP } from 'node:net'
export function validateProductionConfig(env) {
  if (env.NODE_ENV !== 'production') return
  const missing = ['APP_URL','APP_ORIGINS','DATA_DIR','FEEDBACK_FROM','FEEDBACK_TO'].filter(key => !env[key]?.trim())
  if (!env.RESEND_API_KEY?.trim() && !(env.SMTP_USER?.trim() && env.SMTP_PASS?.trim())) missing.push('RESEND_API_KEY or SMTP_USER and SMTP_PASS')
  if (missing.length) throw new Error(`Missing production settings: ${missing.join(', ')}`)
  if (!isAbsolute(env.DATA_DIR)) throw new Error('DATA_DIR must be an absolute persistent-volume path.')
  const app = new URL(env.APP_URL)
  const origins = env.APP_ORIGINS.split(',').map(value => value.trim())
  if (app.protocol !== 'https:' || app.username || app.password || app.search || app.hash || app.pathname !== '/') throw new Error('APP_URL must be the HTTPS origin of your website.')
  if (!origins.includes(app.origin) || origins.some(value => { try { const url = new URL(value); return url.protocol !== 'https:' || url.origin !== value } catch { return true } })) throw new Error('APP_ORIGINS must contain your exact HTTPS website origin.')
  if (env.TRUSTED_PROXY && env.TRUSTED_PROXY.split(',').some(value => !isIP(value.trim().replace(/^::ffff:/,'')))) throw new Error('TRUSTED_PROXY must list exact proxy IP addresses; wildcards are not allowed.')
}
