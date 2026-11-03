import { useSyncExternalStore } from 'react'
let minute = Math.floor(Date.now() / 60000)
const listeners = new Set<() => void>()
let stop: (() => void) | undefined
function subscribe(listener: () => void) {
  listeners.add(listener)
  const tick = () => { minute = Math.floor(Date.now() / 60000); listeners.forEach(callback => callback()) }
  if (listeners.size === 1) {
    const timer = window.setInterval(tick, 1000)
    const visible = () => { if (document.visibilityState === 'visible') tick() }
    window.addEventListener('focus', tick)
    document.addEventListener('visibilitychange', visible)
    tick()
    stop = () => { clearInterval(timer); window.removeEventListener('focus', tick); document.removeEventListener('visibilitychange', visible) }
  }
  return () => { listeners.delete(listener); if (!listeners.size) { stop?.(); stop = undefined } }
}
export function usePlannerClock() {
  const value = useSyncExternalStore(subscribe, () => minute, () => minute)
  return new Date(value * 60000)
}
