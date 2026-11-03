import ThemeControl from '../ui/ThemeControl'
import { useState } from "react";
import DeleteSpaceDialog from "../../features/spaces/DeleteSpaceDialog";
import EditSpaceDialog from "../../features/spaces/EditSpaceDialog";
import { NavLink, useNavigate, useLocation } from "react-router";
import { useSpaces } from "../../features/spaces/spaces";

const navigation = [
  { name: "Today",     icon: "/icons/today-icon.png",           path: "/today" },
  { name: "Upcoming",  icon: "/icons/upcoming-icon (1).png",    path: "/upcoming" },
  { name: "All Tasks", icon: "/icons/all-tasks-icon.png",       path: "/tasks" },
  { name: "Calendar",  icon: "/icons/calendar-icon.png",        path: "/calendar" },
  { name: "Collaboration", icon: null, path: "/collaboration" },
];

type SidebarProps = {
  compact?: boolean;
  onNavigate?: () => void;
  onAddSpace?: () => void;
  onScrollTop?: () => void;
}

export default function Sidebar({ onNavigate, onAddSpace, compact = false, onScrollTop }: SidebarProps) {
  const { spaces, trash } = useSpaces();
  const navigate = useNavigate();
  const location = useLocation();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editId, setEditId]     = useState<string | null>(null);
  const selectedSpace = spaces.find((s) => s.id === deleteId);
  const editingSpace  = spaces.find((s) => s.id === editId);

  return (
    <aside className="flex h-auto w-full shrink-0 flex-col bg-beige p-4 lg:sticky lg:top-0 lg:h-dvh lg:w-58">
      {!compact && (
        <div className="flex shrink-0 items-center gap-1">
          <img src="/images/petalpace-logo.png" alt="Petalpace" className="min-w-0 w-36 flex-1 object-contain" />
          <ThemeControl compact />
        </div>
      )}

      <nav
        aria-label="Main navigation"
        className={compact ? "grid grid-cols-3 gap-1 text-sm" : "mt-5 shrink-0 space-y-1 text-[0.9375rem]"}
      >
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            onClick={(e) => {
              // If already on this page, just scroll to top instead of navigating
              if (location.pathname === item.path) {
                e.preventDefault()
                onScrollTop?.()
              }
              onNavigate?.()
            }}
            className={({ isActive }) =>
              `flex w-full items-center gap-4 rounded-lg px-3 py-3 text-sm font-medium text-left hover:bg-lightest-blue ${isActive ? "bg-lightest-blue" : ""}`
            }
          >
            {item.icon ? (
              <img src={item.icon} alt="" width={20} height={20} className={compact ? "hidden" : "h-5 w-5 object-contain"} />
            ) : (
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={compact ? "hidden" : "h-5 w-5 shrink-0"}>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            )}
            <span>{item.name}</span>
          </NavLink>
        ))}
      </nav>

      <hr className="border-dark-blue/15 my-4" />

      <div className="flex justify-between items-center mx-2">
        <p className="text-sm font-medium text-gray">My spaces</p>
        <button
          type="button"
          className="cursor-pointer hover:bg-surface/50 rounded-full p-2"
          onClick={() => {
            if (onAddSpace) onAddSpace();
            else navigate("/spaces/new");
            onNavigate?.();
          }}
          aria-label="Add space"
        >
          <img src="/icons/add-button.png" alt="" />
        </button>
      </div>

      <ul className={compact ? "mt-1 grid grid-cols-2 gap-1 text-sm sm:grid-cols-3" : "mt-3 min-h-0 overflow-y-auto space-y-1 text-[0.9375rem]"}>
        {spaces.map((space) => (
          <li
            key={space.id}
            className={`group flex min-w-0 items-center rounded-lg ${location.pathname === `/spaces/${space.id}` ? "bg-lightest-blue" : ""}`}
          >
            {/* Space nav link */}
            <NavLink
              to={"/spaces/" + space.id}
              onClick={(e) => {
                if (location.pathname === `/spaces/${space.id}`) {
                  e.preventDefault()
                  onScrollTop?.()
                }
                onNavigate?.()
              }}
              className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-surface/50"
            >
              <span
                aria-hidden="true"
                className="h-4 w-4 shrink-0 rounded-full border border-dark-blue/30"
                style={{ backgroundColor: space.color }}
              />
              <span className="min-w-0 truncate" title={space.name}>
                {space.name}
              </span>
            </NavLink>

            {/* Edit button — hidden until row is focused/hovered in non-compact mode */}
            {!compact && (
              <button
                type="button"
                onClick={() => setEditId(space.id)}
                aria-label={`Edit ${space.name} space`}
                title={`Edit ${space.name}`}
                className="flex h-11 w-8 shrink-0 items-center justify-center rounded-lg text-gray opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-lightest-blue/60 hover:text-blue focus-visible:outline-blue transition-opacity"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                  <path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15v5Z" />
                </svg>
              </button>
            )}

            {/* Delete button */}
            <button
              type="button"
              onClick={() => setDeleteId(space.id)}
              aria-label={`Delete ${space.name} space`}
              title={`Delete ${space.name}`}
              className="flex h-11 w-9 shrink-0 items-center justify-center rounded-lg text-gray hover:bg-light-red/50 hover:text-red focus-visible:outline-blue"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" />
              </svg>
            </button>
          </li>
        ))}
      </ul>

      <NavLink
        to="/bin"
        onClick={(e) => {
          if (location.pathname === '/bin') {
            e.preventDefault()
            onScrollTop?.()
          }
          onNavigate?.()
        }}
        className={({ isActive }) =>
          `my-3 flex min-h-11 shrink-0 items-center gap-3 rounded-lg border-t border-dark-blue/10 px-3 py-3 text-sm font-medium hover:bg-lightest-blue ${isActive ? "bg-lightest-blue" : ""}`
        }
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4">
          <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" />
        </svg>
        <span>Bin</span>
        {trash.length > 0 && (
          <span className="ml-auto rounded-full bg-surface/70 px-2 py-0.5 text-xs">
            {trash.length}
          </span>
        )}
      </NavLink>

      {/* Edit space dialog */}
      {editingSpace && (
        <EditSpaceDialog
          space={editingSpace}
          onCancel={() => setEditId(null)}
          onSaved={() => setEditId(null)}
        />
      )}

      {/* Delete space dialog */}
      {selectedSpace && (
        <DeleteSpaceDialog
          space={selectedSpace}
          onCancel={() => setDeleteId(null)}
          onDeleted={() => {
            if (location.pathname === `/spaces/${selectedSpace.id}`)
              navigate("/tasks", { replace: true });
            setDeleteId(null);
          }}
        />
      )}
    </aside>
  );
}
