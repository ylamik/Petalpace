import PlannerSelect from '../../../components/ui/PlannerSelect'
import { useSpaces } from '../../spaces/spaces'
export default function TaskSpaceSelect({value,onChange,all=false,label='Space',className='',names}: {value:string;onChange:(value:string)=>void;all?:boolean;required?:boolean;label?:string;className?:string;names?:string[]}) {
  const {spaces}=useSpaces()
  const choices=names ?? spaces.map(s=>s.name)
  return <PlannerSelect value={value} onChange={onChange} label={label} className={className} options={[{value:all?'all':'',label:all?'All spaces':'Select space'},...choices.map(name=>({value:name,label:name,color:spaces.find(s=>s.name===name)?.color}))]}/>
}
