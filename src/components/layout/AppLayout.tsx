import ThemeControl from '../ui/ThemeControl'
import TaskReminders from '../../features/tasks/components/TaskReminders'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router'
import Sidebar from './Sidebar'
import ProfileMenu from '../auth/ProfileMenu'
import { TopProgressBar } from '../ui/PageLoader'
import ProgressDialog from '../../features/tasks/components/ProgressDialog'
import AddTaskDialog, { type TaskDraft } from '../../features/tasks/components/AddTaskDialog'
import { usePageTransition } from '../../hooks/usePageTransition'
import { useSpaces } from '../../features/spaces/spaces'

export default function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [progressOpen, setProgressOpen] = useState(false)
  const [newTaskOpen, setNewTaskOpen] = useState(false)
  const transitioning = usePageTransition(400)
  const { saving, syncing, tasks, setTasks } = useSpaces()
  const showBar = transitioning || saving || !!syncing
  const location = useLocation()
  const menuRef = useRef<HTMLDialogElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const mainRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!menuOpen) return
    const dialog = menuRef.current
    const trigger = menuButtonRef.current
    const scrollX = window.scrollX
    const scrollY = window.scrollY
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog?.showModal()
    // Native dialog autofocus must not move the background page.
    window.scrollTo({ left: scrollX, top: scrollY, behavior: 'instant' })
    const desktop = window.matchMedia('(min-width: 1024px)')
    const closeOnDesktop = () => { if (desktop.matches) setMenuOpen(false) }
    desktop.addEventListener('change', closeOnDesktop)
    return () => {
      dialog?.close()
      document.body.style.overflow = overflow
      desktop.removeEventListener('change', closeOnDesktop)
      trigger?.focus({ preventScroll: true })
    }
  }, [menuOpen])

  // Pressing N anywhere opens a new task, unless the person is typing or a dialog is open.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'n' || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"]') || document.querySelector('dialog[open], [role="dialog"]')) return
      event.preventDefault()
      setNewTaskOpen(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function createTask(draft: TaskDraft) {
    setTasks(current => [...current, { ...draft, id: crypto.randomUUID(), spaceId: '', done: draft.done ?? false, completedSteps: [] }])
  }

  // Scroll to top whenever the route changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
    mainRef.current?.scrollTo({ top: 0, behavior: 'instant' })
  }, [location.pathname])

  // Scroll-to-top handler passed to Sidebar so clicking the active link scrolls up
  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="min-h-dvh bg-canvas font-sans text-dark-blue lg:flex">
      {/* Top progress bar — page transitions + planner saves */}
      <TopProgressBar visible={showBar} />

      {/* Desktop sidebar */}
      <div className="sticky top-0 z-40 hidden h-dvh shrink-0 border-r border-dark-blue/5 lg:block">
        <Sidebar onScrollTop={scrollToTop} onProgress={() => setProgressOpen(true)} onNewTask={() => setNewTaskOpen(true)} />
      </div>

      <div ref={mainRef} className="min-w-0 flex-1">
        {/* Mobile and tablet navigation */}
        <header className="sticky top-0 z-30 border-b border-dark-blue/10 bg-sidebar lg:hidden">
          <div className="flex items-center justify-between gap-3 px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <button
                ref={menuButtonRef}
                type="button"
                aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
                aria-expanded={menuOpen}
                aria-controls="planner-mobile-menu"
                onClick={() => setMenuOpen(open => !open)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-surface/50"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                  {menuOpen ? <path d="m6 6 12 12M6 18 18 6" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
                </svg>
              </button>
              <span className="flex items-center gap-2"><img src="/images/petalpace-mark.png" alt="" className="h-6 w-auto object-contain" /><span className="font-serif text-lg font-semibold">Petalpace</span></span>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <ThemeControl compact />
              <ProfileMenu />
            </div>
          </div>

        </header>

        {menuOpen && <dialog ref={menuRef} id="planner-mobile-menu" aria-label="Navigation" onCancel={() => setMenuOpen(false)} className="fixed inset-x-0 top-0 bottom-auto m-0 h-auto max-h-[85dvh] w-full max-w-full overflow-hidden rounded-b-2xl border-0 bg-sidebar p-0 text-dark-blue shadow-xl backdrop:bg-black/5 backdrop:backdrop-blur-[1px]">
          <div className="flex max-h-[85dvh] flex-col">
            <div className="flex shrink-0 items-center gap-3 border-b border-dark-blue/10 px-3 py-2">
              <button autoFocus type="button" onClick={() => setMenuOpen(false)} aria-label="Close navigation" className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-surface/50">
                <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m6 6 12 12M6 18 18 6"/></svg>
              </button>
              <span className="flex items-center gap-2"><img src="/images/petalpace-mark.png" alt="" className="h-6 w-auto object-contain" /><span className="font-serif text-lg font-semibold">Petalpace</span></span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <Sidebar compact onNavigate={() => setMenuOpen(false)} onScrollTop={scrollToTop} onProgress={() => setProgressOpen(true)} onNewTask={() => setNewTaskOpen(true)}/>
            </div>
          </div>
        </dialog>}

        {/* Page content — dims briefly when navigating */}
        <main
          className="mx-auto max-w-[1400px] px-5 py-7 sm:px-8 lg:p-10 transition-opacity duration-300"
          style={{ opacity: transitioning ? 0.55 : 1 }}
        >
          <TaskReminders />
          <Outlet />
        </main>
        {progressOpen && <ProgressDialog onClose={() => setProgressOpen(false)} />}
        {newTaskOpen && <AddTaskDialog initialTitle="" canPin={tasks.filter(task => task.pinned).length < 3} onClose={() => setNewTaskOpen(false)} onCreate={createTask} />}
      </div>
    </div>
  )
}
