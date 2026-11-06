export type CollabRole = 'owner' | 'member' | 'editor' | 'steps' | 'viewer'
export type CollabStatus = 'todo' | 'progress' | 'done' | 'blocked'

export interface CollabMember {
  id: string
  name: string
  email: string
  role: CollabRole
  photoUrl: string | null
}

export interface CollabSubtask {
  id: string
  title: string
  done: boolean
  status?: 'todo' | 'progress' | 'done' | 'blocked'
  assignedTo: string | null
  notes?: string
  links?: string[]
  position: number
}

export interface CollabFile {
  id: string
  name: string
  type: string
  lastModified: number
  subtaskId?:string | null
}

export interface CollabLink {
  id: string
  url: string
}

export interface CollabTask {
  id: string
  title: string
  notes: string
  priority: 'High' | 'Medium' | 'Low'
  dueDate: string
  dueTime: string
  status: CollabStatus
  color: string
  ownerId: string
  createdAt: number
  updatedAt: number
  revision:number
  dueZone:string
  assignedTo:string | null
  members: CollabMember[]
  subtasks: CollabSubtask[]
  files: CollabFile[]
  links: CollabLink[]
}

async function collabRequest(path: string, method = 'GET', body?: unknown) {
  const response = await fetch(`/api/collab${path}`, {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000),
  })
  const result = await response.json().catch(() => null)
  if (!response.ok || !result) throw new Error(result?.error || 'Could not reach the collaboration server.')
  return result
}

export type CollabUpdatePayload = Partial<Omit<CollabTask, 'links' | 'files'>> & {
  links?: string[]
  files?: Array<{ name: string; type: string; data: string; lastModified: number; id?:string;subtaskId?:string | null }>
  subtasks?: Array<Omit<CollabSubtask, 'id'> & { id?: string }>
}

export const collabApi = {
  list: () => collabRequest('/tasks') as Promise<{ tasks: CollabTask[] }>,
  get: (id: string) => collabRequest(`/tasks/${id}`) as Promise<{ task: CollabTask }>,
  create: (data: { title: string; notes?: string; priority: string; dueDate?: string; dueTime?: string; dueZone?:string; color: string }) =>
    collabRequest('/tasks', 'POST', data) as Promise<{ task: CollabTask }>,
  update: (id: string, data: CollabUpdatePayload) =>
    collabRequest(`/tasks/${id}`, 'PUT', data) as Promise<{ task: CollabTask }>,
  delete: (id: string) => collabRequest(`/tasks/${id}`, 'DELETE') as Promise<{ ok: boolean }>,
  invite: (taskId: string, email: string, permission: string) =>
    collabRequest(`/tasks/${taskId}/invite`, 'POST', { email, permission }) as Promise<{ ok: boolean; message: string }>,
  previewJoin: (token: string) =>
    collabRequest(`/join/${token}`) as Promise<{ taskTitle: string; ownerName: string; email: string }>,
  acceptJoin: (token: string) =>
    collabRequest(`/join/${token}`, 'POST', {}) as Promise<{ taskId: string }>,
  permission:(taskId:string,userId:string,permission:string)=>collabRequest(`/tasks/${taskId}/members/${userId}`,'PATCH',{permission}) as Promise<{task:CollabTask}>,
  removeMember: (taskId: string, userId: string) =>
    collabRequest(`/tasks/${taskId}/members/${userId}`, 'DELETE') as Promise<{ task: CollabTask }>,
  leave: (taskId: string) =>
    collabRequest(`/tasks/${taskId}/leave`, 'DELETE') as Promise<{ ok: boolean }>,
}
