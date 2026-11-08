import { taskDaysUntil } from '../features/tasks/components/taskPresentation'
import { usePlannerClock } from '../hooks/usePlannerClock'
import StepsCount from "../features/tasks/components/StepsCount";
import { clickableCard, openFromCard } from "../features/tasks/components/cardClick";
import DeadlineLabel from '../features/tasks/components/DeadlineLabel';
import { useSpaces, type SpaceTask as Task } from "../features/spaces/spaces";
import { compareTasks, effectiveDue, isDeadlineOverdue } from "../features/tasks/components/taskPresentation";
import ActivityHeatmap from "../features/tasks/components/ActivityHeatmap";
import TaskRows from "../features/tasks/components/TaskRows";
import TaskSpaceBadge from "../features/tasks/components/TaskSpaceBadge";
import { useState } from "react";
import { Link } from "react-router";
import AddTaskDialog, {
  type TaskDraft,
} from "../features/tasks/components/AddTaskDialog";
import ProgressDialog from "../features/tasks/components/ProgressDialog";
import TaskDetailsPanel from "../features/tasks/components/TaskDetailsPanel";

const priorityColors = {
  High: "bg-light-red text-red",
  Medium: "bg-light-orange text-orange",
  Low: "bg-light-gray text-gray",
};

const cardShadow =
  "rounded-lg border border-dark-blue/15 shadow-[0_2px_3px_rgba(0,0,0,0.22)]";

function taskStatus(task: Task) {
  return task.done
    ? "done"
    : task.blocked
      ? "blocked"
      : task.started
        ? "progress"
        : "active";
}

const statusBadges = {
  blocked: { label: "Blocked", color: "bg-light-orange text-orange" },
  active: { label: "To do", color: "bg-light-gray/60 text-gray" },
  progress: { label: "In progress", color: "bg-lightest-blue text-dark-blue" },
  done: { label: "Completed", color: "bg-light-green text-done-ink" },
};

function TaskBadges({ task }: { task: Task }) {
  const badge = statusBadges[taskStatus(task)];
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm">
      <TaskSpaceBadge name={task.space} />

      {!task.done && (
        <span
          className={`rounded-full px-2 py-0.5 ${priorityColors[task.priority]}`}
        >
          <span aria-hidden="true">⚑ </span>
          {task.priority}
        </span>
      )}
      <span className={`rounded-full px-2 py-0.5 ${badge.color}`}>
        {badge.label}
      </span>
    </div>
  );
}

