import test from 'node:test'
import assert from 'node:assert/strict'
import { mergePlanner } from '../src/features/spaces/mergePlanner.ts'

const space = { id: 'school', name: 'School', color: '#D7E7FD' }
const task = (id, changes = {}) => ({ id, title: `Task ${id}`, spaceId: 'school', space: 'School', done: false, pinned: false, files: [], ...changes })
const base = { spaces: [space], tasks: [task('a'), task('b'), task('c')] }

test('edits to different tasks in two tabs are both kept', () => {
  const local = { spaces: [space], tasks: [task('a', { done: true }), task('b'), task('c')] }
  const remote = { spaces: [space], tasks: [task('a'), task('b', { done: true }), task('c')] }
  const { merged, conflicts } = mergePlanner(base, local, remote)
  assert.deepEqual(conflicts, [])
  assert.deepEqual(merged.tasks.map(t => [t.id, t.done]), [['a', true], ['b', true], ['c', false]])
})

test('adds and deletes from both sides are combined', () => {
  const local = { spaces: [space], tasks: [task('a'), task('b'), task('c'), task('local-new')] }
  const remote = { spaces: [space], tasks: [task('a'), task('b'), task('remote-new')] }
  const { merged, conflicts } = mergePlanner(base, local, remote)
  assert.deepEqual(conflicts, [])
  assert.deepEqual(merged.tasks.map(t => t.id), ['a', 'b', 'remote-new', 'local-new'])
})

test('a local delete of an unchanged task sticks even though it is still on the server', () => {
  const local = { spaces: [space], tasks: [task('a'), task('b')] }
  const { merged, conflicts } = mergePlanner(base, local, base)
  assert.deepEqual(conflicts, [])
  assert.deepEqual(merged.tasks.map(t => t.id), ['a', 'b'])
})

test('the same task changed differently on both sides is a conflict, keeping the local version', () => {
  const local = { spaces: [space], tasks: [task('a', { title: 'Mine' }), task('b'), task('c')] }
  const remote = { spaces: [space], tasks: [task('a', { title: 'Theirs' }), task('b'), task('c')] }
  const { merged, conflicts } = mergePlanner(base, local, remote)
  assert.deepEqual(conflicts, ['a'])
  assert.equal(merged.tasks[0].title, 'Mine')
})

test('identical changes on both sides and key order differences are not conflicts', () => {
  const reordered = ({ id, title, ...rest }) => ({ ...rest, title, id })
  const local = { spaces: [space], tasks: [task('a', { done: true }), task('b'), task('c')] }
  const remote = { spaces: [space], tasks: [reordered(task('a', { done: true })), reordered(task('b')), task('c')] }
  const { conflicts } = mergePlanner(base, local, remote)
  assert.deepEqual(conflicts, [])
})

const work = { id: 'work', name: 'Work', color: '#123456' }
const home = { id: 'home', name: 'Home', color: '#654321' }

test('a task moved into a space the other side deleted follows that space tasks to their new space', () => {
  const base = { spaces: [space, work, home], tasks: [task('a'), task('w', { spaceId: 'work', space: 'Work' })] }
  const local = { spaces: [space, work, home], tasks: [task('a', { spaceId: 'work', space: 'Work' }), task('w', { spaceId: 'work', space: 'Work' })] }
  const remote = { spaces: [space, home], tasks: [task('a'), task('w', { spaceId: 'home', space: 'Home' })] }
  const { merged, conflicts, relocations } = mergePlanner(base, local, remote)
  assert.deepEqual(conflicts, [])
  assert.deepEqual(merged.spaces.map(s => s.id), ['school', 'home'])
  assert.deepEqual(merged.tasks.map(t => [t.id, t.spaceId, t.space]), [['a', 'home', 'Home'], ['w', 'home', 'Home']])
  assert.deepEqual(relocations, [{ from: 'Work', to: 'Home', count: 1 }])
})

test('a task moved into a deleted empty space goes back to its space on the server', () => {
  const base = { spaces: [space, work], tasks: [task('a')] }
  const local = { spaces: [space, work], tasks: [task('a', { spaceId: 'work', space: 'Work', done: true })] }
  const remote = { spaces: [space], tasks: [task('a')] }
  const { merged, relocations } = mergePlanner(base, local, remote)
  assert.deepEqual(merged.tasks.map(t => [t.spaceId, t.space, t.done]), [['school', 'School', true]])
  assert.deepEqual(relocations, [{ from: 'Work', to: 'School', count: 1 }])
})

test('a new task in this tab follows a space renamed in the other tab', () => {
  const base = { spaces: [space, work], tasks: [] }
  const local = { spaces: [space, work], tasks: [task('n', { spaceId: 'work', space: 'Work' })] }
  const remote = { spaces: [space, { ...work, name: 'Job' }], tasks: [] }
  const { merged, relocations } = mergePlanner(base, local, remote)
  assert.deepEqual(merged.tasks.map(t => [t.spaceId, t.space]), [['work', 'Job']])
  assert.deepEqual(relocations, [])
})

test('both sides creating a space with the same name keep one space', () => {
  const base = { spaces: [space], tasks: [] }
  const local = { spaces: [space, { id: 'mine', name: 'Work', color: '#111111' }], tasks: [task('n', { spaceId: 'mine', space: 'Work' })] }
  const remote = { spaces: [space, { id: 'theirs', name: 'work', color: '#222222' }], tasks: [] }
  const { merged } = mergePlanner(base, local, remote)
  assert.deepEqual(merged.spaces.map(s => s.id), ['school', 'theirs'])
  assert.deepEqual(merged.tasks.map(t => [t.spaceId, t.space]), [['theirs', 'work']])
})

test('attachments compare by file metadata, not object identity', () => {
  const file = () => new File(['hello'], 'notes.pdf', { type: 'application/pdf', lastModified: 1 })
  const withFile = { spaces: [space], tasks: [task('a', { files: [file()] }), task('b'), task('c')] }
  const local = { spaces: [space], tasks: [task('a', { files: [file()] }), task('b', { done: true }), task('c')] }
  const remote = { spaces: [space], tasks: [task('a', { files: [file()] }), task('b'), task('c')] }
  const { merged, conflicts } = mergePlanner(withFile, local, remote)
  assert.deepEqual(conflicts, [])
  assert.equal(merged.tasks[1].done, true)
})
