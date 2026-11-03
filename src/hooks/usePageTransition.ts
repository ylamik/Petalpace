import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router'

/**
 * Returns `true` for a brief window after the route changes.
 * Works with BrowserRouter (no data-router required).
 *
 * @param duration  How long (ms) the "transitioning" state stays true.
 *                  Keep this short — just long enough to show feedback.
 */
export function usePageTransition(duration = 350) {
  const location = useLocation()
  const [transitioning, setTransitioning] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevPath = useRef(location.pathname)

  useEffect(() => {
    if (location.pathname === prevPath.current) return
    prevPath.current = location.pathname
    setTransitioning(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setTransitioning(false), duration)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [location.pathname, duration])

  return transitioning
}