export default function TodayPage() {
  const { tasks: allTasks, spaces, setTasks, notify: setNotice } = useSpaces();
  const clock = usePlannerClock();

  // Today shows: tasks due today (any status), overdue unfinished tasks,
  // and undated unfinished tasks.  Completed tasks that aren't due today,
  // pinned future tasks, and future tasks are excluded from this list.
  const tasks = allTasks.filter(
    (task) =>
      taskDaysUntil(task,clock) === 0 ||
      (!task.done && (!task.dueDate || (taskDaysUntil(task,clock) ?? 1) < 0)),
  );
  const upcoming = allTasks
    .filter((task) => !task.done && (taskDaysUntil(task,clock) ?? -1) > 0)
    .sort((a, b) => compareTasks(a,b,'nearest'))
    .slice(0, 3);
  const [newTask, setNewTask] = useState("");

  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const selectedTask = allTasks.find((task) => task.id === selectedTaskId);

  const topTasks = allTasks.filter((task) => task.pinned && !task.done);

  const today = new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(clock);

  function createTask(draft: TaskDraft) {
    const now = new Date();
    const todayKey = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");
    setTasks((current) => [
      ...current,
      {
        ...draft,
        id: crypto.randomUUID(),
        spaceId: "",
        completedSteps: [],
        done: draft.done ?? false,
        dueToday: draft.dueDate === todayKey,
      },
    ]);

    setNewTask("");
  }

  function togglePin(task: Task) {
    if (!task.pinned && topTasks.length >= 3) {
      setNotice("Unpin one task before adding another to your top three.");
      return;
    }

    setTasks((current) =>
      current.map((item) =>
        item.id === task.id ? { ...item, pinned: !item.pinned } : item,
      ),
    );

    setNotice(task.pinned ? "Task unpinned." : "Added to your top three.");
  }

  return (
    <div className="text-dark-blue">
      {/* Greeting */}
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="relative inline-block max-w-full pr-10 sm:pr-6">
            <h1 className="text-2xl font-bold leading-tight xl:text-3xl">
              Make room for what{" "}
              {/* The underline is tied to "matters", so it stays under that word when the title wraps on small screens. */}
              <span className="relative inline-block whitespace-nowrap">
                matters
                <img
                  src="/images/yellow-line.png"
                  alt=""
                  aria-hidden="true"
                  className="pointer-events-none absolute -bottom-4 -left-1 h-6 w-[calc(100%+0.75rem)] max-w-none object-fill"
                />
              </span>{" "}
              to you.
            </h1>

            <img
              src="/images/yellow-doodle.png"
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute -top-6 right-0 h-10 w-12 object-contain sm:-right-9 sm:-top-8 sm:h-15 sm:w-25"
            />

          </div>

          <div className="mt-4 flex items-center gap-3">
            <p className="text-base text-gray">{today}</p>

            <img
              src="/images/petal.png"
              alt=""
              aria-hidden="true"
              className="relative -top-1 -left-1 h-5 w-8 object-contain"
            />
          </div>
        </div>
      </header>

      {/* Quick add */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setAddTaskOpen(true);
        }}
        className="mt-6 flex items-center gap-2 rounded-lg border border-dark-blue/25 p-2"
      >
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-light-gray text-2xl text-gray"
        >
          +
        </span>

        <label htmlFor="today-new-task" className="sr-only">
          New task
        </label>

        <input
          id="today-new-task"
          value={newTask}
          onChange={(event) => setNewTask(event.target.value)}
          placeholder="What do you need to finish?"
          maxLength={160}
          className="min-h-9 min-w-0 flex-1 rounded px-1 text-base placeholder:text-gray focus-visible:outline-blue"
        />

        <button
          type="submit"
          className="min-h-9 shrink-0 rounded-md bg-blue px-3 py-1 font-semibold text-white hover:bg-action-hover sm:px-4"
        >
          + <span className="hidden sm:inline">Add </span>task
        </button>
      </form>

      {/* My top three */}
      <section aria-labelledby="top-three-title" className="mt-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex shrink-0 items-center gap-2">
            <h2 id="top-three-title" className="whitespace-nowrap text-xl font-bold">
              My top 3
            </h2>
            <img
              src="/images/yellow-stars.png"
              alt=""
              className="h-8 w-8 object-contain sm:h-10 sm:w-10"
            />
          </div>

          <p className="flex min-w-0 items-center gap-1.5 font-story text-sm italic text-gray">
            <img src="/images/star.png" alt="" aria-hidden="true" className="h-5 w-5 shrink-0 object-contain" />
            <span>Focus on what matters</span>
          </p>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          {topTasks.map((task, index) => (
            <article
              key={task.id}
              onClick={(event) => openFromCard(event, () => setSelectedTaskId(task.id))}
              className={`${cardShadow} ${clickableCard} min-w-0 p-3 ${
                ["bg-light-pink", "bg-light-yellow", "bg-light-green"][index]
              }`}
            >
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <h3
                    className={`break-words text-base lg:text-lg font-semibold ${
                      task.done ? "text-gray line-through" : ""
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedTaskId(task.id)}
                      aria-haspopup="dialog"
                      title={task.title}
                      className="block w-full cursor-pointer truncate text-left group-hover:underline focus-visible:outline-blue"
                    >
                      {task.title}
                    </button>
                  </h3>

                  <TaskBadges task={task} />
                  {!task.done && isDeadlineOverdue(task) && <span className="mt-2 inline-block rounded-full border border-red/30 bg-light-red px-2 py-1 text-xs font-medium text-red">Deadline missed</span>}
                  <div className="mt-2"><DeadlineLabel task={task}/></div>

                  {!!task.steps?.length && (
                    <p className="mt-2">
                      <StepsCount total={task.steps.length} done={(task.completedSteps ?? []).filter((i) => i >= 0 && i < task.steps!.length).length} />
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => togglePin(task)}
                  aria-label={`Unpin ${task.title}`}
                  aria-pressed={task.pinned}
                  className="shrink-0 rounded px-1 text-lg text-star transition-transform hover:scale-110"
                >
                  ★
                </button>
              </div>
            </article>
          ))}
        </div>

        {topTasks.length === 0 && (
          <p className="mt-3 text-sm text-gray">
            Star a task below to add it here.
          </p>
        )}
      </section>

      {/* Task list and right column */}
      <div className="mt-5 grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <section
          aria-labelledby="today-title"
          className={`${cardShadow} min-w-0 bg-surface p-4`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img
                src="/images/flower.png"
                alt=""
                className="h-6 w-6 object-contain"
              />

              <h2 id="today-title" className="text-2xl font-bold">
                Today
              </h2>
            </div>

            <span className="text-xs text-gray">{tasks.length} {tasks.length === 1 ? "task" : "tasks"}</span>
          </div>

          <TaskRows
            onDeleteMany={ids=>setTasks(current=>current.filter(task=>!ids.includes(task.id)))}
            today
            onAdd={() => setAddTaskOpen(true)}
            tasks={tasks}
            onOpen={(task) => setSelectedTaskId(task.id)}
            onPin={togglePin}
            onStatus={(task, state) =>
              setTasks((current) =>
                current.map((item) =>
                  item.id === task.id ? { ...item, ...state } : item,
                ),
              )
            }
          />
        </section>

        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-1">
          {/* Progress heatmap */}
          <section
            aria-labelledby="progress-title"
            className={`${cardShadow} bg-surface p-4`}
          >
            <div className="flex items-center gap-2">
              <h2 id="progress-title" className="text-xl font-bold">
                Your progress
              </h2>
              <img
                src="/images/yellow-star.png"
                alt=""
                className="h-6 w-10 -ml-3 object-contain"
              />
            </div>

            <ActivityHeatmap compact />
            <button
              type="button"
              onClick={() => setProgressOpen(true)}
              className="mt-3 text-sm text-link underline hover:decoration-2"
            >
              View activity
            </button>
            <div className="mt-6 px-3 pb-4 text-center">
              <p className="relative mx-auto w-fit max-w-full font-story text-lg italic text-gray">
                One step at a{' '}
                <span className="relative inline-block whitespace-nowrap">
                  time.
                  <img src="/images/thin-doodle%20(1).png" alt="" aria-hidden="true" className="pointer-events-none absolute -right-4 -top-4 h-6 w-6 object-contain" />
                </span>
                <img src="/images/yellow-line.png" alt="" aria-hidden="true" className="pointer-events-none absolute -bottom-2 right-0 h-3 w-3/5 object-fill" />
              </p>
            </div>
          </section>

          {/* Upcoming */}
          <section
            aria-labelledby="upcoming-title"
            className="rounded-2xl border border-dark-blue/15 bg-surface p-5 shadow-[0_2px_3px_rgba(0,0,0,0.22)]"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 id="upcoming-title" className="text-xl font-bold">
                Upcoming
              </h2>

              <Link to="/planner" className="text-sm font-semibold text-link hover:underline">
                See all →
              </Link>
            </div>

            {!upcoming.length && (
              <p className="mt-3 text-sm text-gray">
                No upcoming deadlines. A little room to breathe.
              </p>
            )}
            <ul className="mt-3 space-y-1">
              {upcoming.map((task) => {
                const due = new Date(`${effectiveDue(task)}T12:00:00`);
                const color = spaces.find((space) => space.id === task.spaceId || space.name === task.space)?.color;
                return (
                  <li key={task.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedTaskId(task.id)}
                      aria-haspopup="dialog"
                      className="group flex w-full cursor-pointer items-center gap-3 rounded-xl p-1.5 text-left hover:bg-beige/60 focus-visible:outline-2 focus-visible:outline-blue"
                    >
                      <span className="flex h-12 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-beige">
                        <span className="text-[0.6875rem] font-semibold leading-tight tracking-wide text-gray">
                          {due.toLocaleDateString("en", { weekday: "short" }).toUpperCase()}
                        </span>
                        <span className="font-serif text-lg font-semibold leading-tight">{due.getDate()}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.9375rem] font-medium group-hover:underline" title={task.title}>{task.title}</span>
                        <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-sm text-gray">
                          <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                          <span className="truncate">{task.space}</span>
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </div>

      {addTaskOpen && (
        <AddTaskDialog
          initialTitle={newTask}
          canPin={topTasks.length < 3}
          onClose={() => setAddTaskOpen(false)}
          onCreate={createTask}
        />
      )}
      {progressOpen && (
        <ProgressDialog onClose={() => setProgressOpen(false)} />
      )}
      {selectedTask && (
        <TaskDetailsPanel
          key={selectedTask.id}
          task={selectedTask}
          onClose={() => setSelectedTaskId(null)}
          onChange={(changes) =>
            setTasks((current) =>
              current.map((task) =>
                task.id === selectedTask.id ? { ...task, ...changes } : task,
              ),
            )
          }
          onDelete={() => {
            setTasks((current) =>
              current.filter((task) => task.id !== selectedTask.id),
            );
            setSelectedTaskId(null);
            setNotice("Task deleted.");
          }}
        />
      )}
    </div>
  );
}
