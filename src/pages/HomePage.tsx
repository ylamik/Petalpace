import { useRef, useState } from "react";
import type { FormEvent } from "react";
import type { CSSProperties, ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  as?: "div" | "section" | "article" | "li";
};

// Fades + slides content in each time it scrolls into view.
// Honors prefers-reduced-motion by skipping the movement.
function Reveal({
  children,
  className,
  delay = 0,
  y = 28,
  as = "div",
}: RevealProps) {
  const reduceMotion = useReducedMotion();
  const MotionTag = motion[as];

  return (
    <MotionTag
      className={className}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y }}
      whileInView={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      viewport={{ amount: 0.25 }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </MotionTag>
  );
}

const petals = [
  { left: "4%", size: 22, duration: 18, delay: -3, drift: 45, turn: 210 },
  { left: "12%", size: 30, duration: 23, delay: -16, drift: -30, turn: -160 },
  { left: "22%", size: 18, duration: 20, delay: -9, drift: 55, turn: 250 },
  { left: "31%", size: 25, duration: 26, delay: -21, drift: -45, turn: -210 },
  { left: "40%", size: 20, duration: 21, delay: -5, drift: 35, turn: 180 },
  { left: "49%", size: 28, duration: 25, delay: -14, drift: -30, turn: -240 },
  { left: "58%", size: 18, duration: 19, delay: -11, drift: 50, turn: 200 },
  { left: "67%", size: 26, duration: 24, delay: -2, drift: -40, turn: -180 },
  { left: "76%", size: 21, duration: 22, delay: -17, drift: 30, turn: 230 },
  { left: "84%", size: 30, duration: 27, delay: -8, drift: -50, turn: -220 },
  { left: "92%", size: 18, duration: 20, delay: -13, drift: -35, turn: 190 },
  { left: "54%", size: 24, duration: 28, delay: -23, drift: 45, turn: -260 },
];

const flowers = [
  { left: "8%", size: 70, duration: 30, delay: -8, drift: 35, turn: 120 },
  { left: "36%", size: 55, duration: 34, delay: -24, drift: -25, turn: -100 },
  { left: "71%", size: 80, duration: 32, delay: -15, drift: 40, turn: 150 },
  { left: "90%", size: 65, duration: 36, delay: -29, drift: -40, turn: -130 },
];

const features = [
  {
    title: "Find your focus",
    description:
      "Choose your top three tasks for the day. Focus on what matters most.",
    background: "/images/pink-note.png",
    icon: "/icons/focus-icon.png",
  },
  {
    title: "Keep it together",
    description:
      "Keep steps, files, and links beside each task. Everything you need in one place.",
    background: "/images/green-note.png",
    icon: "/icons/document-icon.png",
  },
  {
    title: "See how far you’ve come",
    description:
      "Notice the small wins as you go. Progress builds a brighter tomorrow.",
    background: "/images/blue-note.png",
    icon: "/icons/trend-icon.png",
  },
];

function FloatingPetals() {
  const decorations = [
    ...petals.map((petal) => ({
      ...petal,
      kind: "petal",
      image: "/images/petal.png",
    })),
    ...flowers.map((flower) => ({
      ...flower,
      kind: "flower",
      image: "/images/flower.png",
    })),
  ];

  return (
    <div className="petal-layer" aria-hidden="true">
      {decorations.map((decoration, index) => (
        <div
          key={`${decoration.kind}-${index}`}
          className={`petal-track ${
            decoration.kind === "flower" ? "flower-track" : ""
          }`}
          style={
            {
              left: decoration.left,
              "--petal-size": `${decoration.size}px`,
              "--petal-duration": `${decoration.duration}s`,
              "--petal-delay": `${decoration.delay}s`,
              "--petal-drift": `${decoration.drift}px`,
              "--petal-turn": `${decoration.turn}deg`,
            } as CSSProperties
          }
        >
          <img
            src={decoration.image}
            alt=""
            className={`floating-petal ${
              decoration.kind === "flower" ? "floating-flower" : ""
            }`}
            draggable={false}
          />
        </div>
      ))}
    </div>
  );
}

const navLinks = [
  { label: "Home", href: "#top" },
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
];

