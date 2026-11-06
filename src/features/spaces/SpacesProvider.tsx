import { Link } from 'react-router'
import ConfirmTaskDialog from '../tasks/components/ConfirmTaskDialog'
import PageLoader from '../../components/ui/PageLoader'
import { useCallback, useEffect, useRef, useState, type ReactNode, type SetStateAction } from 'react'
import { SpacesContext, type Space, type SpaceTask, type DeletedTask } from './spaces'
import { useAuth } from '../auth/auth'
import { usePlannerSync } from '../../hooks/usePlannerSync'
import { isStoredFile, type StoredFile, type TaskFile } from '../tasks/taskFiles'
import { mergePlanner, applyLocalVersion, describeConflict, type ItemConflict } from './mergePlanner'
type Snapshot={spaces:Space[];tasks:SpaceTask[]}
type WireFile={name:string;type:string;lastModified:number;data:string}
// Files picked in this tab stay as File objects after saving; this remembers their stored id.
const storedIds = new WeakMap<File, string>()
const encode=(file:File)=>new Promise<WireFile>((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error('Could not read an attachment. Please remove it and try again.'));reader.onload=()=>resolve({name:file.name,type:file.type,lastModified:file.lastModified,data:String(reader.result).split(',')[1]});reader.readAsDataURL(file)})
const wireFile=(file:TaskFile)=>{
  if(isStoredFile(file))return Promise.resolve({id:file.id})
  const id=storedIds.get(file)
  return id?Promise.resolve({id}):encode(file)
}
class ConflictError extends Error {}
async function request(data?:unknown) {
  const response=await fetch('/api/auth/planner',{method:data?'PUT':'GET',credentials:'same-origin',cache:'no-store',headers:data?{'Content-Type':'application/json'}:undefined,body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(30000)})
  const result=await response.json().catch(()=>null)
  if(response.status===409) throw new ConflictError(result?.error || 'Your planner changed in another tab.')
  if(!response.ok || !result) throw new Error(result?.error || 'Could not reach your planner. Keep this page open and try again.')
  if(result.binVersion!==2 || !Array.isArray(result.trash))throw new Error('Your running server needs an update for safe deletion. Stop the existing terminal process with Ctrl+C, run npm run dev again, then reload this page.')
  return result
}
export default function SpacesProvider({children}:{children:ReactNode}) {
  const {user}=useAuth()
  const [data,setData]=useState<Snapshot|null>(null)
  const [trash,setTrash]=useState<DeletedTask[]>([])
  const purgeIdsRef=useRef<string[]>([])
  const trashRef=useRef<DeletedTask[]>([])
  const [activity,setActivity]=useState<{day:string;count:number}[]>([])
  const [error,setError]=useState('')
  const [conflicts,setConflicts]=useState<ItemConflict<Space|SpaceTask>[]>([])
  const [reloadOpen,setReloadOpen]=useState(false)
  const [saving,setSaving]=useState(false)
  const [notice,setNotice]=useState<{message:string;id:number;taskLink?:boolean;binLink?:boolean;undoTasks?:DeletedTask[]}|null>(null)
  const revision=useRef(0), alive=useRef(true), running=useRef(false), failed=useRef(false)
  const pending=useRef<Snapshot|null>(null), saved=useRef<Snapshot|null>(null)
  const notify=useCallback((message:string)=>{setNotice(message?{message,id:Date.now()}:null)},[])
  useEffect(()=>{if(!notice || notice.undoTasks?.length)return;const timer=setTimeout(()=>setNotice(null),7000);return()=>clearTimeout(timer)},[notice])
  useEffect(()=>{
    alive.current=true
    let cancelled=false
    request().then(result=>{
      if(cancelled)return
      const tasks=(result.tasks as SpaceTask[]).map(task=>({...task,dueZone:task.dueZone || Intl.DateTimeFormat().resolvedOptions().timeZone}))
      const initial={spaces:result.spaces as Space[],tasks}
      trashRef.current=result.trash;setTrash(trashRef.current);revision.current=result.revision;saved.current=(result.tasks as SpaceTask[]).some(t=>!t.dueZone)?{...initial,tasks:result.tasks as SpaceTask[]}:initial;setActivity(result.activity);setData(initial)
    }).catch(e=>{if(!cancelled)setError(e instanceof Error?e.message:'Could not load your planner.')})
    return()=>{cancelled=true;alive.current=false}
  },[])

  // SSE: silently re-fetch when another tab/device saves the planner,
  // but only if this tab has nothing pending (to avoid overwriting local work).
  const [syncing, setSyncing]=useState(false)
  const remotePending=useRef(false)
  const refreshing=useRef(false)
  const refreshRemote=useCallback(async()=>{
    remotePending.current=true
    if(refreshing.current || pending.current || running.current || failed.current || !alive.current || document.querySelector('dialog[open]')) return
    refreshing.current=true;setSyncing(true)
    try {
      const start=saved.current
      const versionResponse=await fetch('/api/auth/planner/version',{cache:'no-store',signal:AbortSignal.timeout(12000)})
      if(!versionResponse.ok)throw new Error('Could not check updates.')
      const version=await versionResponse.json()
      if(version.revision<=revision.current){remotePending.current=false;return}
      const result=await request()
      if(!alive.current) return
      if(pending.current || running.current || failed.current || saved.current!==start || document.querySelector('dialog[open]')) return
      if(result.revision>revision.current){
        const fresh={spaces:result.spaces as Space[],tasks:result.tasks as SpaceTask[]}
        trashRef.current=result.trash;setTrash(trashRef.current)
        revision.current=result.revision;saved.current=fresh;setData(fresh);setActivity(result.activity)
      }
      remotePending.current=false
    }catch{setNotice({message:'Live updates are reconnecting. Your saved tasks are safe.',id:Date.now()})}
    finally{refreshing.current=false;if(alive.current)setSyncing(false)}
  },[])
  usePlannerSync(user?.id, refreshRemote)
  useEffect(()=>{const timer=setInterval(()=>{if(remotePending.current)void refreshRemote()},1500);return()=>clearInterval(timer)},[refreshRemote])
  const flush=useCallback(async()=>{
    if(running.current || failed.current || !alive.current)return
    running.current=true;setSaving(true)
    let rebases=0, rebaseNote=''
    try {
      while(pending.current && alive.current){
        const snapshot=pending.current;pending.current=null
        try{
          const tasks=await Promise.all(snapshot.tasks.map(async task=>({...task,files:await Promise.all(task.files.map(wireFile))})))
          if(!alive.current)break
          const purgeIds=[...purgeIdsRef.current]
          const result=await request({...snapshot,tasks,purgeIds,revision:revision.current,timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone})
          purgeIdsRef.current=purgeIdsRef.current.filter(id=>!purgeIds.includes(id))
          const removed=(saved.current?.tasks ?? []).filter(task=>!snapshot.tasks.some(current=>current.id===task.id))
          const moved=snapshot.tasks.filter(task=>{const old=saved.current?.tasks.find(previous=>previous.id===task.id);return old && old.spaceId!==task.spaceId})
          const removedTasks=removed.length
          const added=snapshot.tasks.filter(task=>!saved.current?.tasks.some(previous=>previous.id===task.id)).length
          const removedSpaces=(saved.current?.spaces ?? []).filter(space=>!snapshot.spaces.some(current=>current.id===space.id)).length
          if(alive.current && rebaseNote){setNotice({message:rebaseNote,id:Date.now()});rebaseNote=''}
          else if(alive.current && purgeIds.length)setNotice({message:`${purgeIds.length} ${purgeIds.length===1?'task':'tasks'} permanently deleted.`,id:Date.now()})
          else if(alive.current && added) {
            const restored=snapshot.tasks.filter(task=>trashRef.current.some(deleted=>deleted.id===task.id)).length
            setNotice({message:restored===added?(added===1?'Task restored!':`${added} tasks restored!`):(added===1?'Task added!':`${added} tasks added!`),id:Date.now(),taskLink:true})
          }
          else if(alive.current && removedTasks) setNotice({message:`${removedTasks===1?'Task':`${removedTasks} tasks`} deleted. You can undo this.`,id:Date.now(),binLink:true,undoTasks:(result.trash as DeletedTask[]).filter(task=>removed.some(item=>item.id===task.id))})
          else if(alive.current && moved.length && !removedSpaces) setNotice({message:moved.length===1?`Task moved to ${moved[0].space}.`:`${moved.length} tasks moved.`,id:Date.now()})
          else if(alive.current && removedSpaces) setNotice({message:'Space deleted. Your tasks are safe in their selected space.',id:Date.now()})
          snapshot.tasks.forEach(task=>task.files.forEach((file,index)=>{const stored=(result.files as Record<string,StoredFile[]>)?.[task.id]?.[index];if(stored && !isStoredFile(file))storedIds.set(file,stored.id)}))
          revision.current=result.revision;saved.current=snapshot
          if(alive.current){trashRef.current=result.trash;setTrash(trashRef.current);setActivity(result.activity);setError('')}
        }catch(e){
          let failure=e
          // Another tab or device saved first: fetch the latest planner, replay this tab's edits on top of it, and save again.
          if(e instanceof ConflictError && rebases<3 && alive.current){
            rebases++
            try{
              const result=await request()
              if(!alive.current)break
              const remote={spaces:result.spaces as Space[],tasks:result.tasks as SpaceTask[]}
              const {merged,conflicts:clashes,relocations,unpinned}=mergePlanner<Space,SpaceTask>(saved.current ?? {spaces:[],tasks:[]},pending.current ?? snapshot,remote)
              const notes=relocations.map(({from,to,count})=>`“${from}” was deleted in another tab or device, so ${count===1?'1 task was':`${count} tasks were`} moved to ${to}.`)
              if(unpinned) notes.push(`Your top 3 was already full from another tab or device, so ${unpinned===1?'1 task was':`${unpinned} tasks were`} unpinned.`)
              if(notes.length) rebaseNote=notes.join(' ')
              // Conflicting fields were saved with the other version; let the user apply theirs instead.
              if(clashes.length) setConflicts(current=>[...current.filter(item=>!clashes.some(next=>next.id===item.id)),...clashes])
              revision.current=result.revision;saved.current=remote
              trashRef.current=result.trash;setTrash(trashRef.current);setActivity(result.activity)
              pending.current=merged;setData(merged)
              continue
            }catch(next){failure=next}
          }
          pending.current=pending.current??snapshot;failed.current=true
          if(alive.current){setError(failure instanceof Error?failure.message:'Could not save. Keep this page open and retry.')}
          break
        }
      }
    }finally{running.current=false;if(alive.current)setSaving(false)}
  },[])
  useEffect(()=>{if(!data || data===saved.current)return;pending.current=data;const timer=setTimeout(()=>void flush(),250);return()=>clearTimeout(timer)},[data,flush])
  useEffect(()=>{
    const guard=(event:BeforeUnloadEvent)=>{if(running.current || pending.current){event.preventDefault();event.returnValue=''}}
    window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard)
  },[])
  const ensureSaved=useCallback(async()=>{
    await flush()
    while(running.current && alive.current) await new Promise(resolve=>setTimeout(resolve,50))
    if(pending.current && !failed.current) await flush()
    return !failed.current && !pending.current
  },[flush])
  const deleteSpace=useCallback((id:string,moveTo?:string)=>setData(current=>{
    if(!current)return current
    const target=current.spaces.find(space=>space.id===moveTo && space.id!==id)
    const hasTasks=current.tasks.some(task=>task.spaceId===id)
    if(hasTasks && !target)return current
    return {spaces:current.spaces.filter(space=>space.id!==id),tasks:current.tasks.map(task=>task.spaceId===id && target ? {...task,spaceId:target.id,space:target.name} : task)}
  }),[])
  const setSpaces=useCallback((action:SetStateAction<Space[]>)=>setData(current=>current?{...current,spaces:typeof action==='function'?action(current.spaces):action}:current),[])
  const setTasks=useCallback((action:SetStateAction<SpaceTask[]>)=>setData(current=>{
    if(!current)return current
    remotePending.current=true
    const tasks=(typeof action==='function'?action(current.tasks):action).map(task=>({...task,dueZone:task.dueZone || Intl.DateTimeFormat().resolvedOptions().timeZone,spaceId:current.spaces.find(s=>s.name===task.space)?.id??task.spaceId,pinned:task.done?false:task.pinned}))
    return {...current,tasks}
  }),[])
  const permanentlyDelete=useCallback((ids:string[])=>{
    if(!ids.length)return
    purgeIdsRef.current=[...new Set([...purgeIdsRef.current,...ids])]
    setData(current=>current?{...current}:current)
  },[])
  const resetActivity=useCallback(async()=>{
    // Let any in-flight save finish first so its revision can't overwrite the one the reset returns.
    await ensureSaved()
    let response:Response
    try{response=await fetch('/api/auth/planner',{method:'DELETE',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(15000)})}
    catch{throw new Error('Could not reach your planner. Your activity history was not reset.')}
    const result=await response.json().catch(()=>null)
    if(!response.ok || !result) throw new Error(result?.error || 'Could not reset your activity history. Please try again.')
    if(typeof result.revision==='number' && result.revision>revision.current) revision.current=result.revision
    if(alive.current) setActivity([])
  },[ensureSaved])
  function applyMyVersion(){
    if(!data)return
    const {state,skipped}=applyLocalVersion<Space,SpaceTask>(data,conflicts)
    setConflicts([]);setData(state)
    if(skipped)notify('Some of your changes could not be applied because they no longer fit the saved planner (for example, a full top 3). Check them and edit again.')
  }
  function undoDelete(){
    if(!data || !notice?.undoTasks?.length)return
    const restoring=notice.undoTasks.filter(task=>!data.tasks.some(current=>current.id===task.id))
    if(restoring.some(task=>task.expiresAt<=Date.now() || !data.spaces.some(space=>space.id===task.spaceId))){
      setNotice({message:'Open the Bin to choose a space for these tasks. The recovery window is 30 days.',id:Date.now(),binLink:true});return
    }
    setTasks(current=>[...current,...restoring.filter(task=>!current.some(item=>item.id===task.id)).map(task=>{const space=data.spaces.find(space=>space.id===task.spaceId);if(!space)return null;return{...task,space:space.name,pinned:false}}).filter((t):t is NonNullable<typeof t>=>t!==null)])
    setNotice({message:'Restoring your tasks...',id:Date.now()})
  }
  if(!data) {
    if(error) return <main className="min-h-dvh bg-page p-8 font-sans text-dark-blue"><p role="alert">{error}</p><button type="button" onClick={()=>window.location.reload()} className="mt-4 rounded-lg bg-blue px-4 py-2 text-white">Try again</button></main>
    return <PageLoader label="Opening your planner…" />
  }
  return <SpacesContext.Provider value={{...data,trash,permanentlyDelete,setSpaces,setTasks,deleteSpace,activity,saving,syncing,notify,ensureSaved,resetActivity}}>
    {children}
    {syncing && <div role="status" className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-lg border border-blue/30 bg-surface px-4 py-2 text-sm text-dark-blue shadow">Updating from your other device…</div>}
    <div className="fixed right-4 bottom-4 left-4 z-50 flex flex-col gap-3 sm:left-auto sm:w-96">
      {error && <div role="alert" className="rounded-xl border border-red/30 bg-surface p-4 text-dark-blue shadow-lg"><p className="font-semibold">Your changes haven’t been saved</p><p className="mt-1 text-sm">{error}</p><div className="mt-3 flex gap-3"><button onClick={()=>{failed.current=false;void flush()}} className="rounded bg-blue px-3 py-2 text-white">Retry saving</button><button onClick={()=>setReloadOpen(true)} className="text-sm text-link underline">Reload saved version</button></div></div>}
      {conflicts.length>0 && <div role="alert" className="rounded-xl border border-orange/40 bg-surface p-4 text-dark-blue shadow-lg"><p className="font-semibold">{conflicts.length===1?'Changed in two places':`${conflicts.length} items changed in two places`}</p><p className="mt-1 text-sm">Your other changes are saved. For {conflicts.length===1?'this item':'these items'}, the version from your other tab or device was kept:</p><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{conflicts.map(item=>{const {name,detail}=describeConflict(item);return <li key={`${item.collection}-${item.id}`}><span className="font-medium">“{name}”</span> <span className="text-gray">({detail})</span></li>})}</ul><div className="mt-3 flex flex-wrap gap-3"><button type="button" onClick={applyMyVersion} className="min-h-10 rounded bg-blue px-3 py-2 text-white">Use my version</button><button type="button" onClick={()=>setConflicts([])} className="min-h-10 text-sm text-link underline">Keep the other version</button></div></div>}
      {notice && <div role="status" className={`flex gap-3 rounded-xl border border-dark-blue/20 bg-surface p-4 text-dark-blue shadow-lg ${notice.undoTasks?.length || notice.binLink || notice.taskLink ? 'items-start' : 'items-center'}`}><img src="/images/task-added.png" alt="" aria-hidden="true" className="h-9 w-9 shrink-0 object-contain"/><div className="min-w-0 flex-1 text-base"><p>{notice.message}</p>{notice.undoTasks?.length ? <button type="button" onClick={undoDelete} disabled={saving} className="mt-2 min-h-11 rounded-lg border border-blue px-4 text-sm font-semibold text-link hover:bg-beige disabled:opacity-50">Undo deletion</button> : null}{notice.binLink && <Link to="/bin" onClick={()=>setNotice(null)} className="mt-2 ml-3 inline-block text-sm font-medium text-link underline">View Bin</Link>}{notice.taskLink && <Link to="/tasks" onClick={()=>setNotice(null)} className="mt-1 inline-block text-sm font-medium text-link underline underline-offset-2">View in All tasks</Link>}</div><button onClick={()=>setNotice(null)} aria-label="Dismiss notification" className="rounded px-2 text-xl text-link">×</button></div>}
    </div>
    {reloadOpen && <ConfirmTaskDialog title="Reload your saved planner?" message="Unsaved changes on this page will be discarded. Your saved tasks will stay safe." confirmLabel="Reload saved version" onCancel={()=>setReloadOpen(false)} onConfirm={()=>{pending.current=null;window.location.reload()}}/>}
    <span role="status" className="sr-only">{saving?'Saving planner changes…':syncing?'Syncing your planner…':error?'Planner changes not saved.':'Planner saved.'}</span>
  </SpacesContext.Provider>
}
