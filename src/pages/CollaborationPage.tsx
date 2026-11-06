import TimePicker from "../features/tasks/components/TimePicker";
import { usePlannerSync } from "../hooks/usePlannerSync";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { collabApi, type CollabTask } from "../features/collab/collab";
import PageLoader from "../components/ui/PageLoader";
import { useAuth } from "../features/auth/auth";

const palette = [
  "#BCDCF1",
  "#EBC39C",
  "#D0BEFF",
  "#F9DEA4",
  "#BFD2C8",
  "#FFACB3",
  "#D7E7FD",
  "#FDDCCD",
  "#D6DDC9",
  "#FDE8A8",
  "#C8DEFF",
  "#FFD6D6",
];

const statusLabel: Record<string, string> = {
  todo: "To do",
  progress: "In progress",
  done: "Done",
  blocked: "Blocked",
};
const avatarColors = ["#B97A82", "#7488AE", "#7D9A7F", "#A3856A", "#9884B3", "#B8925A"];
const avatarColor = (id: string) => avatarColors[[...id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % avatarColors.length];
const initials = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? "") + (words.length > 1 ? words.at(-1)![0] : (words[0]?.[1] ?? ""))).toUpperCase() || "?";
};

function MemberAvatars({ members }: { members: CollabTask["members"] }) {
  return (
    <div className="flex -space-x-1.5">
      {members.slice(0, 4).map((m) => (
        <span
          key={m.id}
          title={m.name}
          className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border-2 border-surface text-[0.6875rem] font-semibold text-white"
          style={{ backgroundColor: avatarColor(m.id) }}
        >
          {m.photoUrl ? <img src={m.photoUrl} alt="" className="h-full w-full object-cover" /> : initials(m.name)}
        </span>
      ))}
      {members.length > 4 && (
        <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface bg-light-gray text-[0.625rem] font-semibold text-gray">
          +{members.length - 4}
        </span>
      )}
    </div>
  );
}

function CreateTaskDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (t: CollabTask) => void;
}) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [color, setColor] = useState(palette[0]);
  const [custom, setCustom] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const focus = document.activeElement as HTMLElement;
    dialog.current?.showModal();
    return () => focus?.focus();
  }, []);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Enter a task title.");
      return;
    }
    const chosen = (custom.trim() || color).toLowerCase();
    if (!/^#[0-9a-f]{6}$/.test(chosen)) {
      setError("Use a valid hex color.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { task } = await collabApi.create({
        title: title.trim(),
        priority,
        dueDate,
        dueTime: dueDate ? dueTime : "",
        dueZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        color: chosen,
      });
      onCreate(task);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create task.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      aria-label="New shared task"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      className="m-auto w-[calc(100%_-_2rem)] max-w-[480px] max-h-[90dvh] overflow-y-auto rounded-2xl bg-surface p-0 backdrop:bg-black/30"
    >
      <div className="w-full max-w-[480px] rounded-2xl border border-dark-blue/15 bg-surface p-6 shadow-2xl font-sans text-dark-blue">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold">New shared task</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="h-9 w-9 rounded-lg text-xl hover:bg-beige"
          >
            ×
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm font-medium">
            Title
            <input
              autoFocus
              required
              maxLength={160}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to get done?"
              className="mt-1.5 block min-h-11 w-full rounded-lg border border-dark-blue/20 bg-surface px-3 text-base focus-visible:outline-blue"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium">
              Priority
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="mt-1.5 min-h-11 w-full rounded-lg border border-dark-blue/20 bg-surface px-3 text-base focus-visible:outline-blue"
              >
                {["High", "Medium", "Low"].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium">
              Due date
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mt-1.5 min-h-11 w-full rounded-lg border border-dark-blue/20 bg-surface px-3 text-base focus-visible:outline-blue"
              />
            </label>
          </div>
          <TimePicker
            value={dueTime}
            onChange={setDueTime}
            disabled={!dueDate}
          />
          <fieldset className="border-0 p-0">
            <legend className="text-sm font-medium">Color</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {palette.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-label={s}
                  aria-pressed={!custom && color === s}
                  onClick={() => {
                    setColor(s);
                    setCustom("");
                  }}
                  style={{ backgroundColor: s }}
                  className={`h-8 w-8 rounded-full border-2 border-white ${!custom && color === s ? "ring-2 ring-blue ring-offset-1" : ""}`}
                />
              ))}
              <label
                className="relative h-8 w-8 overflow-hidden rounded-full border border-dark-blue/20"
                style={{
                  backgroundColor: /^#[0-9a-f]{6}$/i.test(custom)
                    ? custom
                    : color,
                }}
              >
                <span className="sr-only">Custom color</span>
                <input
                  type="color"
                  value={/^#[0-9a-f]{6}$/i.test(custom) ? custom : color}
                  onChange={(e) => setCustom(e.target.value)}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
              </label>
            </div>
          </fieldset>
          {error && (
            <p role="alert" className="text-sm text-red">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 rounded-lg border border-blue px-5 text-sm font-semibold text-link hover:bg-lightest-blue/30"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="min-h-11 rounded-lg bg-blue px-5 text-sm font-semibold text-white hover:bg-action-hover disabled:opacity-70"
            >
              {busy ? "Creating…" : "Create task"}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}

export default function CollaborationPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<CollabTask[] | null>(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    collabApi
      .list()
      .then((r) => setTasks(r.tasks))
      .catch((e) => setError(e.message));
  }, []);

  usePlannerSync(user?.id, () => {
    collabApi
      .list()
      .then((r) => setTasks(r.tasks))
      .catch((e) => setError(e.message));
  });

  if (!tasks && !error) return <PageLoader label="Loading collaboration…" />;

  const owned = tasks?.filter((t) => t.ownerId === user?.id) ?? [];
  const joined = tasks?.filter((t) => t.ownerId !== user?.id) ?? [];

  return (
    <div className="text-dark-blue">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold sm:text-[34px]">Shared</h1>
          <p className="mt-0.5 font-serif text-lg text-gray">
            Shared tasks between you and your team
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="mt-1 min-h-11 rounded-xl bg-blue px-4 text-[0.9375rem] font-semibold text-white hover:bg-action-hover"
          >
            + New shared task
          </button>
        </div>
      </header>

      {error && (
        <p role="alert" className="mt-6 text-sm text-red">
          {error}
        </p>
      )}

      {tasks?.length === 0 && (
        <div className="mt-10 rounded-xl border border-dashed border-dark-blue/20 bg-beige/25 px-6 py-14 text-center">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mx-auto mb-4 h-12 w-12 text-gray/60"
          >
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <h2 className="text-xl font-semibold">No shared tasks yet</h2>
          <p className="mt-2 max-w-sm mx-auto text-base text-gray">
            Create a shared task and invite teammates by email. They'll need a
            Petalpace account to join.
          </p>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="mt-5 min-h-11 rounded-lg bg-blue px-5 py-2 font-semibold text-white hover:bg-action-hover"
          >
            Create your first shared task
          </button>
        </div>
      )}

      {owned.length > 0 && (
        <section className="mt-8" aria-labelledby="owned-title">
          <h2 id="owned-title" className="mb-3 font-sans text-[0.9375rem] font-semibold text-gray">
            Created by you
          </h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {owned.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onClick={() => navigate(`/collaboration/${task.id}`)}
              />
            ))}
          </div>
        </section>
      )}

      {joined.length > 0 && (
        <section className="mt-8" aria-labelledby="joined-title">
          <h2 id="joined-title" className="mb-3 font-sans text-[0.9375rem] font-semibold text-gray">
            Shared with you
          </h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {joined.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                sharedBy={task.members.find((m) => m.role === "owner")?.name}
                onClick={() => navigate(`/collaboration/${task.id}`)}
              />
            ))}
          </div>
        </section>
      )}

      {creating && (
        <CreateTaskDialog
          onClose={() => setCreating(false)}
          onCreate={(t) => {
            setTasks((prev) => [t, ...(prev ?? [])]);
            setCreating(false);
            navigate(`/collaboration/${t.id}`);
          }}
        />
      )}
    </div>
  );
}

function TaskCard({
  task,
  sharedBy,
  onClick,
}: {
  task: CollabTask;
  sharedBy?: string;
  onClick: () => void;
}) {
  const total = task.subtasks.length;
  const done = task.subtasks.filter((step) => step.done).length;
  const percent = total ? Math.round((done / total) * 100) : 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full min-w-0 flex-col rounded-2xl border border-dark-blue/10 bg-surface p-5 text-left transition-shadow hover:shadow-[0_6px_20px_rgb(0_0_0_/_0.08)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue"
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: task.color }} />
        <span className="min-w-0 truncate font-serif text-lg font-semibold group-hover:underline" title={task.title}>{task.title}</span>
      </span>
      <span className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-gray">
        <span>{statusLabel[task.status]}</span>
        <span className={task.priority === "High" ? "text-red" : ""}>{task.priority}</span>
        {task.dueDate && (
          <span>
            Due {new Date(`${task.dueDate}T12:00:00`).toLocaleDateString("en", { month: "short", day: "numeric" })}
          </span>
        )}
      </span>
      <span
        role="progressbar"
        aria-label={`${done} of ${total} steps done`}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        className="mt-4 block h-1.5 overflow-hidden rounded-full bg-beige"
      >
        <span className="block h-full rounded-full bg-done-stroke" style={{ width: `${percent}%` }} />
      </span>
      <span className="mt-4 flex items-center justify-between gap-2">
        <MemberAvatars members={task.members} />
        <span className="text-sm text-gray">{total ? `${done} of ${total} steps` : "No steps yet"}</span>
      </span>
      {sharedBy && <span className="mt-3 text-sm text-gray">Shared by {sharedBy}</span>}
    </button>
  );
}
