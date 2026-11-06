import { Link, useNavigate } from 'react-router'
import { useAuth } from '../features/auth/auth'

export default function NotFoundPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-page px-6 py-12 font-sans text-dark-blue">
      {/* Decorative petals */}
      <img
        src="/images/petal.png"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute left-8 top-16 h-10 w-10 -rotate-12 object-contain opacity-50 sm:h-14 sm:w-14"
      />
      <img
        src="/images/petal.png"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute right-10 top-24 h-8 w-8 rotate-12 object-contain opacity-40 sm:h-12 sm:w-12"
      />
      <img
        src="/images/flower.png"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute bottom-20 left-12 h-10 w-10 rotate-6 object-contain opacity-30"
      />

      {/* Logo */}
      <Link to="/" aria-label="Petalpace home" className="mb-8">
        <img
          src="/images/petalpace-logo.png"
          alt="Petalpace"
          className="h-auto w-36"
        />
      </Link>

      {/* Illustration */}
      <img
        src="/images/flower-grow.png"
        alt=""
        aria-hidden="true"
        className="h-24 w-24 object-contain"
      />

      {/* Message */}
      <div className="mt-6 max-w-sm text-center">
        <p className="text-6xl font-bold text-link">404</p>

        <h1 className="mt-3 text-2xl font-bold leading-tight sm:text-3xl">
          This page doesn't exist
        </h1>

        <p className="mt-3 text-base leading-relaxed text-gray">
          The page you're looking for may have been moved, deleted, or never
          existed. Let's get you back somewhere familiar.
        </p>
      </div>

      {/* Actions */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        {user ? (
          <>
            <Link
              to="/today"
              className="rounded-lg bg-blue px-5 py-2.5 font-semibold text-white transition hover:bg-action-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue"
            >
              Back to Today
            </Link>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="rounded-lg border border-dark-blue/20 px-5 py-2.5 font-semibold transition hover:bg-beige focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue"
            >
              Go back
            </button>
          </>
        ) : (
          <>
            <Link
              to="/"
              className="rounded-lg bg-blue px-5 py-2.5 font-semibold text-white transition hover:bg-action-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue"
            >
              Go to homepage
            </Link>
            <Link
              to="/sign-in"
              className="rounded-lg border border-dark-blue/20 px-5 py-2.5 font-semibold transition hover:bg-beige focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue"
            >
              Sign in
            </Link>
          </>
        )}
      </div>

      {/* Tagline */}
      <p className="font-story mt-10 text-lg italic text-gray">
        Every step forward counts.
      </p>
    </main>
  )
}
