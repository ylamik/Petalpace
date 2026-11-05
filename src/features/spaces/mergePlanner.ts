// Three-way merge used when a save is rejected with 409 because another tab or device saved first.
// base = what this tab last saved, local = this tab's unsaved state, remote = the server's latest state.
//
// Items are matched by id and merged field by field. Fields that only make sense together are merged as
// one group (status and pin, space name and id, the deadline, steps and their completion). A group changed
// on one side takes that side's value. A group changed differently on both sides is a conflict: the merge
// keeps the remote value so everything else can be saved right away, and reports the local value so the
// user can choose to apply it afterwards with applyLocalVersion.
type Item = { id: string }
type SpaceItem = Item & { name: string }
type TaskItem = Item & { spaceId: string; space: string; pinned?: boolean; done?: boolean }
export type PlannerState<S extends SpaceItem, T extends TaskItem> = { spaces: S[]; tasks: T[] }
export type ItemConflict<T> = { collection: 'spaces' | 'tasks'; id: string; fields: string[]; local?: T; remote?: T }
export type Relocation = { from: string; to: string; count: number }

const TASK_GROUPS = [['done', 'started', 'blocked', 'pinned'], ['space', 'spaceId'], ['dueDate', 'dueTime', 'dueZone', 'dueToday'], ['steps', 'completedSteps']]
export const PIN_LIMIT = 3

function canonical(value: unknown): unknown {
  if (typeof File !== 'undefined' && value instanceof File) return { file: [value.name, value.size, value.lastModified, value.type] }
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, v]) => [k, canonical(v)]))
  }
  return value
}
const same = (a: unknown, b: unknown) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b))
const fieldsOf = (item: object | undefined, fields: string[]) => Object.fromEntries(fields.map(field => [field, (item as Record<string, unknown> | undefined)?.[field]]))
const assign = <T,>(item: T, values: Record<string, unknown>): T => {
  const next = { ...item } as Record<string, unknown>
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete next[key]
    else next[key] = value
  }
  return next as T
}

function groupsFor(items: (object | undefined)[], groups: string[][]) {
  const keys = new Set(items.flatMap(item => (item ? Object.keys(item) : [])))
  keys.delete('id')
  const grouped = new Set(groups.flat())
  return [...groups.filter(group => group.some(key => keys.has(key))), ...[...keys].filter(key => !grouped.has(key)).map(key => [key])]
}

export function mergeItems<T extends Item>(collection: 'spaces' | 'tasks', base: T[], local: T[], remote: T[], groups: string[][] = []) {
  const byId = (items: T[]) => new Map(items.map(item => [item.id, item]))
  const b = byId(base), l = byId(local), r = byId(remote)
  const conflicts: ItemConflict<T>[] = []
  const pick = (id: string): T | undefined => {
    const baseItem = b.get(id), localItem = l.get(id), remoteItem = r.get(id)
    if (same(baseItem, localItem)) return remoteItem
    if (same(baseItem, remoteItem) || same(localItem, remoteItem)) return localItem
    if (!localItem || !remoteItem) {
      // One side deleted the item and the other edited it. Keep the server's choice; the user can restore theirs.
      conflicts.push({ collection, id, fields: [], local: localItem, remote: remoteItem })
      return remoteItem
    }
    let merged = remoteItem
    const clashing: string[] = []
    for (const group of groupsFor([baseItem, localItem, remoteItem], groups)) {
      const baseValue = fieldsOf(baseItem, group), localValue = fieldsOf(localItem, group), remoteValue = fieldsOf(remoteItem, group)
      if (same(baseValue, localValue) || same(localValue, remoteValue)) continue
      if (same(baseValue, remoteValue)) merged = assign(merged, localValue)
      else clashing.push(...group)
    }
    if (clashing.length) conflicts.push({ collection, id, fields: clashing, local: localItem, remote: remoteItem })
    return merged
  }
  const merged: T[] = []
  const seen = new Set<string>()
  for (const item of [...remote, ...local]) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    const chosen = pick(item.id)
    if (chosen) merged.push(chosen)
  }
  return { merged, conflicts }
}

// The server allows at most three unfinished pinned tasks. Keep the server's pins and drop extra ones from this tab.
function enforcePinLimit<T extends TaskItem>(tasks: T[], keepPinned: (task: T) => boolean) {
  let count = tasks.filter(task => task.pinned && !task.done).length
  let unpinned = 0
  const result = [...tasks]
  for (let i = result.length - 1; i >= 0 && count > PIN_LIMIT; i--) {
    const task = result[i]
    if (!task.pinned || task.done || keepPinned(task)) continue
    result[i] = { ...task, pinned: false }
    count--
    unpinned++
  }
  return { tasks: result, unpinned }
}

