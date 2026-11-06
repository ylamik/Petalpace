import { useSyncExternalStore } from 'react'
import { readTheme, setTheme, subscribeTheme, type ThemePreference } from '../../features/theme/theme'

const options = ['light', 'dark', 'system'] as const

export default function ThemeControl({ compact = false }: { compact?: boolean }) {
  const theme = useSyncExternalStore<ThemePreference>(subscribeTheme, readTheme, () => 'system')
  if (compact) {
    // Cycles light → dark → system, and the icon shows the current choice.
    const next = { light: 'dark', dark: 'system', system: 'light' } as const
    const label = `Theme: ${theme}. Switch to ${next[theme]}`
    return <button type="button" aria-label={label} title={label} onClick={() => setTheme(next[theme])} className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-dark-blue/10 bg-surface text-dark-blue hover:bg-nav-active focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue">
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
        {theme === 'light' ? <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></> : theme === 'dark' ? <path d="M20.5 13A8.7 8.7 0 0 1 11 3.5 8.8 8.8 0 1 0 20.5 13Z"/> : <><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8m-4-4v4"/></>}
      </svg>
    </button>
  }
  return <div className="min-w-0">
    <p className="mb-2 text-sm font-medium text-gray">Appearance</p>
    <div role="group" aria-label="Color theme" className="grid grid-cols-3 gap-1 rounded-xl bg-beige p-1">
      {options.map(value => <button key={value} type="button" aria-pressed={theme === value} onClick={() => setTheme(value)} className={`min-h-9 cursor-pointer rounded-lg px-2 text-sm font-medium capitalize focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue ${theme === value ? 'bg-surface text-dark-blue shadow-sm' : 'text-gray hover:text-dark-blue'}`}>{value}</button>)}
    </div>
  </div>
}
