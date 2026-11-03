export function cleanupExpired(db, now = Date.now()) {
  db.prepare('DELETE FROM sessions WHERE expires <= ?').run(now)
  db.prepare('DELETE FROM auth_tokens WHERE expires <= ?').run(now)
  db.prepare('DELETE FROM auth_limits WHERE expires <= ?').run(now)
  db.prepare('UPDATE task_trash SET data=NULL WHERE data IS NOT NULL AND deleted_at<=?').run(now - 30 * 86400000)
}
