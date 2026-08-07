import { app, ipcMain } from 'electron'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js'
import { SCHEMA_SQL } from './schema'

const require = createRequire(import.meta.url)

let SQL: SqlJsStatic | null = null
let db: Database | null = null

function dbFilePath(): string {
  const dir = join(app.getPath('userData'), 'data')
  mkdirSync(dir, { recursive: true })
  return join(dir, 'zarniwoop.sqlite')
}

function persist(): void {
  if (!db) return
  const data = db.export()
  writeFileSync(dbFilePath(), Buffer.from(data))
}

export async function initDatabase(): Promise<void> {
  const wasmDir = join(require.resolve('sql.js'), '..')
  SQL = await initSqlJs({
    locateFile: (file) => join(wasmDir, file)
  })

  const path = dbFilePath()
  if (existsSync(path)) {
    db = new SQL.Database(readFileSync(path))
  } else {
    db = new SQL.Database()
  }

  db.run(SCHEMA_SQL)
  persist()
}

export function registerMemoryIpc(): void {
  ipcMain.handle('memory:search', (_event, query: string) => {
    if (!db) return []
    const q = String(query ?? '').trim()
    if (!q) return []

    const like = `%${q.replace(/%/g, '')}%`
    const stmt = db.prepare(
      `SELECT id, kind, title, body, created_at
       FROM memory_items
       WHERE title LIKE $q OR body LIKE $q
       ORDER BY created_at DESC
       LIMIT 50`
    )
    stmt.bind({ $q: like })
    const rows: Array<Record<string, unknown>> = []
    while (stmt.step()) {
      rows.push(stmt.getAsObject())
    }
    stmt.free()
    return rows
  })

  ipcMain.handle(
    'memory:upsert',
    (
      _event,
      item: { id?: string; kind: string; title: string; body: string }
    ) => {
      if (!db) return { ok: false }
      const id = item.id ?? crypto.randomUUID()
      const now = Date.now()
      db.run(
        `INSERT INTO memory_items (id, kind, title, body, created_at, updated_at)
         VALUES ($id, $kind, $title, $body, $now, $now)
         ON CONFLICT(id) DO UPDATE SET
           kind = excluded.kind,
           title = excluded.title,
           body = excluded.body,
           updated_at = excluded.updated_at`,
        {
          $id: id,
          $kind: item.kind,
          $title: item.title,
          $body: item.body,
          $now: now
        }
      )
      persist()
      return { ok: true, id }
    }
  )
}