export function mergePlanner<S extends SpaceItem, T extends TaskItem>(base: PlannerState<S, T>, local: PlannerState<S, T>, remote: PlannerState<S, T>) {
  const spaceMerge = mergeItems('spaces', base.spaces, local.spaces, remote.spaces)
  const taskMerge = mergeItems('tasks', base.tasks, local.tasks, remote.tasks, TASK_GROUPS)
  let spaces = spaceMerge.merged
  const key = (name: string) => name.trim().toLowerCase()

  // Both sides created a space with the same name: treat them as one space (the server's).
  const remoteIds = new Set(remote.spaces.map(space => space.id))
  const sameName = new Map<string, string>()
  for (const space of spaces) {
    if (remoteIds.has(space.id)) continue
    const existing = spaces.find(other => other.id !== space.id && remoteIds.has(other.id) && key(other.name) === key(space.name))
    if (existing) sameName.set(space.id, existing.id)
  }
  spaces = spaces.filter(space => !sameName.has(space.id))

  // A task's space was deleted on the other side. Send it where the other side moved that space's tasks,
  // otherwise back to its space on the server, otherwise to the first space.
  const byId = new Map(spaces.map(space => [space.id, space]))
  const remoteTask = new Map(remote.tasks.map(task => [task.id, task]))
  const deletedTo = (spaceId: string) => {
    for (const task of base.tasks) {
      if (task.spaceId !== spaceId) continue
      const moved = remoteTask.get(task.id)
      if (moved && byId.has(moved.spaceId)) return moved.spaceId
    }
  }
  const relocations = new Map<string, Relocation>()
  let tasks = taskMerge.merged.map(task => {
    const spaceId = sameName.get(task.spaceId) ?? task.spaceId
    const current = byId.get(spaceId)
    if (current) return current.name === task.space && spaceId === task.spaceId ? task : { ...task, spaceId, space: current.name }
    const targetId = deletedTo(spaceId) ?? [remoteTask.get(task.id)?.spaceId].find(id => id && byId.has(id)) ?? spaces[0]?.id
    if (!targetId) return task
    const target = byId.get(targetId)!
    const from = [...local.spaces, ...base.spaces].find(space => space.id === spaceId)?.name ?? task.space
    const entry = relocations.get(spaceId) ?? { from, to: target.name, count: 0 }
    entry.count++
    relocations.set(spaceId, entry)
    return { ...task, spaceId: target.id, space: target.name }
  })

  // No space left to move into: keep the deleted spaces these tasks still need.
  const missing = new Set(tasks.filter(task => !byId.has(task.spaceId)).map(task => task.spaceId))
  const restored = local.spaces.filter(space => missing.has(space.id))
  if (restored.length) {
    spaces = [...spaces, ...restored]
    const names = new Map(restored.map(space => [space.id, space.name]))
    tasks = tasks.map(task => names.has(task.spaceId) ? { ...task, space: names.get(task.spaceId)! } : task)
  }

  const pins = enforcePinLimit(tasks, task => !!remoteTask.get(task.id)?.pinned)

  return {
    merged: { spaces, tasks: pins.tasks },
    conflicts: [...spaceMerge.conflicts, ...taskMerge.conflicts] as ItemConflict<S | T>[],
    relocations: [...relocations.values()],
    unpinned: pins.unpinned,
  }
}

// "Use my version": apply this tab's values for the conflicting items on top of the current planner.
// A space is only deleted if no task still uses it, and pins stay within the top 3 limit.
export function applyLocalVersion<S extends SpaceItem, T extends TaskItem>(state: PlannerState<S, T>, conflicts: ItemConflict<S | T>[]) {
  let { spaces, tasks } = state
  let skipped = 0
  const applyTo = <U extends Item>(items: U[], conflict: ItemConflict<U>) => {
    const index = items.findIndex(item => item.id === conflict.id)
    if (!conflict.local) return items.filter(item => item.id !== conflict.id)
    if (index === -1) return [...items, conflict.local]
    const next = [...items]
    next[index] = conflict.fields.length ? assign(items[index], fieldsOf(conflict.local, conflict.fields)) : conflict.local
    return next
  }
  for (const conflict of conflicts) {
    if (conflict.collection === 'spaces') {
      if (!conflict.local && tasks.some(task => task.spaceId === conflict.id)) { skipped++; continue }
      spaces = applyTo(spaces, conflict as ItemConflict<S>)
    } else {
      const next = applyTo(tasks, conflict as ItemConflict<T>)
      const task = next.find(item => item.id === conflict.id)
      if (task && !spaces.some(space => space.id === task.spaceId)) { skipped++; continue }
      tasks = next
    }
  }
  const before = new Map(state.tasks.map(task => [task.id, task]))
  const pins = enforcePinLimit(tasks, task => !!before.get(task.id)?.pinned)
  return { state: { spaces, tasks: pins.tasks }, skipped: skipped + pins.unpinned }
}

const FIELD_LABELS: Record<string, string> = { title: 'title', done: 'status', pinned: 'top 3 pin', notes: 'notes', space: 'space', priority: 'priority', dueDate: 'deadline', steps: 'steps', files: 'attachments', links: 'links', name: 'name', color: 'color' }
export function describeConflict(conflict: ItemConflict<{ id: string; title?: string; name?: string }>) {
  const item = conflict.local ?? conflict.remote
  const name = item?.title ?? item?.name ?? 'Untitled'
  if (!conflict.fields.length) return { name, detail: conflict.local ? 'deleted in the other tab' : 'deleted in this tab' }
  const labels = [...new Set(conflict.fields.map(field => FIELD_LABELS[field]).filter(Boolean))]
  return { name, detail: labels.join(', ') || 'details' }
}
