const clients = new Map()
export function registerSSE(keys, res, valid = () => true) {
  keys = Array.isArray(keys) ? keys : [keys]
  if ((clients.get(keys[0])?.size || 0) >= 10) { res.writeHead(429); res.end(); return }
  res.writeHead(200, {'Content-Type':'text/event-stream','Cache-Control':'no-store','Connection':'keep-alive','X-Accel-Buffering':'no'})
  res.write(': connected\n\n')
  for (const key of keys) { if (!clients.has(key)) clients.set(key,new Set()); clients.get(key).add(res) }
  const ping=setInterval(()=>{ try{if (!valid() || res.destroyed) res.end(); else res.write(': ping\n\n')}catch{res.end()} },15000)
  ping.unref()
  res.on('close',()=>{clearInterval(ping);for(const key of keys){const set=clients.get(key);set?.delete(res);if(!set?.size)clients.delete(key)}})
}
export function notifyPlannerChanged(userId) {
  for(const res of clients.get(userId) || []) { if(!res.destroyed) res.write('event: planner-changed\ndata: {}\n\n') }
}
export function connectionCount(){return new Set([...clients.values()].flatMap(set=>[...set])).size}

export function closeStreams(){for(const res of new Set([...clients.values()].flatMap(set=>[...set])))res.end()}
