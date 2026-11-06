/**
 * Full-page loading indicator.
 *
 * Uses inline styles for the background/color so it's always visible —
 * even before the Tailwind CSS bundle finishes parsing.
 */
export default function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      className="flex min-h-dvh flex-col items-center justify-center gap-5 font-sans"
      style={{ background: 'var(--color-page, #faf7ef)', color: 'var(--color-gray, #5f5f5f)' }}
    >
      <div className="relative flex h-14 w-14 items-center justify-center" aria-hidden="true">
        <span
          className="absolute inset-0 animate-[spin_1s_linear_infinite] rounded-full border-[3px]"
          style={{
            borderColor: 'var(--color-lightest-blue, #ccdbef)',
            borderTopColor: 'var(--color-blue, #4c74a1)',
          }}
        />
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: 'var(--color-blue, #4c74a1)', opacity: 0.6 }}
        />
      </div>
      <p className="text-sm">{label}</p>
    </div>
  )
}

/**
 * Thin animated bar pinned to the top of the viewport.
 * Show it during page transitions or async saves.
 */
export function TopProgressBar({ visible }: { visible: boolean }) {
  if (!visible) return null
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[200] h-[3px] overflow-hidden"
      style={{ background: 'var(--color-lightest-blue, #ccdbef)' }}
    >
      <span
        className="absolute inset-y-0 left-0 w-2/5 rounded-full animate-[navprogress_0.9s_ease-in-out_infinite]"
        style={{ background: 'var(--color-blue, #4c74a1)' }}
      />
    </div>
  )
}

/**
 * Inline button spinner — sits beside button text while an action is pending.
 */
export function ButtonSpinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-4 w-4 animate-[spin_0.75s_linear_infinite] rounded-full border-2 border-white/40 border-t-white"
    />
  )
}
