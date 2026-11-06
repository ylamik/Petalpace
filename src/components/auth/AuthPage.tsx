import { ButtonSpinner } from '../ui/PageLoader'
import { useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { accountRequest, AuthError, useAuth } from '../../features/auth/auth'
import { passwordError, passwordProblems, passwordRuleLabels, type PasswordRule } from '../../features/auth/passwordRules'

type AuthPageProps = {
  mode: 'sign-in' | 'sign-up' | 'verify-email' | 'forgot-password' | 'reset-password'
}

const inputClass =
  'mt-2 block min-h-11 w-full rounded-md border border-dark-blue/20 ' +
  'bg-surface px-3 py-2.5 text-base outline-none transition ' +
  'placeholder:text-gray focus:border-blue focus:ring-2 focus:ring-blue/20'

export default function AuthPage({ mode }: AuthPageProps) {
  const isSignUp = mode === 'sign-up'
  const isVerify = mode === 'verify-email'
  const isForgot = mode === 'forgot-password'
  const isReset = mode === 'reset-password'
  const newPassword = isSignUp || isReset
  const { user, signIn, refresh } = useAuth()
  const navigate = useNavigate()
  const pendingInvite=sessionStorage.getItem('petalpace-pending-invite') || ''
  const afterSignIn=/^\/collaboration\/join#token=[a-f0-9]{64}$/.test(pendingInvite)?pendingInvite:'/today'
  const location = useLocation()
  const formRef = useRef<HTMLFormElement>(null)
  const busyRef = useRef(false)
  const [busy, setBusy] = useState(false)
  const [needsVerification, setNeedsVerification] = useState(false)
  const [finished, setFinished] = useState(false)
  const token = new URLSearchParams(location.hash.slice(1)).get('token') || ''
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [notice, setNotice] = useState('')
  const [signInFailed, setSignInFailed] = useState(false)
  const [typed, setTyped] = useState({ password: '', email: '', name: '' })

  async function submit(resend = false) {
    if (busyRef.current || !formRef.current?.reportValidity()) return
    const form = formRef.current
    const data = new FormData(form)
    const email = String(data.get('email') || '').trim()
    const password = String(data.get('password') || '')
    if (newPassword) {
      const weak = passwordError(passwordProblems(password, { email, name: String(data.get('name') || '') }))
      if (weak) { setNotice(weak); return }
    }
    if (newPassword && password !== data.get('confirmPassword')) { setNotice('Your passwords do not match.'); return }
    busyRef.current = true
    setBusy(true)
    setNotice('')
    setSignInFailed(false)
    try {
      if (mode === 'sign-in' && !resend) {
        await signIn(email, password)
        form.reset()
        navigate(afterSignIn, { replace: true })
        return
      }
      const action = resend ? 'resend' : isSignUp ? 'register' : isVerify ? 'verify' : mode
      const result = await accountRequest(action, { email, password, name: String(data.get('name') || '').trim(), token })
      setNotice(result.message || 'Done.')
      if (isVerify || isReset || isForgot) { setFinished(true); form.reset() }
      if (isReset) await refresh()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Please try again.')
      setNeedsVerification(error instanceof AuthError && error.code === 'EMAIL_UNVERIFIED')
      // Same message whether or not the email has an account, so the page never reveals who has signed up.
      setSignInFailed(mode === 'sign-in' && !resend && !(error instanceof AuthError && error.code === 'EMAIL_UNVERIFIED') && /incorrect/i.test(error instanceof Error ? error.message : ''))
    } finally { busyRef.current = false; setBusy(false) }
  }
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void submit()
  }

  if (user && (mode === 'sign-in' || isSignUp)) return <Navigate to={afterSignIn} replace />

  return (
    <main className="min-h-dvh bg-page font-sans text-dark-blue md:flex md:items-center md:justify-center md:p-6 lg:p-10">
      <div className="mx-auto grid w-full max-w-[1000px] overflow-hidden bg-surface md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:rounded-xl md:border md:border-dark-blue/10 md:shadow-sm">
        {/* Shared illustration panel */}
        <aside className="relative min-w-0 overflow-hidden bg-beige px-6 py-6 sm:px-10 md:flex md:flex-col md:py-10">
          <Link
            to="/"
            aria-label="Petalpace home"
            className="inline-block w-fit rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue"
          >
            <img
              src="/images/petalpace-logo.png"
              alt="Petalpace"
              className="h-auto w-36"
            />
          </Link>

          <div className="relative mt-5 md:mt-8">
            <img
              src="/images/flower.png"
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute -left-5 top-1 h-5 w-5 object-contain"
            />

            <h2 className="text-2xl font-semibold leading-tight lg:text-3xl">
              Room for your plans.
              <br />
              Space for yourself.
            </h2>

            <p className="mt-3 max-w-xs text-sm leading-relaxed lg:text-base">
              A kinder, calmer way to plan your studies and your days.
            </p>
          </div>

          <div className="relative hidden flex-1 items-center justify-center py-6 md:flex">
  <img
    src="/images/book-homepage.png"
    alt="An illustrated planner with task cards and progress."
   className="mx-auto block h-auto w-full max-w-[420px]"
  />

            <img
              src="/images/flower.png"
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute bottom-6 left-0 h-9 w-9 -rotate-12 object-contain"
            />

            <img
              src="/images/flower.png"
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute right-0 top-3 h-7 w-7 rotate-12 object-contain"
            />
          </div>
        </aside>

        {/* Form panel */}
        <section
          aria-labelledby="auth-title"
          className="flex min-w-0 flex-col px-5 py-6 sm:px-8 md:min-h-[620px] md:py-8 lg:px-12"
        >
          <Link
            to="/"
            className="ml-auto inline-flex min-h-11 items-center gap-2 rounded text-sm text-link hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue"
          >
            <span aria-hidden="true">←</span>
            Back to home
          </Link>

          <div className="my-auto py-6">
            {(isForgot || isReset) && <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-light-pink" aria-hidden="true">
              <img src="/images/flower.png" alt="" className="h-8 w-8 object-contain" />
            </div>}
            <h1
              id="auth-title"
              className="text-2xl font-semibold leading-tight sm:text-3xl"
            >
              {isSignUp ? (
                <>
                  Your next chapter
                  <br />
                  starts here
                </>
              ) : (
                isVerify ? 'Verify your email' : isForgot ? (finished ? 'Check your inbox' : 'Forgot your password?') : isReset ? (finished ? 'You’re ready to return' : 'Choose a new password') : 'Welcome back'
              )}
            </h1>

            <p className="mt-2 text-sm leading-relaxed">
              {isSignUp
                ? 'Create your space for plans, tasks, and ideas.'
                : isVerify ? 'Confirm your email to open your planner. Only continue if you requested this account.'
                : isForgot ? (finished ? 'If there’s an account for that address, your reset link is on its way. Check Spam too.' : 'Forgot your password? Enter your email and we’ll help you return to your space.')
                : isReset ? (finished ? 'Your password has been updated. Sign in to return to your planner.' : 'Choose and confirm a new password to return to your planner.')
                : 'A little space to plan your day.'}
            </p>

            <form ref={formRef} onSubmit={handleSubmit} onInput={event => { const form = event.currentTarget; const value = (field: string) => String(new FormData(form).get(field) || ""); if (newPassword) setTyped({ password: value("password"), email: value("email"), name: value("name") }) }} className="mt-7 space-y-5" aria-busy={busy}>
              <fieldset disabled={busy || finished} hidden={finished} className="space-y-5 disabled:opacity-70">
              {isSignUp && (
                <div>
                  <label
                    htmlFor="auth-name"
                    className="block text-sm font-semibold"
                  >
                    Your name
                  </label>

                  <input
                    id="auth-name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    placeholder="Your name"
                    required
                    maxLength={100}
                    className={inputClass}
                  />
                </div>
              )}

              {!isVerify && !isReset && <div>
                <label
                  htmlFor="auth-email"
                  className="block text-sm font-semibold"
                >
                  Email address
                </label>

                <input
                  id="auth-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="Enter email"
                  required
                  maxLength={254}
                  className={inputClass}
                />
              </div>}

              {!isVerify && !isForgot && <div>
                <label
                  htmlFor="auth-password"
                  className="block text-sm font-semibold"
                >
                  Password
                </label>

                <div className="relative">
                  <input
                    id="auth-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={
                      newPassword ? 'new-password' : 'current-password'
                    }
                    placeholder="Enter password"
                    required
                    minLength={newPassword ? 15 : undefined}
                    maxLength={128}
                    aria-describedby={
                      newPassword ? 'password-hint' : undefined
                    }
                    className={`${inputClass} pr-12`}
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    aria-controls="auth-password"
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-gray hover:text-dark-blue focus-visible:outline-2 focus-visible:outline-blue"
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-5 w-5"
                    >
                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                      <circle cx="12" cy="12" r="3" />
                      {showPassword && <path d="m3 3 18 18" />}
                    </svg>
                  </button>
                </div>

                {newPassword && (
                  <div id="password-hint" className="mt-2 text-xs">
                    <ul className="grid gap-1 sm:grid-cols-2">
                      {(Object.keys(passwordRuleLabels) as PasswordRule[]).map(rule => {
                        const met = typed.password !== '' && !passwordProblems(typed.password, typed).includes(rule)
                        return (
                          <li key={rule} className={`flex items-center gap-1.5 ${met ? 'text-done-ink' : 'text-gray'}`}>
                            <span aria-hidden="true" className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] ${met ? 'border-done-stroke bg-done-badge' : 'border-dark-blue/25'}`}>{met ? '✓' : ''}</span>
                            {passwordRuleLabels[rule]}<span className="sr-only">{met ? ' (done)' : ' (not yet)'}</span>
                          </li>
                        )
                      })}
                    </ul>
                    <p className="mt-2 text-gray">Tip: a few random words with a number or symbol, like “Purple-Kettle-Dances-7”.</p>
                  </div>
                )}

                {mode === 'sign-in' && (
                  <div className="mt-2 text-right">
                    <Link
                      to="/forgot-password"
                      className="inline-flex min-h-11 items-center rounded text-sm text-link hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue"
                    >
                      Forgot password?
                    </Link>
                  </div>
                )}
              </div>}

              {newPassword && <div>
                <label htmlFor="auth-confirm" className="block text-sm font-semibold">Confirm password</label>
                <div className="relative">
                  <input id="auth-confirm" name="confirmPassword" type={showConfirmPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="Enter password again" required maxLength={128} className={`${inputClass} pr-12`} />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(visible => !visible)}
                    aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                    aria-pressed={showConfirmPassword}
                    aria-controls="auth-confirm"
                    className="absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center rounded-r-md text-gray hover:text-dark-blue focus-visible:outline-2 focus-visible:outline-blue"
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                      <circle cx="12" cy="12" r="3" />
                      {showConfirmPassword && <path d="m3 3 18 18" />}
                    </svg>
                  </button>
                </div>
              </div>}

              {(isVerify || isReset) && !token && <p className="text-sm text-red">Open the link from your email. If it expired, request another one.</p>}

              <button
                type="submit"
                disabled={busy || finished || ((isVerify || isReset) && !token)}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-blue px-4 py-2.5 font-semibold text-white transition-colors hover:bg-action-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue disabled:opacity-70"
              >
                {busy && <ButtonSpinner />}
                {busy ? (isForgot ? 'Sending reset link…' : isReset ? 'Saving password…' : 'Please wait…') : isSignUp ? 'Create account' : isVerify ? 'Verify email' : isForgot ? 'Send reset link' : isReset ? 'Save new password' : 'Sign in'}
              </button>
              {needsVerification && <button type="button" onClick={() => void submit(true)} className="w-full rounded border border-blue px-4 py-2 text-link">Resend verification email</button>}
              </fieldset>

              <p
                role="status"
                aria-live="polite"
                aria-atomic="true"
                className={
                  notice
                    ? 'rounded-md bg-lightest-blue/40 p-3 text-sm'
                    : 'sr-only'
                }
              >
                {signInFailed ? (
                  <>
                    <span className="block font-semibold">We couldn’t sign you in.</span>
                    <span className="mt-1 block">Check your email and password. New to Petalpace?{' '}<Link to="/sign-up" className="font-semibold text-link underline underline-offset-2">Create an account</Link> or <Link to="/forgot-password" className="font-semibold text-link underline underline-offset-2">reset your password</Link>.</span>
                  </>
                ) : notice}
              </p>
            </form>

            {isForgot && finished && <div className="mt-4 rounded-lg border border-dark-blue/10 bg-beige/40 p-4 text-sm leading-relaxed">
              <p>Open the link in your email, then choose and confirm your new password. The link expires after 30 minutes.</p>
              <button type="button" onClick={() => { setFinished(false); setNotice('') }} className="mt-3 text-link underline">Try another email or request a new link</button>
            </div>}
            {isReset && !finished && <Link
              to="/forgot-password"
              className="mt-4 inline-flex min-h-11 items-center rounded text-sm text-link underline focus-visible:outline-2 focus-visible:outline-blue"
            >
              Link expired or missing? Request a new one
            </Link>}
            {finished && <Link to="/sign-in" replace className="mt-4 block rounded bg-blue p-3 text-center font-semibold text-white">{isForgot ? 'Back to sign in' : 'Continue to sign in'}</Link>}

            <div className="mt-7 border-t border-dark-blue/15 pt-5 text-center text-sm">
              {mode !== 'sign-in' ? (
                <p>
                  Already have an account?{' '}
                  <Link
                    to="/sign-in"
                    className="inline-block py-2 text-link hover:underline"
                  >
                    Sign in
                  </Link>
                </p>
              ) : (
                <p>
                  New to Petalpace?{' '}
                  <Link
                    to="/sign-up"
                    className="inline-block py-2 text-link hover:underline"
                  >
                    Create an account
                  </Link>
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
