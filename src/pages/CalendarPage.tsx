import { usePlannerClock } from "../hooks/usePlannerClock";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useSpaces, type SpaceTask } from "../features/spaces/spaces";
import AddTaskDialog, {
  type TaskDraft,
} from "../features/tasks/components/AddTaskDialog";
import TaskDetailsPanel from "../features/tasks/components/TaskDetailsPanel";
import {
  deadlineText,
  getStatus,
} from "../features/tasks/components/taskPresentation";
import {
  dateKey,
  indexCalendarTasks,
  monthDates,
  moveCalendar,
  parseCalendarDate,
  weekDates,
} from "../features/tasks/calendarDates";

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const statusNames = {
  todo: "To do",
  progress: "In progress",
  done: "Done",
  blocked: "Blocked",
};
const control =
  "flex min-h-9 min-w-9 cursor-pointer items-center justify-center rounded-lg border border-dark-blue/15 bg-surface px-2.5 text-sm font-medium hover:bg-nav-active focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue disabled:cursor-not-allowed disabled:opacity-40";
const fullDate = (date: Date) =>
  date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
const timeOf = (task: SpaceTask) =>
  task.dueTime
    ? new Date(`2000-01-01T${task.dueTime}:00`).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })
    : "";

function WeekTask({
  task,
  color,
  onOpen,
}: {
  task: SpaceTask;
  color?: string;
  onOpen: () => void;
}) {
  const id = useId();
  const ref = useRef<HTMLButtonElement>(null);
  const [tooltip, setTooltip] = useState<{
    left: number;
    top: number;
    width: number;
  } | null>(null);
  function show() {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(280, window.innerWidth - 24);
    setTooltip({
      left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
      top: Math.max(12, Math.min(rect.bottom + 6, window.innerHeight - 190)),
      width,
    });
  }
  useEffect(() => {
    if (!tooltip) return;
    const close = () => setTooltip(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [tooltip]);
  const status = getStatus(task);
  const tint = task.done
    ? undefined
    : {
        backgroundColor: `color-mix(in srgb, ${color || "var(--color-blue)"} 24%, var(--color-surface))`,
      };
  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={() => {
          setTooltip(null);
          onOpen();
        }}
        onMouseEnter={show}
        onMouseLeave={() => setTooltip(null)}
        onFocus={show}
        onBlur={() => setTooltip(null)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setTooltip(null);
        }}
        aria-describedby={tooltip ? id : undefined}
        aria-label={`${task.title}. ${statusNames[status]}. ${deadlineText(task)}`}
        style={tint}
        className={`group block w-full min-w-0 cursor-pointer rounded-lg px-2.5 py-1.5 text-left text-sm leading-snug focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue ${task.done ? "bg-done-card text-done-ink line-through" : "hover:brightness-95"}`}
      >
        <span className="line-clamp-3 break-words group-hover:underline">{task.title}</span>
        {task.dueTime && (
          <span className="mt-0.5 block text-xs text-gray">{timeOf(task)}</span>
        )}
      </button>
      {tooltip &&
        createPortal(
          <div
            id={id}
            role="tooltip"
            className="pointer-events-none fixed z-50 rounded-lg border border-dark-blue/20 bg-surface p-3 font-sans text-sm text-dark-blue shadow-lg"
            style={tooltip}
          >
            <p className="break-words font-semibold">{task.title}</p>
            <p className="mt-1">
              {statusNames[status]} · {deadlineText(task)}
            </p>
            <p className="mt-1 break-words">{task.space}</p>
          </div>,
          document.body,
        )}
    </>
  );
}

