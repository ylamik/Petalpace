// Three-way merge used when a save is rejected with 409 because another tab or device saved first.
// base = what this tab last saved, local = this tab's unsaved state, remote = the server's latest state.
// Items are merged by id: whichever side changed an item wins. If both sides changed the same item
// differently, the local version is kept and the item is reported as a conflict.
type Item = { id: string }
export type PlannerState<S extends Item, T extends Item> = { spaces: S[]; tasks: T[] }

function canonical(value: unknown): unknown {
  if (typeof File !== 'undefined' && value instanceof File) return { file: [value.name, value.size, value.lastModified, value.type] }
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, v]) => [k, canonical(v)]))
  }
  return value
}
const same = (a: unknown, b: unknown) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b))

export function mergeItems<T extends Item>(base: T[], local: T[], remote: T[]) {
  const byId = (items: T[]) => new Map(items.map(item => [item.id, item]))
  const b = byId(base), l = byId(local), r = byId(remote)
  const conflicts: string[] = []
  const pick = (id: string): T | undefined => {
    const baseItem = b.get(id), localItem = l.get(id), remoteItem = r.get(id)
    if (same(baseItem, localItem)) return remoteItem
    if (same(baseItem, remoteItem) || same(localItem, remoteItem)) return localItem
    conflicts.push(id)
    return localItem
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

type SpaceItem = Item & { name: string }
type TaskItem = Item & { spaceId: string; space: string }
export type Relocation = { from: string; to: string; count: number }

export function mergePlanner<S extends SpaceItem, T extends TaskItem>(base: PlannerState<S, T>, local: PlannerState<S, T>, remote: PlannerState<S, T>) {
  const spaceMerge = mergeItems(base.spaces, local.spaces, remote.spaces)
  const taskMerge = mergeItems(base.tasks, local.tasks, remote.tasks)
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

  return {
    merged: { spaces, tasks },
    conflicts: [...spaceMerge.conflicts, ...taskMerge.conflicts],
    relocations: [...relocations.values()],
  }
}
