type TaskSearchInputProps = {
  value: string
  onChange: (value: string) => void
  label?: string
}

export default function TaskSearchInput({ value, onChange, label = 'Search tasks' }: TaskSearchInputProps) {
  return (
    <label className="flex h-11 w-full min-w-0 items-center gap-2 rounded-md border border-dark-blue/20 bg-surface px-3 text-gray focus-within:ring-2 focus-within:ring-blue/30 sm:w-[280px] sm:shrink-0">
      <svg aria-hidden="true" className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 4.5 4.5" />
      </svg>
      <input type="search" aria-label={label} placeholder="Search tasks..." value={value} onChange={event => onChange(event.target.value)} className="h-full w-full min-w-0 bg-transparent text-base text-dark-blue outline-none placeholder:text-gray" />
    </label>
  )
}
