import { useEffect, useState, type CSSProperties } from 'react'
import { localDateKey } from './taskPresentation'

/* Small pieces for the Today page: progress ring, this-week strip, daily note and the petal burst. */

export function ProgressRing({ done, total }: { done: number; total: number }) {
  const share = total ? done / total : 0
  const circumference = 2 * Math.PI * 15
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-dark-blue/15 bg-surface px-5 py-4 shadow-[0_2px_3px_rgba(0,0,0,0.12)]">
      <svg viewBox="0 0 36 36" className="h-16 w-16 shrink-0" role="img" aria-label={total ? `${done} of ${total} tasks due today done` : 'No tasks due today'}>
        <circle cx="18" cy="18" r="15" fill="none" className="stroke-light-gray" strokeWidth="4" />
        <circle cx="18" cy="18" r="15" fill="none" stroke="var(--heat-3)" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${share * circumference} ${circumference}`} transform="rotate(-90 18 18)" className="transition-[stroke-dasharray] duration-700" />
        <text x="18" y="21.5" textAnchor="middle" fontSize="9" fontWeight="700" className="fill-dark-blue font-serif">{total ? `${Math.round(share * 100)}%` : '–'}</text>
      </svg>
      <div className="min-w-0">
        <p className="font-serif text-xl font-semibold leading-tight">{total ? `${done} of ${total} done` : 'Nothing due today'}</p>
        <p className="mt-0.5 text-sm text-gray">{!total ? 'Enjoy the extra room.' : done === total ? 'All done for today. Well done!' : done ? 'for today. Keep going!' : 'for today. One step at a time.'}</p>
      </div>
    </div>
  )
}

function streakFrom(counts: Map<string, number>, today: Date) {
  const day = new Date(today)
  // A streak still counts if today has nothing yet but yesterday did.
  if (!counts.get(localDateKey(day))) day.setDate(day.getDate() - 1)
  let streak = 0
  while (counts.get(localDateKey(day))) { streak++; day.setDate(day.getDate() - 1) }
  return streak
}

export function WeekCard({ activity, clock, onViewAll }: { activity: { day: string; count: number }[]; clock: Date; onViewAll: () => void }) {
  const counts = new Map(activity.map(item => [item.day, item.count]))
  const todayKey = localDateKey(clock)
  const monday = new Date(clock)
  monday.setHours(12, 0, 0, 0)
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  const days = Array.from({ length: 7 }, (_, i) => { const date = new Date(monday); date.setDate(monday.getDate() + i); return { date, key: localDateKey(date) } })
  const streak = streakFrom(counts, clock)
  return (
    <section aria-labelledby="week-title" className="rounded-lg border border-dark-blue/15 bg-surface p-4 shadow-[0_2px_3px_rgba(0,0,0,0.22)]">
      <div className="flex items-center gap-2">
        <h2 id="week-title" className="text-xl font-bold">This week</h2>
        <img src="/images/yellow-star.png" alt="" aria-hidden="true" className="-ml-2 h-6 w-9 object-contain" />
      </div>
      <ol className="mt-3 grid grid-cols-7 gap-1 text-center">
        {days.map(({ date, key }) => {
          const count = counts.get(key) ?? 0
          const isToday = key === todayKey
          return (
            <li key={key} aria-label={`${date.toLocaleDateString('en', { weekday: 'long' })}: ${count} ${count === 1 ? 'task' : 'tasks'} completed`} className={`rounded-xl py-2 ${isToday ? 'bg-nav-active' : ''}`}>
              <span className="block text-xs text-gray">{date.toLocaleDateString('en', { weekday: 'short' })}</span>
              <span className={`block font-serif text-base ${isToday ? 'font-bold' : 'font-semibold'}`}>{date.getDate()}</span>
              <span aria-hidden="true" className="mt-1 flex h-1.5 justify-center gap-0.5">
                {Array.from({ length: Math.min(count, 3) }, (_, i) => <span key={i} className="h-1.5 w-1.5 rounded-full bg-[var(--heat-3)]" />)}
              </span>
            </li>
          )
        })}
      </ol>
      <div className="mt-3 flex items-center gap-3 rounded-xl bg-light-yellow px-3 py-2.5">
        <img src="/images/flower-grow.png" alt="" aria-hidden="true" className="h-8 w-8 shrink-0 object-contain" />
        <div className="min-w-0 text-sm">
          {streak ? <>
            <p className="font-semibold">{streak}-day streak</p>
            <p className="text-gray">You finished something {streak === 1 ? 'today' : `${streak} days in a row`}.</p>
          </> : <>
            <p className="font-semibold">Start a streak</p>
            <p className="text-gray">Finish one task today to begin.</p>
          </>}
        </div>
      </div>
      <button type="button" onClick={onViewAll} className="mt-3 text-sm text-link underline hover:decoration-2">View all progress</button>
    </section>
  )
}

const notes = [
  'Small steps still count.',
  'Progress, not perfection.',
  'You don’t have to do it all today.',
  'Rest is part of the plan.',
  'One thing at a time is still moving forward.',
  'Be gentle with yourself today.',
  'Done is better than perfect.',
  'Bloom at your own pace.',
  'A little progress each day adds up.',
  'Start where you are.',
]

export function NoteCard({ clock }: { clock: Date }) {
  const start = new Date(clock.getFullYear(), 0, 0)
  const dayOfYear = Math.floor((clock.getTime() - start.getTime()) / 86400000)
  return (
    <aside aria-label="Note to self" className="relative mx-1 -rotate-1 rounded-md bg-light-yellow px-5 pb-5 pt-7 text-center shadow-[0_3px_8px_rgba(0,0,0,0.12)]">
      <span aria-hidden="true" className="absolute -top-2.5 left-1/2 h-5 w-20 -translate-x-1/2 rotate-2 bg-[#e98268]/35" />
      <p className="font-story text-lg italic leading-snug">“{notes[dayOfYear % notes.length]}”</p>
      <p className="mt-2 text-xs text-gray">Note to self · changes daily</p>
      <img src="/images/leaves.png" alt="" aria-hidden="true" className="absolute bottom-2 right-3 h-6 w-6 object-contain" />
    </aside>
  )
}

/* A short shower of petals when a task is marked done. Skipped when the person prefers reduced motion. */
export function PetalBurst({ trigger }: { trigger: number }) {
  // The burst for this trigger shows until its timer marks it finished.
  const [finished, setFinished] = useState(0)
  useEffect(() => {
    if (!trigger) return
    const timer = window.setTimeout(() => setFinished(trigger), 2200)
    return () => window.clearTimeout(timer)
  }, [trigger])
  const active = trigger !== finished ? trigger : 0
  if (!active || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[150] overflow-hidden">
      {Array.from({ length: 18 }, (_, i) => {
        const left = (i * 53 + active * 17) % 100
        const style = {
          left: `${left}%`,
          animationDelay: `${(i % 6) * 0.12}s`,
          '--dx': `${((i * 37) % 120) - 60}px`,
          '--rot': `${((i * 97) % 540) - 270}deg`,
          width: `${14 + (i % 4) * 5}px`,
        } as CSSProperties
        return <img key={`${active}-${i}`} src={i % 3 ? '/images/petal.png' : '/images/pink-flower.png'} alt="" className="petal-burst absolute -top-8 h-auto" style={style} />
      })}
    </div>
  )
}
