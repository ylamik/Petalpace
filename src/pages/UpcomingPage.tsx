import { usePlannerClock } from '../hooks/usePlannerClock'
import ConfirmTaskDialog from "../features/tasks/components/ConfirmTaskDialog";
import { Link } from "react-router";
import TaskFilterBar from "../features/tasks/components/TaskFilters";
import { applyTaskFilters, defaultTaskFilters, toolbarButton } from "../features/tasks/components/taskFilterValues";
import { useSpaces } from "../features/spaces/spaces";
import {
  compareTasks,
  groupTasksByDeadline,
  isDeadlineOverdue,
} from "../features/tasks/components/taskPresentation";
import { useState } from "react";
import type { SpaceTask as UpcomingTask } from "../features/spaces/spaces";
import TaskDetailsPanel from "../features/tasks/components/TaskDetailsPanel";
import { TaskRow } from "../features/tasks/components/TaskRows";

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function afterDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return dateKey(date);
}
export default function UpcomingPage() {
  const { spaces, tasks, setTasks, notify: setPinNotice } = useSpaces();
  const now = usePlannerClock();
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [missedOpen, setMissedOpen] = useState(true);
  const [completedOpen, setCompletedOpen] = useState(true);
  const [filters, setFilters] = useState(defaultTaskFilters);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = tasks.find((task) => task.id === selectedId);
  const pinnedCount = tasks.filter((task) => task.pinned).length;
  const remaining = tasks.filter(
    (task) => !task.done && !!task.dueDate && task.dueDate >= afterDays(0),
  );
  const inPlan = tasks.filter(
    (task) =>
      task.done ||
      task.dueDate > dateKey(now) ||
      isDeadlineOverdue(task, now),
  );
  const filtered = applyTaskFilters(inPlan, filters);
  const { active, missed, completed } = groupTasksByDeadline(filtered, now);
  const selectable = [
    ...active,
    ...(missedOpen ? missed : []),
    ...(completedOpen ? completed : []),
  ];
  const selectedShown = selectable.filter((task) =>
    selectedIds.includes(task.id),
  );
  const dates = [...new Set(active.map((task) => task.dueDate))].sort((a, b) =>
    !a || !b
      ? !a
        ? 1
        : -1
      : filters.sort === "farthest"
        ? b.localeCompare(a)
        : a.localeCompare(b),
  );

  function renderRow(task: UpcomingTask) {
    return (
      <TaskRow
        key={task.id}
        task={task}
        selected={selectedIds.includes(task.id)}
        onSelect={
          selecting
            ? () =>
                setSelectedIds((ids) =>
                  ids.includes(task.id)
                    ? ids.filter((id) => id !== task.id)
                    : [...ids, task.id],
                )
            : undefined
        }
        onOpen={(t) => setSelectedId(t.id)}
        onStatus={(t, state) =>
          setTasks((current) =>
            current.map((item) =>
              item.id === t.id ? { ...item, ...state } : item,
            ),
          )
        }
        onPin={(t) => {
          if (!t.pinned && pinnedCount >= 3) {
            setPinNotice(
              "Unpin a task before adding another to your top three.",
            );
            return;
          }
          setPinNotice("");
          setTasks((current) =>
            current.map((item) =>
              item.id === t.id ? { ...item, pinned: !item.pinned } : item,
            ),
          );
        }}
      />
    );
  }

  return (
    <div className="relative grid grid-cols-1 min-w-0 gap-7 text-dark-blue lg:grid-cols-[minmax(0,1fr)_210px] xl:grid-cols-[minmax(0,1fr)_240px]">
      <section className="min-w-0" aria-label="Upcoming tasks">
        <TaskFilterBar
          value={filters}
          onChange={setFilters}
          countMatches={(next) => applyTaskFilters(inPlan, next).length}
          searchLabel="Search upcoming tasks"
          actions={
            <button
              type="button"
              onClick={() => {
                setSelecting(!selecting);
                setSelectedIds([]);
              }}
              aria-pressed={selecting}
              className={toolbarButton}
            >
              {selecting ? "Cancel" : "Select"}
            </button>
          }
        />
        {selecting && (
          <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
            <label className="flex min-h-10 cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={
                  selectable.length > 0 &&
                  selectedShown.length === selectable.length
                }
                onChange={() =>
                  setSelectedIds(
                    selectedShown.length === selectable.length
                      ? []
                      : selectable.map((task) => task.id),
                  )
                }
                className="accent-blue"
              />
              Select all shown ({selectable.length})
            </label>
            <button
              type="button"
              disabled={!selectedShown.length}
              onClick={() => setDeleteOpen(true)}
              className="min-h-10 rounded-md bg-light-red px-3 text-red disabled:opacity-50 hover:bg-light-red/70"
            >
              Delete selected ({selectedShown.length})
            </button>
          </div>
        )}
        {deleteOpen && (
          <ConfirmTaskDialog
            title={`Delete ${selectedShown.length} selected ${selectedShown.length === 1 ? "task" : "tasks"}?`}
            message="You can undo this from the notification or restore these tasks from Recently deleted within 30 days."
            confirmLabel="Delete selected"
            cancelLabel="Cancel"
            onCancel={() => setDeleteOpen(false)}
            onConfirm={() => {
              const ids = selectedShown.map((task) => task.id);
              setTasks((current) =>
                current.filter((task) => !ids.includes(task.id)),
              );
              setDeleteOpen(false);
              setSelecting(false);
              setSelectedIds([]);
            }}
          />
        )}
        <div className="relative pb-5 before:absolute before:inset-y-0 before:left-[23px] before:w-0.5 before:bg-[#AEBCA6]">
          {dates.map((key, index) => {
            const date = key ? new Date(`${key}T12:00:00`) : null;
            const group = active
              .filter((task) => task.dueDate === key)
              .sort((a, b) => compareTasks(a, b, filters.sort));
            const label = !date
              ? "No due date"
              : key === afterDays(1)
                ? "Tomorrow"
                : key === afterDays(7)
                  ? "Next week"
                  : date.toLocaleDateString("en", { weekday: "long" });
            return (
              <section
                key={key}
                className="relative mb-7 pl-16 last:mb-0 sm:pl-[72px]"
              >
                <div className="absolute top-0 left-0 flex h-16 w-12 flex-col items-center justify-center rounded-lg bg-panel-green ring-4 ring-canvas">
                  <span className="text-[11px]">
                    {date
                      ?.toLocaleDateString("en", { month: "short" })
                      .toUpperCase() ?? "DATE"}
                  </span>
                  <span className="text-2xl leading-none">
                    {date ? String(date.getDate()).padStart(2, "0") : "—"}
                  </span>
                </div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold">{label}</h2>
                  <span className="text-xs text-gray">
                    {group.length} {group.length === 1 ? "task" : "tasks"}
                  </span>
                  {index === 1 && (
                    <img
                      src="/images/yellow-stars.png"
                      alt=""
                      className="ml-1 h-9 w-9 object-contain"
                    />
                  )}
                </div>
                <ul className="space-y-4">{group.map(renderRow)}</ul>
              </section>
            );
          })}
          {!dates.length && (
            <div className="ml-12 rounded-xl border border-dashed border-dark-blue/20 bg-beige/25 p-6 text-center">
              <h2 className="text-xl font-semibold">
                {tasks.length
                  ? "A little breathing room"
                  : "A little room to begin"}
              </h2>
              <p className="mt-2 text-base text-gray">
                {tasks.length
                  ? "No upcoming tasks match these filters."
                  : "Add your first task and give it a due date. Your plans will appear here."}
              </p>
              <Link
                to="/today"
                className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-blue px-4 py-2 font-semibold text-white hover:bg-action-hover"
              >
                Go to Today
              </Link>
            </div>
          )}
        </div>
        <details
          open={missedOpen}
          onToggle={(event) => setMissedOpen(event.currentTarget.open)}
          className="mt-5 border-t border-dark-blue/15 pt-4"
        >
          <summary className="cursor-pointer text-base font-semibold text-red hover:underline">
            Missed deadlines ({missed.length})
          </summary>
          {missed.length > 0 && (
            <p className="mt-2 text-sm text-gray">
              Still unfinished after their deadline. You can keep working,
              change the deadline, or mark them Done.
            </p>
          )}
          <ul className="mt-3 space-y-3">{missed.map(renderRow)}</ul>
          {!missed.length && (
            <p className="py-4 text-sm text-gray">
              No missed deadlines match your filters.
            </p>
          )}
        </details>
        <details
          open={completedOpen}
          onToggle={(event) => setCompletedOpen(event.currentTarget.open)}
          className="mt-5 border-t border-dark-blue/15 pt-4"
        >
          <summary className="cursor-pointer text-base font-semibold hover:underline">
            Completed ({completed.length})
          </summary>
          <ul className="mt-3 space-y-3">{completed.map(renderRow)}</ul>
          {!completed.length && (
            <p className="py-4 text-sm text-gray">
              Tasks marked Done will appear here.
            </p>
          )}
        </details>
      </section>
      <aside className="relative min-w-0 border-t border-dark-blue/15 pt-6 lg:border-t-0 lg:border-l lg:pl-4 lg:pt-0">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:block">
          <div className="paper-art relative">
            <img
              src="/images/doodle.png"
              alt=""
              className="pointer-events-none absolute -top-9 -left-4 h-12 w-12 object-contain"
            />
            <section className="relative min-h-[260px] overflow-hidden rounded-xl border-2 border-surface bg-panel-green px-4 pt-5 pb-24 shadow-[0_3px_3px_rgb(0_0_0_/_0.22)]">
              <h2 className="relative z-10 pr-8 text-[30px] font-bold leading-[1.08]">
                One day
                <br />
                at a time
              </h2>
              <img
                src="/images/sun.png"
                alt=""
                className="pointer-events-none absolute top-5 right-1 h-[76px] w-[76px] object-contain"
              />
              <p className="relative z-10 mt-7 max-w-40 text-base leading-snug text-gray">
                You don’t have to do everything today.
              </p>
              <img
                src="/images/design-3.png"
                alt=""
                className="pointer-events-none absolute bottom-0 left-0 h-20 w-full object-cover object-bottom"
              />
            </section>
          </div>
          <section
            className="relative z-10 lg:mt-5"
            aria-label="Upcoming tasks by space"
          >
            <h2 className="flex items-center gap-1 text-xl font-bold">
              {remaining.length} tasks ahead
              <img
                src="/images/pink-flower.png"
                alt=""
                className="h-6 w-6 object-contain"
              />
            </h2>
            <ul className="mt-3 space-y-5 px-2">
              {spaces.map((space) => (
                <li
                  key={space.id}
                  className="flex items-center gap-3 text-gray"
                >
                  <span
                    aria-hidden="true"
                    className="h-5 w-5 shrink-0 rounded-full border border-dark-blue/20"
                    style={{ backgroundColor: space.color }}
                  />
                  <span className="min-w-0 flex-1 truncate" title={space.name}>
                    {space.name}
                  </span>
                  <span>
                    {
                      remaining.filter((task) => task.space === space.name)
                        .length
                    }
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </aside>
      {selected && (
        <TaskDetailsPanel
          key={selected.id}
          task={selected}
          onClose={() => setSelectedId(null)}
          onChange={(changes) =>
            setTasks((current) =>
              current.map((task) =>
                task.id === selected.id ? { ...task, ...changes } : task,
              ),
            )
          }
          onDelete={() => {
            setTasks((current) =>
              current.filter((task) => task.id !== selected.id),
            );
            setSelectedId(null);
          }}
        />
      )}
    </div>
  );
}
