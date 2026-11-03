import { useSpaces } from '../features/spaces/spaces'
import ProfileMenu from '../components/auth/ProfileMenu'
import { useState } from 'react'
import AddTaskDialog, { type TaskDraft } from '../features/tasks/components/AddTaskDialog'
import TaskDetailsPanel from '../features/tasks/components/TaskDetailsPanel'
import TaskRows from '../features/tasks/components/TaskRows'

export default function AllTasksPage() {
  const {tasks,setTasks,notify:setPinNotice}=useSpaces()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const selected = tasks.find((task) => task.id === selectedId)
  const pinCount = tasks.filter((task) => task.pinned).length
  function removeTask(id: string) {
    setTasks((current) => current.filter((task) => task.id !== id))
    setSelectedId(null)
  }
  function saveTask(draft: TaskDraft) {
    setTasks(current=>[...current,{...draft,id:crypto.randomUUID(),spaceId:'',done:draft.done ?? false,completedSteps:[]}])
  }
  return (
    <div className="text-dark-blue">
      {/* Header */}
      <header className="mb-2 flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-end gap-4">
          <div className="min-w-0">
            <div className="relative inline-block pr-8">
              <h1 className="text-3xl font-bold">All tasks</h1>
              <img
                src="/images/yellow-doodle.png"
                alt=""
                aria-hidden="true"
                className="pointer-events-none absolute -top-3 -right-2 h-11 w-11 object-contain"
              />
            </div>
            <p className="mt-1 text-lg text-gray">Everything you're working on, in one place.</p>
          </div>

          {/* Mountains — sits beside the subtitle on all screen sizes */}
          <img
            src="/images/mountains.png"
            alt=""
            aria-hidden="true"
            className="pointer-events-none h-14 w-auto shrink-0 object-contain object-bottom opacity-80 sm:h-16 lg:h-20"
          />
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="min-h-10 rounded-lg bg-blue px-4 text-lg font-semibold text-white hover:bg-action-hover"
          >
            + Add task
          </button>
          <div className="hidden lg:block"><ProfileMenu /></div>
        </div>
      </header>

      <TaskRows
        onDeleteMany={ids => setTasks(current => current.filter(task => !ids.includes(task.id)))}
        onAdd={() => setAdding(true)}
        tasks={tasks}
        onOpen={task => setSelectedId(task.id)}
        onStatus={(task, state) => setTasks(current => current.map(item => item.id === task.id ? { ...item, ...state } : item))}
        onPin={task => {
          if (!task.pinned && pinCount >= 3) { setPinNotice('Unpin a task before adding another to your top three.'); return }
          setPinNotice('')
          setTasks(current => current.map(item => item.id === task.id ? { ...item, pinned: !item.pinned } : item))
        }}
      />

      {selected && (
        <TaskDetailsPanel
          key={selected.id}
          task={selected}
          onClose={() => setSelectedId(null)}
          onChange={changes => setTasks(current => current.map(task => task.id === selected.id ? { ...task, ...changes } : task))}
          onDelete={() => removeTask(selected.id)}
        />
      )}
      {adding && (
        <AddTaskDialog
          initialTitle=""
          canPin={pinCount < 3}
          onClose={() => setAdding(false)}
          onCreate={saveTask}
        />
      )}
    </div>
  )
}
