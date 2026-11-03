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
    CREATE TABLE IF NOT EXISTS profile_photos (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      image BLOB NOT NULL, version TEXT NOT NULL
    );
  `)
  return db
}
