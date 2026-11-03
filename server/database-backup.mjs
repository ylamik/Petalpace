import { DatabaseSync, backup } from 'node:sqlite'
import { existsSync, mkdirSync, openSync, closeSync, unlinkSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
export async function copyDatabase(source, destination) {
  source = resolve(source); destination = resolve(destination)
  if (!existsSync(source) || source === destination) throw new Error('Choose an existing source and a different, new destination.')
  mkdirSync(dirname(destination), { recursive: true })
  // Never overwrite a live database or an existing backup.
  const reservation = openSync(destination, 'wx', 0o600); closeSync(reservation)
  let db
  try {
    db = new DatabaseSync(source, { readOnly: true })
    if (db.prepare('PRAGMA quick_check').get().quick_check !== 'ok') throw new Error('Source database integrity check failed.')
    await backup(db, destination)
    const check = new DatabaseSync(destination, { readOnly: true })
    try {
      if (check.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok' || check.prepare('PRAGMA foreign_key_check').all().length) throw new Error('Backup integrity check failed.')
    } finally { check.close() }
  } catch (error) { unlinkSync(destination); throw error }
  finally { db?.close() }
  return destination
}
