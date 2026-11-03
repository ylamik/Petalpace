import { useSpaces } from '../../spaces/spaces'
export default function TaskSpaceBadge({name}: {name:string}) {
  const {spaces}=useSpaces()
  const space=spaces.find(s=>s.name===name)
  return <span title={name} className="inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-full border border-dark-blue/15 bg-surface/70 px-2 py-1 text-sm text-dark-blue"><span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-full border border-dark-blue/20" style={{backgroundColor:space?.color ?? '#E0E2DC'}}/><span className="truncate">{name}</span></span>
}
