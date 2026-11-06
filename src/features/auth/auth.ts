import { createContext, useContext } from 'react'

export type Account = { id: string; name: string; email: string; photoUrl?: string | null; showReminderTip?: boolean }
export const AuthContext = createContext<{
  user: Account | null
  loading: boolean
  error: string
  refresh: () => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
} | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('AuthProvider is required')
  return context
}

export class AuthError extends Error {
  code?: string
  constructor(message: string, code?: string) { super(message); this.code = code }
}

export async function accountRequest(action: string, data?: Record<string, string>) {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 20000)
  try {
    const response = await fetch(`/api/auth/${action}`, {
      method: data ? 'POST' : 'GET',
      credentials: 'same-origin',
      headers: data ? { 'Content-Type': 'application/json' } : undefined,
      body: data ? JSON.stringify(data) : undefined,
      signal: controller.signal,
      cache: 'no-store',
    })
    const result = await response.json().catch(() => null)
    if (action === 'me' && response.status === 401) return { user: null }
    if (!response.ok || !result) throw new AuthError(result?.error || 'Could not connect to your account. Please try again.', result?.code)
    return result as { user?: Account | null; message?: string; ok?: boolean }
  } catch (error) {
    if (error instanceof AuthError) throw error
    throw new AuthError(controller.signal.aborted ? 'The request timed out. Please try again.' : 'Could not reach Petalpace. Check your connection and try again.')
  } finally { window.clearTimeout(timer) }
}