export default function CalendarPage({
  view,
  tabs,
}: {
  view: "week" | "month";
  tabs: ReactNode;
}) {
  const { tasks, spaces, setTasks } = useSpaces();
  const now = usePlannerClock();
  const today = dateKey(now);
  const [anchor, setAnchor] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(today);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addingDate, setAddingDate] = useState<string | null>(null);
  const { byDate, undated } = useMemo(
    () =>
      indexCalendarTasks(
        tasks.map((task) => ({
          ...task,
          dueDate: task.dueDate || (task.dueToday ? today : ""),
        })),
      ),
    [tasks, today],
  );
  const selected = tasks.find((task) => task.id === selectedId);
  const pinCount = tasks.filter((task) => task.pinned).length;
  const colorOf = (task: SpaceTask) =>
    spaces.find(
      (space) => space.id === task.spaceId || space.name === task.space,
    )?.color;
  const dates = view === "week" ? weekDates(anchor) : monthDates(anchor);
  const previous = moveCalendar(anchor, view, -1),
    next = moveCalendar(anchor, view, 1);
  const short = (date: Date) =>
    date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const title =
    view === "week"
      ? `${short(dates[0])} – ${short(dates[6])}`
      : anchor.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  function saveTask(draft: TaskDraft) {
    setTasks((current) => [
      ...current,
      {
        ...draft,
        id: crypto.randomUUID(),
        spaceId: "",
        done: draft.done ?? false,
        completedSteps: [],
      },
    ]);
  }
  function goToday() {
    setAnchor(new Date());
    setSelectedDay(today);
  }
  // A quick preview of the day. Selecting a task opens its full details.
  function previewRow(task: SpaceTask) {
    return (
      <li key={task.id}>
        <button
          type="button"
          onClick={() => setSelectedId(task.id)}
          aria-haspopup="dialog"
          className="group flex min-h-12 w-full min-w-0 cursor-pointer items-center gap-3 px-4 py-2 text-left hover:bg-nav-active/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue"
        >
          <span
            aria-hidden="true"
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: colorOf(task) ?? "var(--color-blue)" }}
          />
          <span
            title={task.title}
            className={`min-w-0 flex-1 truncate font-serif text-base group-hover:underline ${task.done ? "text-gray line-through" : ""}`}
          >
            {task.title}
          </span>
          {task.dueTime && (
            <span className="shrink-0 text-sm text-gray">{timeOf(task)}</span>
          )}
          <span className="hidden max-w-32 shrink-0 truncate text-sm text-gray sm:block">
            {task.space}
          </span>
        </button>
      </li>
    );
  }

  function weekCell(date: Date) {
    const key = dateKey(date),
      list = byDate.get(key) ?? [];
    return (
      <section
        key={key}
        aria-label={`${fullDate(date)}, ${list.length} ${list.length === 1 ? "task" : "tasks"}`}
        aria-current={key === today ? "date" : undefined}
        className={`flex min-h-64 min-w-0 flex-col rounded-2xl border bg-surface p-3 ${key === today ? "border-blue" : "border-dark-blue/10"}`}
      >
        <p className="mb-2 flex items-baseline gap-1.5 px-1">
          <span className="text-sm text-gray">{weekdays[date.getDay()]}</span>
          <span
            className={`font-serif text-xl font-medium ${key === today ? "text-link" : ""}`}
          >
            {date.getDate()}
          </span>
        </p>
        <div className="min-h-0 flex-1 space-y-1.5">
          {list.map((task) => (
            <WeekTask
              key={task.id}
              task={task}
              color={colorOf(task)}
              onOpen={() => setSelectedId(task.id)}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => setAddingDate(key)}
          aria-label={`Add task due ${fullDate(date)}`}
          className="mt-2 min-h-9 w-full cursor-pointer rounded-lg border border-dashed border-dark-blue/15 text-sm text-gray hover:bg-nav-active hover:text-dark-blue focus-visible:outline-2 focus-visible:outline-blue"
        >
          + Add
        </button>
      </section>
    );
  }

  function monthCell(date: Date) {
    const key = dateKey(date),
      list = byDate.get(key) ?? [];
    const inMonth = date.getMonth() === anchor.getMonth(),
      valid = !!parseCalendarDate(key);
    return (
      <div
        key={key}
        className={`relative min-h-24 min-w-0 border-t border-r border-dark-blue/10 ${inMonth ? "bg-surface" : "bg-beige/50"} ${selectedDay === key ? "outline-2 -outline-offset-2 outline-blue" : ""}`}
      >
        <button
          type="button"
          disabled={!valid}
          onClick={() => setSelectedDay(key)}
          aria-pressed={selectedDay === key}
          aria-current={key === today ? "date" : undefined}
          aria-label={`${fullDate(date)}, ${list.length} ${list.length === 1 ? "task" : "tasks"}`}
          className="flex h-full min-h-24 w-full cursor-pointer flex-col items-start p-1.5 text-left hover:bg-nav-active/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue sm:p-2"
        >
          <span
            className={`flex h-7 min-w-7 items-center justify-center rounded-full text-[0.9375rem] font-semibold ${key === today ? "bg-blue text-white" : inMonth ? "" : "text-gray"}`}
          >
            {date.getDate()}
          </span>
          {list.length > 0 && (
            <span className="mt-1 flex flex-wrap gap-1 px-1">
              {list.slice(0, 4).map((task) => (
                <span
                  key={task.id}
                  aria-hidden="true"
                  className="h-2 w-2 rounded-full"
                  style={{
                    backgroundColor: task.done
                      ? "var(--color-gray)"
                      : (colorOf(task) ?? "var(--color-blue)"),
                  }}
                />
              ))}
            </span>
          )}
          {list.length > 0 && (
            <span className="mt-1 hidden px-1 text-xs text-gray sm:block">
              {list.length} {list.length === 1 ? "task" : "tasks"}
            </span>
          )}
        </button>
        <button
          type="button"
          disabled={!valid}
          onClick={() => setAddingDate(key)}
          aria-label={`Add task due ${fullDate(date)}`}
          className="absolute top-1 right-1 hidden h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-gray hover:bg-nav-active hover:text-dark-blue focus-visible:outline-2 focus-visible:outline-blue sm:flex"
        >
          +
        </button>
      </div>
    );
  }

  const pickedDate = parseCalendarDate(selectedDay) ?? now;
  const dayTasks = byDate.get(selectedDay) ?? [];
  const dayLabel = pickedDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="min-w-0">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        {tabs}
        <div className="flex flex-wrap items-center gap-2">
          <h2 aria-live="polite" className="mr-1 text-lg font-semibold">
            {title}
          </h2>
          <button
            type="button"
            disabled={!parseCalendarDate(dateKey(previous))}
            aria-label={`Previous ${view}`}
            onClick={() => setAnchor(previous)}
            className={control}
          >
            ‹
          </button>
          <button type="button" onClick={goToday} className={control}>
            Today
          </button>
          <button
            type="button"
            disabled={!parseCalendarDate(dateKey(next))}
            aria-label={`Next ${view}`}
            onClick={() => setAnchor(next)}
            className={control}
          >
            ›
          </button>
        </div>
      </div>

      {view === "week" && (
        <div
          className="grid gap-2.5"
          style={{ gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))" }}
        >
          {dates
            .filter((date) => parseCalendarDate(dateKey(date)))
            .map(weekCell)}
        </div>
      )}

      {view === "month" && (
        <>
          <div className="overflow-hidden rounded-2xl border border-dark-blue/10">
            <div className="grid grid-cols-7 bg-beige">
              {weekdays.map((day) => (
                <div
                  key={day}
                  className="px-2 py-2 text-sm font-semibold text-gray"
                >
                  {day}
                </div>
              ))}
            </div>
            <div className="-mr-px grid grid-cols-7">
              {dates.map(monthCell)}
            </div>
          </div>
          <section className="mt-6" aria-live="polite">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl font-bold">
                {selectedDay === today ? `Today · ${dayLabel}` : dayLabel}
              </h2>
              <button
                type="button"
                onClick={() => setAddingDate(selectedDay)}
                className="min-h-9 cursor-pointer rounded-lg px-1 text-sm font-semibold text-link hover:underline focus-visible:outline-2 focus-visible:outline-blue"
              >
                + Add task on this day
              </button>
            </div>
            {dayTasks.length ? (
              <ul className="divide-y divide-dark-blue/10 overflow-hidden rounded-2xl border border-dark-blue/10 bg-surface">
                {dayTasks.map(previewRow)}
              </ul>
            ) : (
              <p className="rounded-xl border border-dashed border-dark-blue/15 p-6 text-center text-gray">
                Nothing due on this day. A little room to breathe.
              </p>
            )}
          </section>
        </>
      )}

      {undated.length > 0 && (
        <details className="mt-6 rounded-2xl border border-dark-blue/10 bg-surface p-4">
          <summary className="cursor-pointer font-semibold">
            No due date ({undated.length})
          </summary>
          <p className="my-3 text-sm text-gray">
            Open a task and save a due date to place it on the calendar.
          </p>
          <ul className="-mx-4 -mb-4 min-w-0 divide-y divide-dark-blue/10 overflow-hidden rounded-b-2xl border-t border-dark-blue/10">
            {undated.map(previewRow)}
          </ul>
        </details>
      )}

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
      {addingDate !== null && (
        <AddTaskDialog
          initialTitle=""
          defaultDueDate={addingDate}
          canPin={pinCount < 3}
          onClose={() => setAddingDate(null)}
          onCreate={saveTask}
        />
      )}
    </div>
  );
}
