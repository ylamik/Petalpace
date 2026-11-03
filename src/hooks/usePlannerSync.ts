import { useEffect, useRef } from 'react'

/**
 * Opens a persistent SSE connection to /api/auth/stream.
 * Calls `onRemoteChange` whenever the server signals that the planner
 * was saved from another tab or device.
 *
 * Reconnects automatically after errors with exponential back-off.
 * Does nothing if the user is not logged in (userId is null/undefined).
 */
export function usePlannerSync(userId: string | null | undefined, onRemoteChange: () => void) {
  const callbackRef = useRef(onRemoteChange)

  useEffect(() => {
    callbackRef.current = onRemoteChange
  })

  useEffect(() => {
    if (!userId) return

    let es: EventSource | null = null
    let delay = 1000
    let stopped = false
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    function connect() {
      if (stopped) return
      es = new EventSource('/api/auth/stream', { withCredentials: true })

      es.addEventListener('planner-changed', () => {
        callbackRef.current()
      })

      es.addEventListener('error', () => {
        es?.close()
        es = null
        if (!stopped) {
          retryTimer = setTimeout(() => {
            delay = Math.min(delay * 2, 30000)  // cap at 30 s
            connect()
          }, delay)
        }
      })

      // Reset back-off on a successful open
      es.addEventListener('open', () => { delay = 1000; callbackRef.current() })
    }

    connect()
    const refresh=()=>{if(document.visibilityState==='visible')callbackRef.current()}
    const fallback=setInterval(refresh,30000)
    window.addEventListener('online',refresh)
    document.addEventListener('visibilitychange',refresh)

    return () => {
      stopped = true
      clearInterval(fallback)
      window.removeEventListener('online',refresh)
      document.removeEventListener('visibilitychange',refresh)
      if (retryTimer) clearTimeout(retryTimer)
      es?.close()
    }
  }, [userId])
}
