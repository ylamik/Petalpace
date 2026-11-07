import TaskRows from '../features/tasks/components/TaskRows'
import { useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router'
import { useSpaces } from '../features/spaces/spaces'
import AddTaskDialog from '../features/tasks/components/AddTaskDialog'
import TaskDetailsPanel from '../features/tasks/components/TaskDetailsPanel'
import EditSpaceDialog from '../features/spaces/EditSpaceDialog'
import DeleteSpaceDialog from '../features/spaces/DeleteSpaceDialog'

export default function SpacePage() {
  const { spaceId } = useParams()
  return <SpaceContent key={spaceId} spaceId={spaceId ?? ''} />
}

function SpaceContent({ spaceId }: { spaceId: string }) {
  const { spaces, tasks, setTasks, notify: setNotice } = useSpaces()
  const navigate = useNavigate()
  const space = spaces.find((item) => item.id === spaceId)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = tasks.find((task) => task.id === selectedId)
  const pinCount = tasks.filter((task) => task.pinned).length

  if (!space) return (
    <div>
      <h1 className="text-3xl font-bold">Space not found</h1>
      <Link to="/spaces/new" className="mt-4 inline-block text-link underline hover:decoration-2">
        Create a space
      </Link>
    </div>
  )

  return (
    <div>
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="h-14 w-14 shrink-0 rounded-full border border-dark-blue/10"
            style={{ backgroundColor: space.color }}
          />
          <div className="min-w-0">
            <h1 className="break-words text-3xl font-bold">{space.name}</h1>
            <p className="text-lg text-gray">
              Your {space.name.toLowerCase()} tasks, together
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Edit space button */}
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={`Edit ${space.name} space`}
            title="Edit space name and color"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-dark-blue/20 bg-surface px-3 py-2 text-sm font-medium text-dark-blue hover:bg-lightest-blue/40 focus-visible:outline-blue"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4 shrink-0"
            >
              <path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15v5Z" />
            </svg>
            Edit space
          </button>

          {/* Delete space — visible on every screen, including phones and iPads */}
          <button
            type="button"
            onClick={() => setDeleting(true)}
            aria-label={`Delete ${space.name} space`}
            title="Delete this space"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-red/30 bg-surface px-3 py-2 text-sm font-medium text-red hover:bg-light-red/30 focus-visible:outline-blue"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>
            <span className="hidden sm:inline">Delete space</span>
          </button>

          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-lg bg-blue px-4 py-2 font-semibold text-white hover:bg-action-hover"
          >
            + Add task
          </button>
        </div>
      </header>

      {/* Task list */}
      <section
        aria-label={`${space.name} tasks`}
        className="relative mt-8 min-h-[400px] rounded-lg border border-dark-blue/20 bg-surface p-4 shadow-[0_3px_3px_rgb(0_0_0_/_0.22)] sm:p-6"
      >
        <img
          src="/images/orange-doodle.png"
          alt=""
          className="pointer-events-none absolute top-3 right-3 h-8 w-8 object-contain"
        />
        <TaskRows
          onDeleteMany={(ids) =>
            setTasks((current) => current.filter((task) => !ids.includes(task.id)))
          }
          onAdd={() => setAdding(true)}
          tasks={tasks.filter((task) => task.spaceId === spaceId)}
          onOpen={(task) => setSelectedId(task.id)}
          onStatus={(task, state) =>
            setTasks((current) =>
              current.map((item) =>
                item.id === task.id ? { ...item, ...state } : item,
              ),
            )
          }
          onPin={(task) => {
            if (!task.pinned && pinCount >= 3) {
              setNotice('Unpin a task before adding another to your top three.')
              return
            }
            setNotice('')
            setTasks((current) =>
              current.map((item) =>
                item.id === task.id ? { ...item, pinned: !item.pinned } : item,
              ),
            )
          }}
        />
      </section>

      {/* Dialogs */}
      {adding && (
        <AddTaskDialog
          initialTitle=""
          defaultSpace={space.name}
          spaceOptions={spaces.map((item) => item.name)}
          canPin={pinCount < 3}
          onClose={() => setAdding(false)}
          onCreate={(draft) => {
            const target = spaces.find((item) => item.name === draft.space)
            if (target)
              setTasks((current) => [
                ...current,
                {
                  ...draft,
                  id: crypto.randomUUID(),
                  spaceId: target.id,
                  done: draft.done ?? false,
                  completedSteps: [],
                },
              ])
          }}
        />
      )}

      {editing && (
        <EditSpaceDialog
          space={space}
          onCancel={() => setEditing(false)}
          onSaved={(updated) => {
            setEditing(false)
            setNotice(`Space renamed to "${updated.name}".`)
            // If the URL space name changed, no redirect needed — we use ID-based routing
            navigate(`/spaces/${updated.id}`, { replace: true })
          }}
        />
      )}

      {deleting && (
        <DeleteSpaceDialog
          space={space}
          onCancel={() => setDeleting(false)}
          onDeleted={() => {
            setDeleting(false)
            navigate('/tasks', { replace: true })
          }}
        />
      )}

      {selected && (
        <TaskDetailsPanel
          key={selected.id}
          task={selected}
          spaceOptions={spaces.map((item) => item.name)}
          onClose={() => setSelectedId(null)}
          onDelete={() => {
            setTasks((current) =>
              current.filter((task) => task.id !== selected.id),
            )
            setSelectedId(null)
          }}
          onChange={(changes) =>
            setTasks((current) =>
              current.map((task) =>
                task.id === selected.id
                  ? {
                      ...task,
                      ...changes,
                      spaceId: changes.space
                        ? spaces.find((item) => item.name === changes.space)
                            ?.id ?? task.spaceId
                        : task.spaceId,
                    }
                  : task,
              ),
            )
          }
        />
      )}
    </div>
  )
}
