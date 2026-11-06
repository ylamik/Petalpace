// A saved attachment is metadata only. Its bytes download on demand.
export type StoredFile = { id: string; name: string; type: string; lastModified: number; size: number }
export type TaskFile = File | StoredFile
export const isStoredFile = (file: TaskFile): file is StoredFile => !(file instanceof File)
export const storedFileUrl = (file: StoredFile) => `/api/auth/planner/files/${file.id}`
