import { usePlannerClock } from '../../../hooks/usePlannerClock'
import { daysUntil, deadlineText, effectiveDue } from './taskPresentation'
export default function DeadlineLabel({task}: {task:{dueDate?:string;dueTime?:string;dueToday?:boolean;done?:boolean}}) {
  const now=usePlannerClock()
  const date=effectiveDue(task), days=daysUntil(date,now)
  return <span className={`break-words text-sm ${!task.done && days!==null && days<=3 ? 'font-medium text-red':'text-gray'}`}>
    {date && days!==null ? <time dateTime={task.dueTime?`${date}T${task.dueTime}`:date}>{deadlineText(task,now)}</time> : 'No due date'}
  </span>
}
