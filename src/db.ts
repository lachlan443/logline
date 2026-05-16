import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = process.env.DB_PATH ?? path.join('/config', 'logline.db');

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS raw_events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    received_at TEXT NOT NULL DEFAULT (datetime('now')),
    source      TEXT NOT NULL,
    payload     TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS log_entries (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    ts           TEXT NOT NULL,
    app          TEXT NOT NULL,
    level        TEXT NOT NULL,
    message      TEXT NOT NULL,
    log_type     TEXT NOT NULL,
    raw_event_id INTEGER NOT NULL REFERENCES raw_events(id)
  );

  CREATE INDEX IF NOT EXISTS idx_log_entries_log_type_ts
    ON log_entries(log_type, ts DESC);

  CREATE TABLE IF NOT EXISTS registrations (
    app             TEXT PRIMARY KEY,
    notification_id INTEGER NOT NULL,
    url             TEXT NOT NULL,
    registered_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

export interface LogEntry {
  ts: string;
  app: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
  log_type: string;
}

const insertRawEvent = db.prepare<[string, string]>(
  'INSERT INTO raw_events (source, payload) VALUES (?, ?) RETURNING id'
);

const insertLogEntry = db.prepare<[string, string, string, string, string, number]>(
  'INSERT INTO log_entries (ts, app, level, message, log_type, raw_event_id) VALUES (?, ?, ?, ?, ?, ?)'
);

const selectLogs = db.prepare<[string, number], { ts: string; app: string; level: string; message: string }>(
  'SELECT ts, app, level, message FROM log_entries WHERE log_type = ? ORDER BY ts DESC LIMIT ?'
);

export function storeEvent(source: string, payload: unknown, entry: LogEntry | null): void {
  const raw = insertRawEvent.get(source, JSON.stringify(payload)) as { id: number };
  if (entry) {
    insertLogEntry.run(entry.ts, entry.app, entry.level, entry.message, entry.log_type, raw.id);
  }
}

export function getLogs(logType: string, limit = 10): string[] {
  const rows = selectLogs.all(logType, limit);
  return rows.reverse().map(r => JSON.stringify({ ts: r.ts.replace('Z', '+00:00'), app: r.app, level: r.level, message: r.message }));
}

const getRegistrationStmt = db.prepare<[string], { notification_id: number; url: string }>(
  'SELECT notification_id, url FROM registrations WHERE app = ?'
);

const upsertRegistrationStmt = db.prepare<[string, number, string]>(
  `INSERT INTO registrations (app, notification_id, url) VALUES (?, ?, ?)
   ON CONFLICT(app) DO UPDATE SET notification_id = excluded.notification_id, url = excluded.url, registered_at = datetime('now')`
);

export function getRegistration(app: string): { notification_id: number; url: string } | null {
  return getRegistrationStmt.get(app) ?? null;
}

export function setRegistration(app: string, notificationId: number, url: string): void {
  upsertRegistrationStmt.run(app, notificationId, url);
}
