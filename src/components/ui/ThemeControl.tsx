import { useSyncExternalStore } from 'react'
import { readTheme, setTheme, subscribeTheme } from '../../features/theme/theme'
export default function ThemeControl({ compact = false }: { compact?: boolean }) {
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => 'system')
  const resolved = useSyncExternalStore(subscribeTheme, () => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light', () => 'light')
  if (compact) {
    // Cycle: light → dark → system → light so "system" preference is reachable.
    const next: Record<string, 'light' | 'dark' | 'system'> = { light: 'dark', dark: 'system', system: 'light' }
    const cycleLabel = theme === 'dark' ? 'Switch to system theme' : theme === 'system' ? 'Switch to light mode' : 'Switch to dark mode'
    return <button type="button" aria-label={cycleLabel} title={cycleLabel} onClick={() => setTheme(next[theme])} className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-dark-blue hover:bg-lightest-blue/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue">
      {resolved === 'light' ? <img src="/icons/dark-mode.png" alt="" aria-hidden="true" className="h-5 w-5 object-contain" /> : <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg>}
    </button>
  }
  return <div className="my-3 min-w-0 shrink-0"><p className="mb-2 text-xs font-medium text-gray">Appearance</p><div role="group" aria-label="Color theme" className="flex flex-wrap gap-1 rounded-lg border border-dark-blue/20 bg-surface/40 p-1">{(['light','dark','system'] as const).map(value=><button key={value} type="button" aria-pressed={theme===value} onClick={()=>setTheme(value)} className={`flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-1 cursor-pointer rounded-md px-2 text-sm font-medium capitalize focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue ${theme===value?'bg-blue text-white shadow-sm':'text-dark-blue hover:bg-lightest-blue/50'}`}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">{value==='light'?<><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></>:value==='dark'?<path d="M20.5 13A8.7 8.7 0 0 1 11 3.5 8.8 8.8 0 1 0 20.5 13Z"/>:<><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/></>}</svg><span>{value}</span></button>)}</div></div>
}
