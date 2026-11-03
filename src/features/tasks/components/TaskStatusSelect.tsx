import PlannerSelect from '../../../components/ui/PlannerSelect'
import { useState } from 'react'
import ConfirmTaskDialog from './ConfirmTaskDialog'
import { needsStatusConfirmation, type TaskStatus } from './taskPresentation'
const labels = {todo:'To do',progress:'In progress',done:'Done',blocked:'Blocked'}
export default function TaskStatusSelect({value,onChange,title,draft=false}: {value:TaskStatus;onChange:(status:TaskStatus)=>void;title:string;draft?:boolean}) {
  const [pending,setPending]=useState<TaskStatus|null>(null)
  return <>
    <PlannerSelect label={`Status for ${title}`} value={value} onChange={nextValue=>{const next=nextValue as TaskStatus;if(needsStatusConfirmation(value,next))setPending(next);else onChange(next)}} tone={value} className="max-w-44" options={Object.entries(labels).map(([v,label])=>({value:v,label}))}/>
    {pending && <ConfirmTaskDialog title={pending==='done'?'Mark this task as done?':'Reopen this task?'} message={`${pending==='done'?'This task will move to Completed.':`This task will return to active tasks with status “${labels[pending]}”.`}${draft?' The change applies only when you save this task.':''}`} confirmLabel={pending==='done'?'Mark as done':'Reopen task'} cancelLabel="Cancel" destructive={false} onCancel={()=>setPending(null)} onConfirm={()=>{onChange(pending);setPending(null)}}/>}
  </>
}
