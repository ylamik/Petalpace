import { createContext, useContext } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { TaskDraft } from '../tasks/components/AddTaskDialog'

export type Space = { id: string; name: string; color: string }
export type SpaceTask = TaskDraft & { id: string; spaceId: string; dueToday?: boolean; done: boolean; started?: boolean; completedSteps: number[] }
export const defaultSpaces: Space[] = [
  { id: 'school', name: 'School', color: '#D7E7FD' },
  { id: 'personal', name: 'Personal', color: '#FDDCCD' },
  { id: 'creative', name: 'Creative', color: '#D6DDC9' },
]
export type DeletedTask = SpaceTask & {deletedAt:number;expiresAt:number}
export const SpacesContext = createContext<{
  trash:DeletedTask[];
  permanentlyDelete:(ids:string[])=>void;
  deleteSpace:(id:string,moveTo?:string)=>void;
  spaces: Space[]; setSpaces: Dispatch<SetStateAction<Space[]>>;
  activity: {day:string;count:number}[]; saving:boolean; ensureSaved:()=>Promise<boolean>; notify:(message:string)=>void;
  tasks: SpaceTask[]; setTasks: Dispatch<SetStateAction<SpaceTask[]>>;
} | null>(null)
export function useSpaces() {
  const value = useContext(SpacesContext)
  if (!value) throw new Error('SpacesProvider is required')
  return value
}
