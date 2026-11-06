import { compareTasks, getStatus, matchesDeadline, type TaskState } from './taskPresentation'

export type TaskFilterValues = {
  search: string
  spaces: string[]
  statuses: string[]
  priorities: string[]
  deadline: string
  sort: string
}

export const defaultTaskFilters: TaskFilterValues = { search: '', spaces: [], statuses: [], priorities: [], deadline: 'all', sort: 'nearest' }

type FilterableTask = TaskState & { title: string; space: string; priority: string; dueDate?: string; dueTime?: string; dueZone?: string; dueToday?: boolean }

export function applyTaskFilters<T extends FilterableTask>(tasks: T[], filters: TaskFilterValues) {
  const search = filters.search.trim().toLowerCase()
  return tasks
    .filter(task => task.title.toLowerCase().includes(search)
      && (!filters.spaces.length || filters.spaces.includes(task.space))
      && (!filters.statuses.length || filters.statuses.includes(getStatus(task)))
      && (!filters.priorities.length || filters.priorities.includes(task.priority))
      && matchesDeadline(task, filters.deadline))
    .sort((a, b) => compareTasks(a, b, filters.sort))
}

export const toolbarButton = 'inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-xl border border-dark-blue/15 bg-surface px-3.5 text-sm font-semibold text-dark-blue hover:bg-nav-active focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue'
