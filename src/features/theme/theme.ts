export type ThemePreference = 'light' | 'dark' | 'system'
const key = 'petalpace-theme'
let memory: ThemePreference | null = null
export function readTheme(): ThemePreference {
  if (memory) return memory
  try { const value = localStorage.getItem(key); return value === 'light' || value === 'dark' ? value : 'system' } catch { return 'system' }
}
// The home and account pages are designed for light mode only.
const lightOnly = new Set(['/', '/sign-in', '/sign-up', '/verify-email', '/forgot-password', '/reset-password'])
export function applyTheme() {
  const preference = readTheme()
  document.documentElement.dataset.theme = lightOnly.has(window.location.pathname) ? 'light' : preference === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : preference
}
export function setTheme(preference: ThemePreference) {
  memory = preference
  try { localStorage.setItem(key, preference) } catch { /* Keep the choice in this tab if storage is unavailable. */ }
  applyTheme()
  window.dispatchEvent(new Event('petalpace-theme-change'))
}
export function subscribeTheme(callback: () => void) {
  const media = matchMedia('(prefers-color-scheme: dark)')
  const update = () => { applyTheme(); callback() }
  const storage = (event: StorageEvent) => { if (!event.key || event.key === key) { memory = null; update() } }
  media.addEventListener('change', update)
  window.addEventListener('storage', storage)
  window.addEventListener('petalpace-theme-change', callback)
  return () => { media.removeEventListener('change', update); window.removeEventListener('storage', storage); window.removeEventListener('petalpace-theme-change', callback) }
}
