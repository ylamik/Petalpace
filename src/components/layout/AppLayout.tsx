import ThemeControl from '../ui/ThemeControl'
import TaskReminders from '../../features/tasks/components/TaskReminders'
import { useState } from 'react'
import { Outlet } from 'react-router'
import Sidebar from './Sidebar'
import ProfileMenu from '../auth/ProfileMenu'
import { TopProgressBar } from '../ui/PageLoader'
import { usePageTransition } from '../../hooks/usePageTransition'
import { useSpaces } from '../../features/spaces/spaces'

export default function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const transitioning = usePageTransition(400)
  const { saving } = useSpaces()
  const showBar = transitioning || saving

  return (
    <div className="min-h-dvh bg-canvas font-serif text-dark-blue lg:flex">
      {/* Top progress bar — page transitions + planner saves */}
      <TopProgressBar visible={showBar} />

      {/* Desktop sidebar */}
      <div className="sticky top-0 hidden h-dvh shrink-0 lg:block">
        <Sidebar />
      </div>

      <div className="min-w-0 flex-1">
        {/* Mobile and tablet navigation */}
        <header className="sticky top-0 z-30 border-b border-dark-blue/10 bg-beige lg:hidden">
          <div className="flex items-center justify-between gap-3 px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <button
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
              <img src="/images/petalpace-logo.png" alt="Petalpace" className="h-auto w-28 object-contain sm:w-32" />
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <ThemeControl compact />
              <ProfileMenu doodle={false} compact />
            </div>
          </div>

          <div
            id="planner-mobile-menu"
            hidden={!menuOpen}
            className="max-h-[50dvh] overflow-y-auto border-t border-dark-blue/10"
          >
            <Sidebar compact onNavigate={() => setMenuOpen(false)} />
          </div>
        </header>

        {/* Page content — dims briefly when navigating */}
        <main
          className="mx-auto max-w-[1400px] px-5 py-7 sm:px-8 lg:p-10 transition-opacity duration-300"
          style={{ opacity: transitioning ? 0.55 : 1 }}
        >
          <TaskReminders />
          <Outlet />
        </main>
      </div>
    </div>
  )
}
