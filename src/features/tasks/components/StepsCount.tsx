export function StepsIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 shrink-0">
    <path d="m3 7 2 2 4-4M3 17l2 2 4-4M13 7h8M13 17h8" />
  </svg>
}

/** Compact progress such as "1/3". Pass the steps a task has and which are done. */
export default function StepsCount({ total, done }: { total: number; done: number }) {
  return <span className="inline-flex items-center gap-1.5 text-sm text-gray">
    <StepsIcon />
    <span className="sr-only">{done} of {total} steps done</span>
    <span aria-hidden="true">{done}/{total}</span>
  </span>
}