export default function HomePage() {
  const reduceMotion = useReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);
  const [feedbackState, setFeedbackState] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [feedbackNotice, setFeedbackNotice] = useState('');
  const sendingFeedback = useRef(false);

  async function submitFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sendingFeedback.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    if (!String(data.get('message') ?? '').trim()) {
      setFeedbackState('error'); setFeedbackNotice('Please write a message first.'); return;
    }
    sendingFeedback.current = true;
    setFeedbackState('sending'); setFeedbackNotice('Sending your feedback…');
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedbackType: String(data.get('feedbackType') ?? ''),
          message: String(data.get('message') ?? '').trim(),
          email: String(data.get('email') ?? '').trim(),
          website: String(data.get('website') ?? ''),
        }),
        signal: controller.signal,
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) throw new Error(result?.error || 'Could not send feedback. Please try again later.');
      setFeedbackState('success'); setFeedbackNotice('Thank you! Your feedback has been sent.'); form.reset();
    } catch (error) {
      setFeedbackState('error'); setFeedbackNotice(controller.signal.aborted ? 'The request timed out. Please try again later.' : error instanceof Error ? error.message : 'Could not send feedback. Please try again later.');
    } finally {
      window.clearTimeout(timeoutId);
      sendingFeedback.current = false;
    }
  }

  return (
    <div
      className="min-h-dvh w-full bg-surface font-sans text-dark-blue"
      id="top"
    >
      {/* Navigation */}
      <header className="sticky top-0 z-50 border-b border-dark-blue/15 bg-beige">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-4 py-1.5 sm:px-8">
          <a href="/" aria-label="Petalpace home" className="shrink-0">
            <img
              src="/images/petalpace-logo.png"
              alt="Petalpace"
              className="h-auto w-28 sm:w-36"
            />
          </a>

          <nav
            aria-label="Main navigation"
            className="flex items-center gap-2 text-sm sm:gap-3 sm:text-base"
          >
            {/* Desktop links */}
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="hidden rounded-md px-3 py-2 transition hover:bg-blue/10 md:inline-block"
              >
                {link.label}
              </a>
            ))}

            <a
              href="/sign-in"
              className="hidden whitespace-nowrap rounded-md px-3 py-2 transition hover:bg-blue/10 md:inline-block"
            >
              Sign in
            </a>

            {/* Hamburger (mobile only) */}
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md transition hover:bg-blue/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue md:hidden"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                className="h-6 w-6"
                aria-hidden="true"
              >
                {menuOpen ? (
                  <path d="M6 6l12 12M18 6L6 18" />
                ) : (
                  <path d="M4 7h16M4 12h16M4 17h16" />
                )}
              </svg>
            </button>
          </nav>
        </div>

        {/* Mobile dropdown menu */}
        {menuOpen && (
          <div
            id="mobile-menu"
            className="absolute inset-x-0 top-full border-y border-dark-blue/15 bg-beige shadow-lg md:hidden"
          >
            <nav
              aria-label="Mobile navigation"
              className="mx-auto flex max-w-[1200px] flex-col gap-1 px-4 py-3 sm:px-8"
            >
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-md px-3 py-2.5 transition hover:bg-blue/10"
                >
                  {link.label}
                </a>
              ))}

              <a
                href="/sign-in"
                onClick={() => setMenuOpen(false)}
                className="rounded-md px-3 py-2.5 transition hover:bg-blue/10"
              >
                Sign in
              </a>
            </nav>
          </div>
        )}
      </header>

      <main>
        {/* Hero — petals appear only here */}
        <section
          aria-labelledby="hero-title"
          className="relative isolate overflow-hidden bg-page"
        >
          <FloatingPetals />

          <div className="relative z-10 mx-auto grid max-w-[1200px] items-center gap-8 px-6 py-12 sm:px-8 md:grid-cols-2 md:gap-10 md:py-14 lg:px-12">
            <motion.div
              className="min-w-0 text-center md:text-left"
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            >
              <h1
                id="hero-title"
                className="font-sans leading-[1.05] tracking-tight"
              >
                <span className="block text-[clamp(3rem,11vw,4.25rem)] font-bold md:text-[clamp(2.1rem,5vw,4.25rem)]">
                  Small steps.
                </span>

                <span className="mt-2 block text-[clamp(2.6rem,9.5vw,3.875rem)] font-normal italic md:text-[clamp(1.9rem,4.6vw,3.875rem)]">
                  <span className="text-[#E98268]">Room</span> to bloom.
                </span>
              </h1>

              <p className="mx-auto mt-5 max-w-sm text-base leading-relaxed sm:text-lg md:mx-0 lg:text-xl">
                A gentle space for your tasks, ideas, and everything you want to
                grow.
              </p>

              <a
                href="/sign-up"
                className="mt-7 inline-flex items-center justify-center gap-3 rounded-md bg-blue px-5 py-3 font-semibold text-white transition hover:bg-action-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue"
              >
                Create your free account
                <span aria-hidden="true">→</span>
              </a>

              <div className="mt-6">
                <a
                  href="#features"
                  className="inline-flex items-center gap-2 font-semibold underline decoration-dark-blue/40 underline-offset-8 hover:decoration-dark-blue"
                >
                  Take a peek
                  <span aria-hidden="true">↓</span>
                </a>
              </div>
            </motion.div>

            {/* Book and handwritten note */}
            <motion.div
              className="relative right-[5%] mx-auto w-[82%] max-w-[320px] pb-10 md:right-0 sm:w-[88%] sm:max-w-[390px] md:w-full md:max-w-[430px] lg:max-w-[500px] xl:max-w-[540px]"
              initial={
                reduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, scale: 0.94, y: 16 }
              }
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{
                duration: 0.8,
                delay: 0.15,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <img
                src="/images/book-homepage.png"
                alt="An illustrated planner with tasks and progress."
                className="block h-auto w-full"
                fetchPriority="high"
              />

              <motion.img
                src="/images/note-homepage.png"
                alt="At your own pace."
                className="absolute bottom-0 left-[12%] h-auto w-[28%] max-w-40"
                initial={
                  reduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, rotate: -8, y: 20 }
                }
                animate={{ opacity: 1, rotate: -3, y: 0 }}
                transition={{
                  duration: 0.7,
                  delay: 0.55,
                  ease: [0.22, 1, 0.36, 1],
                }}
              />
            </motion.div>
          </div>
        </section>

        {/* Features banner */}
        <section
          id="features"
          aria-labelledby="features-title"
          className="paper-art relative isolate flex min-h-[240px] scroll-mt-24 items-center justify-center bg-page px-5 py-16 text-center sm:min-h-[260px] sm:px-8 lg:min-h-[280px]"
        >
          {/* Background artwork */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 bg-[url('/images/feature-bg.png')] bg-[length:auto_100%] bg-center bg-repeat-x"
          />

          <Reveal className="mx-auto max-w-5xl" y={0}>
            <div className="flex items-center justify-center gap-2">
              <img
                src="/images/flower.png"
                alt=""
                aria-hidden="true"
                className="h-5 w-5 object-contain sm:h-6 sm:w-6"
              />

              <p className="text-xs font-medium tracking-widest sm:text-sm">
                FEATURES
              </p>
            </div>

            <h2
              id="features-title"
              className="mt-2 text-xl font-semibold leading-snug sm:text-2xl lg:text-3xl"
            >
              A little structure.{" "}
              <em className="font-semibold">A lot more breathing room.</em>
            </h2>
          </Reveal>
        </section>
        {/* Paper-note feature cards */}
        <div className="bg-page px-5 pb-16 pt-8 sm:px-8 lg:pb-20">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-3">
            {features.map((feature, index) => (
              <motion.article
                key={feature.title}
                className="paper-art relative isolate mx-auto w-full max-w-sm px-10 py-12 sm:px-12 lg:px-10 lg:py-12"
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 32 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ amount: 0.3 }}
                transition={{
                  duration: 0.6,
                  delay: index * 0.12,
                  ease: [0.22, 1, 0.36, 1],
                }}
                whileHover={reduceMotion ? undefined : { y: -8 }}
              >
                {/* Paper background */}
                <img
                  src={feature.background}
                  alt=""
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 -z-10 h-full w-full object-fill"
                />

                {/* Feature icon */}
                <img
                  src={feature.icon}
                  alt=""
                  aria-hidden="true"
                  className="mb-3 h-12 w-12 object-contain object-left"
                />

                <h3 className="text-lg font-bold leading-tight lg:text-xl">
                  {feature.title}
                </h3>

                <p className="mt-3 text-sm leading-relaxed sm:text-base lg:text-xl">
                  {feature.description}
                </p>
              </motion.article>
            ))}
          </div>
        </div>

        {/* How it works */}
        <section
          id="how-it-works"
          aria-labelledby="how-it-works-title"
          className="relative isolate min-h-[650px] scroll-mt-28 overflow-hidden bg-page px-6 py-14 sm:px-10 lg:py-16"
        >
          <img
            src="/images/design-works.png"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover object-[center_25%]"
          />

          <div className="mx-auto max-w-5xl">
            <Reveal className="text-center">
              <h2
                id="how-it-works-title"
                className="text-2xl font-bold sm:text-3xl lg:text-4xl"
              >
                How it works
              </h2>

              <p className="mt-2 text-lg italic sm:text-xl">
                From a busy mind to a clearer day.
              </p>
            </Reveal>

            <ol className="mt-10 grid gap-10 md:grid-cols-2 md:gap-x-12 md:gap-y-12 lg:gap-x-20">
              {/* Step 1 */}
              <motion.li
                className="flex min-w-0 flex-col items-center gap-3 text-center md:flex-row md:items-start md:gap-4 md:text-left"
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ amount: 0.4 }}
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-light-pink text-xl font-bold">
                  01
                </span>

                <div className="min-w-0 flex-1">
                  <h3 className="text-xl font-semibold">Add a task</h3>

                  <p className="mt-1 leading-snug">
                    Capture an idea and choose a due date.
                  </p>

                  <img
                    src="/images/add-a-task.png"
                    alt=""
                    aria-hidden="true"
                    className="mx-auto mt-5 h-auto rounded w-full max-w-[340px] object-contain md:mx-0"
                  />                </div>
              </motion.li>

              {/* Step 2 */}
              <motion.li
                className="flex min-w-0 flex-col items-center gap-3 text-center md:flex-row md:items-start md:gap-4 md:text-left"
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ amount: 0.4 }}
                transition={{
                  duration: 0.55,
                  delay: 0.1,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-light-green text-xl font-bold">
                  02
                </span>

                <div className="min-w-0 flex-1">
                  <h3 className="text-xl font-semibold">Break it down</h3>

                  <p className="mt-1 leading-snug">
                    Add smaller steps, files, and useful links.
                  </p>

                  <img
                    src="/images/break-it-down.png"
                    alt=""
                    aria-hidden="true"
                    className="mx-auto mt-5 h-auto w-full max-w-[340px] rounded object-contain md:mx-0"
                  />
                </div>
              </motion.li>

              {/* Step 3 */}
              <motion.li
                className="flex min-w-0 flex-col items-center gap-3 text-center md:flex-row md:items-start md:gap-4 md:text-left"
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ amount: 0.4 }}
                transition={{
                  duration: 0.55,
                  delay: 0.1,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-lightest-blue text-xl font-bold">
                  03
                </span>

                <div className="min-w-0 flex-1">
                  <h3 className="text-xl font-semibold">Choose your focus</h3>

                  <p className="mt-1 leading-snug">
                    Pick your top three tasks for today.
                  </p>

                  <img
                    src="/images/choose-your-focus.png"
                    alt=""
                    aria-hidden="true"
                    className="mx-auto mt-5 h-auto w-full max-w-[340px] rounded object-contain md:mx-0"
                  />                
                </div>
              </motion.li>

              {/* Step 4 */}
              <motion.li
                className="flex min-w-0 flex-col items-center gap-3 text-center md:flex-row md:items-start md:gap-4 md:text-left"
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ amount: 0.4 }}
                transition={{
                  duration: 0.55,
                  delay: 0.1,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-light-pink text-xl font-bold">
                  04
                </span>

                <div className="min-w-0 flex-1">
                  <h3 className="text-xl font-semibold">
                    Celebrate your progress
                  </h3>

                  <p className="mt-1 leading-snug">
                    Mark tasks done and celebrate each step.
                  </p>

                   <img
                    src="/images/celebrate-your-progress.png"
                    alt=""
                    aria-hidden="true"
                    className="mx-auto mt-5 h-auto w-full max-w-[340px] rounded object-contain md:mx-0"
                  />     
                </div>
              </motion.li>
            </ol>
          </div>
        </section>
      </main>

      {/* Today page preview */}
      <section
        aria-labelledby="day-preview-title"
        className="bg-page px-5 pt-4 pb-10 sm:px-8 lg:pb-14"
      >
        <div className="mx-auto max-w-6xl">
          <Reveal as="div">
            <h2
              id="day-preview-title"
              className="text-center text-2xl font-bold sm:text-3xl lg:text-4xl"
            >
              Your day,{" "}
              <span className="font-normal italic">a little lighter.</span>
            </h2>
          </Reveal>

          {/* Dashboard preview */}
          <motion.div
            className="mx-auto mt-8 max-w-[900px] overflow-hidden rounded-2xl border-4 border-[#E0E0E0] bg-surface"
            initial={
              reduceMotion ? { opacity: 0 } : { opacity: 0, y: 36, scale: 0.97 }
            }
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ amount: 0.2 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          >
            <img
              src="/images/today-overview.png"
              alt="Petalpace Today dashboard showing top tasks, spaces, and progress."
              className="block h-auto w-full"
              loading="lazy"
            />
          </motion.div>

          {/* Handwritten caption */}
          <Reveal
            as="div"
            delay={0.2}
            className="mt-5 flex items-center justify-center gap-3 sm:gap-5"
          >
            <img
              src="/images/design-day.png"
              alt=""
              aria-hidden="true"
              className="h-10 w-7 shrink-0 object-contain sm:h-12 sm:w-8"
            />

            <p className="font-story text-center text-xl italic leading-relaxed text-link sm:text-2xl">
              Plan it. Break it down. Make it yours.
            </p>

            <img
              src="/images/design-day.png"
              alt=""
              aria-hidden="true"
              className="h-10 w-7 shrink-0 -scale-x-100 object-contain sm:h-12 sm:w-8"
            />
          </Reveal>
        </div>
      </section>

      {/* A note from the creator */}
      <section
        aria-labelledby="creator-title"
        className="bg-page px-5 py-10 sm:px-8 lg:py-14"
      >
        <motion.div
          className="paper-art relative isolate mx-auto max-w-[1000px] overflow-hidden rounded-[32px] border border-[#F3DCD5] bg-surface"
          initial={
            reduceMotion ? { opacity: 0 } : { opacity: 0, y: 32, scale: 0.98 }
          }
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ amount: 0.3 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Pink watercolor artwork */}
          <img
            src="/images/pink-shade.png"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover object-center"
          />

          {/* Soft white wash to keep text readable */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 bg-surface/20"
          />

          <div className="px-6 py-9 sm:px-10 sm:py-12">
            <p className="text-sm font-medium tracking-wide sm:text-base">
              A NOTE FROM THE CREATOR
            </p>

            <h2
              id="creator-title"
              className="mt-2 text-2xl font-bold leading-tight sm:text-3xl lg:text-4xl"
            >
              Made with care, by Mikyla.
            </h2>

            <p className="mt-3 max-w-xl text-base leading-snug sm:text-lg lg:text-xl">
              A little space to organize your days and grow at your own pace.
            </p>
          </div>
        </motion.div>
      </section>

      {/* Feedback */}
      <section
        id="feedback"
        aria-labelledby="feedback-title"
        className="bg-page px-5 pt-6 pb-16 sm:px-8"
      >
        <div className="mx-auto max-w-[650px]">
          {/* Heading */}
          <Reveal as="div" className="text-center">
            <div className="flex items-center justify-center gap-1">
              <img
                src="/images/flower-grow.png"
                alt=""
                aria-hidden="true"
                className="h-12 w-12 shrink-0 object-contain sm:h-16 sm:w-16 lg:h-20 lg:w-20"
              />

              <h2
                id="feedback-title"
                className="text-2xl font-bold sm:text-3xl lg:text-4xl"
              >
                Help Petalpace grow
              </h2>
            </div>

            <p className="mt-2 text-base sm:text-lg">
              Found a bug or have an idea? I’d love to hear it.
            </p>
          </Reveal>

          {/* Form */}
          <motion.form
            className="mt-6 rounded-lg border border-dark-blue/20 bg-surface p-5 shadow-sm sm:p-7"
            onSubmit={submitFeedback}
            aria-busy={feedbackState === 'sending'}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ amount: 0.15 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          >
            <div hidden aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
            <fieldset disabled={feedbackState === 'sending'}>
              <legend className="font-semibold">Feedback type</legend>

              <div className="mt-2 flex flex-wrap gap-2">
                {["Suggestion", "Report a bug", "Something else"].map(
                  (type, index) => (
                    <label key={type} className="cursor-pointer">
                      <input
                        type="radio"
                        name="feedbackType"
                        value={type}
                        defaultChecked={index === 0}
                        className="peer sr-only"
                      />

                      <span className="block rounded-md border border-dark-blue/20 px-4 py-2 transition hover:bg-lightest-blue/30 peer-checked:border-blue peer-checked:bg-blue peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue">
                        {type}
                      </span>
                    </label>
                  ),
                )}
              </div>
            </fieldset>

            <div className="mt-6">
              <label htmlFor="feedback-message" className="block font-semibold">
                Your message
              </label>

              <textarea
                id="feedback-message"
                name="message"
                maxLength={5000}
                required
                rows={5}
                placeholder="Type a message..."
                className="mt-2 block w-full resize-y rounded-md border border-dark-blue/20 bg-surface px-4 py-3 placeholder:text-gray focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue"
              />
            </div>

            <div className="mt-6">
              <label htmlFor="feedback-email" className="block font-semibold">
                Email (optional)
              </label>

              <input
                id="feedback-email"
                name="email"
                maxLength={254}
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                aria-describedby="feedback-email-hint"
                className="mt-2 block w-full rounded-md border border-dark-blue/20 bg-surface px-4 py-3 placeholder:text-gray focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue"
              />

              <p id="feedback-email-hint" className="mt-2 text-sm">
                Optional—leave your email if you’d like a reply. You can send feedback without it.
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p id="feedback-status" role="status" aria-live="polite" className={`text-sm ${feedbackState === 'error' ? 'text-red' : 'text-gray'}`}>
                {feedbackNotice}
              </p>

              <button
                type="submit"
                disabled={feedbackState === 'sending'}
                aria-describedby="feedback-status"
                className="shrink-0 rounded-md bg-blue px-5 py-2.5 font-semibold text-white hover:bg-action-hover disabled:cursor-wait disabled:opacity-60"
              >
                {feedbackState === 'sending' ? 'Sending…' : 'Send feedback'}
              </button>
            </div>
          </motion.form>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-beige px-6 py-7 text-dark-blue sm:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-6 md:grid-cols-[1fr_1.3fr_1fr] md:gap-8">
            {/* Brand */}
            <div>
              <a href="/" aria-label="Petalpace home">
                <img
                  src="/images/petalpace-logo.png"
                  alt="Petalpace"
                  className="h-auto w-40"
                  loading="lazy"
                />
              </a>

              <p className="mt-1 pl-10 text-sm italic leading-tight">
                A cozy botanical
                <br />
                planner
              </p>
            </div>

            {/* Contact */}
            <div className="border-t border-dark-blue/15 pt-5 md:border-t-0 md:border-l md:py-3 md:pl-8">
              <h2 className="font-semibold">Contact</h2>

              <address className="mt-3 space-y-3 text-sm not-italic">
                <a
                  href="mailto:petalpace7@gmail.com"
                  className="flex items-start gap-2 hover:underline"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5 shrink-0"
                  >
                    <rect x="3" y="5" width="18" height="14" rx="1" />
                    <path d="m3 5 9 8 9-8M3 19l6-6m12 6-6-6" />
                  </svg>

                  <span className="min-w-0 break-all">
                    petalpace7@gmail.com
                  </span>
                </a>

                <a
                  href="tel:+639398834638"
                  className="flex items-center gap-2 hover:underline"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5 shrink-0"
                  >
                    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.8 2.1Z" />
                  </svg>

                  <span>+63 939 883 4638</span>
                </a>
              </address>
            </div>

            {/* Explore */}
            <nav
              aria-label="Footer navigation"
              className="border-t border-dark-blue/15 pt-5 md:border-t-0 md:border-l md:py-3 md:pl-8"
            >
              <h2 className="font-semibold">Explore</h2>

              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <a href="#features" className="hover:underline">
                    Features
                  </a>
                </li>

                <li>
                  <a href="#how-it-works" className="hover:underline">
                    How it works
                  </a>
                </li>

                <li>
                  <a href="#top" className="hover:underline">
                    Back to top <span aria-hidden="true">↑</span>
                  </a>
                </li>
              </ul>
            </nav>
          </div>

          <div className="mt-6 max-w-64"></div>
          <p className="mt-6 text-sm">
            © {new Date().getFullYear()} · Created by Mikyla Caras
            <span className="block sm:inline"><span className="hidden sm:inline"> · </span>Assisted by Erica Espiña</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
