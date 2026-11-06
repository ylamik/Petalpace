// Shared look for every Petalpace email. Table layout and inline styles,
// because many email apps ignore stylesheets and modern CSS.

export const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

const sans = "-apple-system,'Segoe UI',Helvetica,Arial,sans-serif"
const serif = "Georgia,'Times New Roman',serif"

// The logo only loads from a public HTTPS site, so local test emails show the name alone.
export function logoUrl(env) {
  try {
    const app = new URL(env.APP_URL || '')
    return app.protocol === 'https:' ? new URL('/images/petalpace-mark.png', app).href : ''
  } catch { return '' }
}

export const badges = {
  soon: { text: 'Coming up', background: '#e7eef7', color: '#2f3c74' },
  day: { text: 'Due within 24 hours', background: '#fcefd9', color: '#7a4304' },
  missed: { text: 'Overdue', background: '#fbe3de', color: '#9b2a24' },
}

// `body` is trusted HTML built by the caller. Escape anything user-written before passing it in.
export function emailLayout(title, body, link, label = 'Open Petalpace', { preheader = '', badge = null, footer = '', logo = '' } = {}) {
  const safeLink = escapeHtml(link)
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#f6f2ea">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader || title)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f2ea"><tr><td align="center" style="padding:32px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td style="padding:0 6px 16px;font-family:${serif};font-size:21px;font-weight:bold;color:#2f3c74">${logo ? `<img src="${escapeHtml(logo)}" width="26" height="26" alt="" style="vertical-align:middle;border:0;margin-right:8px">` : ''}<span style="vertical-align:middle">Petalpace</span></td></tr>
<tr><td style="background:#ffffff;border:1px solid #e8e1d4;border-radius:16px;padding:32px 28px;font-family:${sans};font-size:16px;line-height:1.55;color:#2f3c74">
${badge ? `<span style="display:inline-block;padding:4px 12px;border-radius:999px;background:${badge.background};color:${badge.color};font-size:13px;font-weight:600">${escapeHtml(badge.text)}</span>` : ''}
<h1 style="margin:${badge ? '14px' : '0'} 0 12px;font-family:${serif};font-size:26px;line-height:1.25;color:#2f3c74">${escapeHtml(title)}</h1>
${body}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0 0"><tr><td style="border-radius:10px;background:#4c74a1"><a href="${safeLink}" style="display:inline-block;padding:13px 22px;font-family:${sans};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none">${escapeHtml(label)}</a></td></tr></table>
<p style="margin:18px 0 0;font-size:13px;color:#7a7a7a">Button not working? Open this link:<br><a href="${safeLink}" style="color:#4c74a1;word-break:break-all">${safeLink}</a></p>
</td></tr>
<tr><td style="padding:20px 6px 0;font-family:${sans};font-size:13px;line-height:1.5;color:#7a7a7a">${footer ? `${footer}<br><br>` : ''}Small steps. Room to bloom.</td></tr>
</table></td></tr></table></body></html>`
}

// A soft panel for the task an email is about: title plus label/value rows.
export function taskPanel(title, rows, accent = '#ccdbef') {
  const details = rows.map(([labelText, value]) => `<tr><td style="padding:3px 14px 0 0;font-size:14px;color:#7a7a7a;white-space:nowrap;vertical-align:top">${escapeHtml(labelText)}</td><td style="padding:3px 0 0;font-size:14px;color:#2f3c74">${escapeHtml(value)}</td></tr>`).join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 0;background:#faf7ef;border-radius:12px;border-left:4px solid ${escapeHtml(accent)}"><tr><td style="padding:16px 18px">
<p style="margin:0 0 6px;font-family:${serif};font-size:19px;font-weight:bold;color:#2f3c74">${escapeHtml(title)}</p>
<table role="presentation" cellpadding="0" cellspacing="0">${details}</table></td></tr></table>`
}
