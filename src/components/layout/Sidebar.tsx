import { useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router";
import ProfileMenu from "../auth/ProfileMenu";
import ThemeControl from "../ui/ThemeControl";
import DeleteSpaceDialog from "../../features/spaces/DeleteSpaceDialog";
import EditSpaceDialog from "../../features/spaces/EditSpaceDialog";
import { useSpaces } from "../../features/spaces/spaces";
import { taskDaysUntil } from "../../features/tasks/components/taskPresentation";
import { usePlannerClock } from "../../hooks/usePlannerClock";

function Icon({ children, className = "h-5 w-5 shrink-0" }: { children: ReactNode; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {children}
    </svg>
  );
}

const icons = {
  today: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></>,
  planner: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></>,
  tasks: <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />,
  shared: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
  progress: <path d="M6 20v-6M12 20V4M18 20v-9" />,
  bin: <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" />,
};

type SidebarProps = {
  compact?: boolean;
  onNavigate?: () => void;
  onAddSpace?: () => void;
  onScrollTop?: () => void;
  onProgress?: () => void;
  onNewTask?: () => void;
};

const rowBase = "flex w-full items-center gap-3 rounded-xl px-3 text-left text-[0.9375rem] hover:bg-nav-active focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue";

export default function Sidebar({ onNavigate, onAddSpace, compact = false, onScrollTop, onProgress, onNewTask }: SidebarProps) {
  const { spaces, trash, tasks } = useSpaces();
  const navigate = useNavigate();
  const location = useLocation();
  const clock = usePlannerClock();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const selectedSpace = spaces.find((s) => s.id === deleteId);
  const editingSpace = spaces.find((s) => s.id === editId);

  const open = tasks.filter((task) => !task.done);
  const todayCount = open.filter((task) => (taskDaysUntil(task, clock) ?? 1) <= 0).length;
  const plannerCount = open.filter((task) => taskDaysUntil(task, clock) !== null).length;
  const navigation = [
    { name: "Today", icon: icons.today, path: "/today", count: todayCount },
    { name: "Planner", icon: icons.planner, path: "/planner", count: plannerCount },
    { name: "All tasks", icon: icons.tasks, path: "/tasks", count: 0 },
    { name: "Shared", icon: icons.shared, path: "/collaboration", count: 0 },
  ];

  function stayOrGo(path: string) {
    return (event: React.MouseEvent) => {
      // Clicking the page you're already on just scrolls back to the top.
      if (location.pathname === path) {
        event.preventDefault();
        onScrollTop?.();
      }
      onNavigate?.();
    };
  }

  return (
    <aside className="flex h-auto w-full shrink-0 flex-col bg-sidebar p-4 lg:h-dvh lg:w-60">
      {!compact && (
        <div className="mb-5 flex shrink-0 items-center gap-2 px-2 pt-1">
          <img src="/images/petalpace-mark.png" alt="" className="h-7 w-auto object-contain" />
          <span className="font-serif text-xl font-semibold">Petalpace</span>
        </div>
      )}

      {onNewTask && (
        <button
          type="button"
          onClick={() => { onNavigate?.(); onNewTask(); }}
          aria-keyshortcuts="N"
          className="mb-4 flex min-h-11 w-full shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue px-4 text-[0.9375rem] font-semibold text-white shadow-[0_1px_2px_rgb(0_0_0_/_0.12)] transition-colors hover:bg-action-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue"
        >
          <Icon className="h-4 w-4 shrink-0"><path d="M12 5v14M5 12h14" /></Icon>
          New task
          {!compact && <kbd aria-hidden="true" className="ml-1 rounded-md border border-current px-1.5 font-sans text-[0.6875rem] font-semibold leading-4 opacity-75">N</kbd>}
        </button>
      )}

      <nav aria-label="Main navigation" className={compact ? "grid grid-cols-2 gap-1" : "shrink-0 space-y-0.5"}>
        {navigation.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={stayOrGo(item.path)}
            className={({ isActive }) => `${rowBase} min-h-11 ${isActive ? "bg-nav-active font-semibold" : ""}`}
          >
            <Icon>{item.icon}</Icon>
            <span className="min-w-0 flex-1 truncate">{item.name}</span>
            {item.count > 0 && <span className="text-xs text-gray">{item.count}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="mt-5 flex items-center justify-between px-3">
        <p className="text-sm font-medium text-gray">Spaces</p>
        <button
          type="button"
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-gray hover:bg-nav-active hover:text-dark-blue"
          onClick={() => {
            if (onAddSpace) onAddSpace();
            else navigate("/spaces/new");
            onNavigate?.();
          }}
          aria-label="Add space"
        >
          <Icon className="h-4 w-4"><path d="M12 5v14M5 12h14" /></Icon>
        </button>
      </div>

      <ul className={compact ? "mt-1 grid grid-cols-2 gap-1 sm:grid-cols-3" : "mt-1 min-h-0 flex-1 space-y-0.5 overflow-y-auto"}>
        {spaces.map((space) => {
          const count = open.filter((task) => task.spaceId === space.id).length;
          return (
            <li key={space.id} className={`group relative flex min-w-0 items-center rounded-xl hover:bg-nav-active ${location.pathname === `/spaces/${space.id}` ? "bg-nav-active font-semibold" : ""}`}>
              <NavLink
                to={"/spaces/" + space.id}
                onClick={stayOrGo(`/spaces/${space.id}`)}
                className="flex min-h-10 min-w-0 flex-1 items-center gap-3 rounded-xl px-3 text-left text-[0.9375rem] focus-visible:outline-2 focus-visible:outline-blue"
              >
                <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: space.color }} />
                <span className="min-w-0 flex-1 truncate" title={space.name}>{space.name}</span>
                {count > 0 && <span className="text-xs font-normal text-gray group-focus-within:invisible group-hover:invisible">{count}</span>}
              </NavLink>

              {/* Edit and delete stay out of the way until the row is hovered or focused. */}
              {!compact && (
                <span className="absolute inset-y-0 right-1 flex items-center opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
                  <button type="button" onClick={() => setEditId(space.id)} aria-label={`Edit ${space.name} space`} title={`Edit ${space.name}`} className="flex h-8 w-7 cursor-pointer items-center justify-center rounded-lg text-gray hover:text-link focus-visible:outline-blue">
                    <Icon className="h-3.5 w-3.5"><path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15v5Z" /></Icon>
                  </button>
                  <button type="button" onClick={() => setDeleteId(space.id)} aria-label={`Delete ${space.name} space`} title={`Delete ${space.name}`} className="flex h-8 w-7 cursor-pointer items-center justify-center rounded-lg text-gray hover:text-red focus-visible:outline-blue">
                    <Icon className="h-3.5 w-3.5">{icons.bin}</Icon>
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ul>

      <div className={`mt-3 shrink-0 space-y-0.5 border-t border-dark-blue/10 pt-3 ${compact ? "grid grid-cols-2 gap-1 space-y-0" : ""}`}>
        <button type="button" onClick={() => { onNavigate?.(); onProgress?.(); }} className={`${rowBase} min-h-10 cursor-pointer`}>
          <Icon>{icons.progress}</Icon>
          <span>Progress</span>
        </button>
        <NavLink to="/bin" onClick={stayOrGo("/bin")} className={({ isActive }) => `${rowBase} min-h-10 ${isActive ? "bg-nav-active font-semibold" : ""}`}>
          <Icon>{icons.bin}</Icon>
          <span className="min-w-0 flex-1">Bin</span>
          {trash.length > 0 && <span className="text-xs text-gray">{trash.length}</span>}
        </NavLink>
      </div>

      {!compact && (
        <div className="mt-2 flex shrink-0 items-center gap-2">
          <ProfileMenu variant="sidebar" />
          <ThemeControl compact />
        </div>
      )}

      {editingSpace && <EditSpaceDialog space={editingSpace} onCancel={() => setEditId(null)} onSaved={() => setEditId(null)} />}

      {selectedSpace && (
        <DeleteSpaceDialog
          space={selectedSpace}
          onCancel={() => setDeleteId(null)}
          onDeleted={() => {
            if (location.pathname === `/spaces/${selectedSpace.id}`) navigate("/tasks", { replace: true });
            setDeleteId(null);
          }}
        />
      )}
    </aside>
  );
}
