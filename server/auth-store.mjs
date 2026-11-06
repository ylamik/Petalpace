import { DatabaseSync } from 'node:sqlite'

export function createAuthStore(path = ':memory:') {
  const db = new DatabaseSync(path)
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
      password_hash TEXT NOT NULL, verified INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS sessions (
      hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS auth_tokens (
      hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      purpose TEXT NOT NULL, expires INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS auth_limits (
      key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS auth_limits_expires ON auth_limits(expires);
    CREATE TABLE IF NOT EXISTS profile_photos (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      image BLOB NOT NULL, version TEXT NOT NULL
    );
    -- ── Collaboration ──────────────────────────────────────────────────
    -- A shared task lives outside the personal planner.
    CREATE TABLE IF NOT EXISTS collab_tasks (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      priority TEXT NOT NULL DEFAULT 'Medium',
      due_date TEXT NOT NULL DEFAULT '',
      due_time TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'todo',
      color TEXT NOT NULL DEFAULT '#BCDCF1',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    -- Members of a shared task. role: 'owner' | 'member'
    CREATE TABLE IF NOT EXISTS collab_members (
      task_id TEXT NOT NULL REFERENCES collab_tasks(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'member',
      joined_at INTEGER NOT NULL,
      PRIMARY KEY (task_id, user_id)
    );
    -- Subtasks inside a shared task
    CREATE TABLE IF NOT EXISTS collab_subtasks (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES collab_tasks(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 0,
      assigned_to TEXT REFERENCES users(id) ON DELETE SET NULL,
      position INTEGER NOT NULL DEFAULT 0
    );
    -- File attachments on a shared task (stored as base64, same as planner)
    CREATE TABLE IF NOT EXISTS collab_files (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES collab_tasks(id) ON DELETE CASCADE,
      name TEXT NOT NULL, type TEXT NOT NULL,
      data TEXT NOT NULL, last_modified INTEGER NOT NULL DEFAULT 0
    );
    -- Links on a shared task
    CREATE TABLE IF NOT EXISTS collab_links (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES collab_tasks(id) ON DELETE CASCADE,
      url TEXT NOT NULL
    );
    -- Invite tokens (email → accept link → join task)
    CREATE TABLE IF NOT EXISTS collab_invites (
      token_hash TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES collab_tasks(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires INTEGER NOT NULL
    );
  `)
  // Additive migrations preserve existing accounts and shared work.
  for(const [table,column,definition] of [
    ['collab_tasks','revision','INTEGER NOT NULL DEFAULT 0'],
    ['collab_tasks','due_zone',"TEXT NOT NULL DEFAULT 'UTC'"],
    ['collab_tasks','assigned_to','TEXT'],
    ['collab_invites','permission',"TEXT NOT NULL DEFAULT 'steps'"],
    ['collab_files','subtask_id','TEXT'],
    ['collab_subtasks','notes',"TEXT NOT NULL DEFAULT ''"],
    ['collab_subtasks','links',"TEXT NOT NULL DEFAULT '[]'"],
    ['collab_subtasks','status',"TEXT NOT NULL DEFAULT 'todo'"]
  ]) { if(!db.prepare(`PRAGMA table_info(${table})`).all().some(c=>c.name===column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`) }
  db.exec("UPDATE collab_subtasks SET status='done' WHERE done=1 AND status<>'done'")
  return db
}
