import { upsertLogEntry } from './db.js';
import { processSonarr } from './processors/sonarr.js';
import { processRadarr } from './processors/radarr.js';
import { processProwlarr } from './processors/prowlarr.js';
import { processSabnzbd } from './processors/sabnzbd.js';
import { processQbittorrent } from './processors/qbittorrent.js';
import Database from 'better-sqlite3';
import path from 'path';
import type { LogEntry } from './db.js';

const DB_PATH = process.env.DB_PATH ?? path.join('/config', 'logline.db');
const db = new Database(DB_PATH);

const processors: Record<string, (payload: Record<string, unknown>) => LogEntry | null> = {
  sonarr:       processSonarr,
  radarr:       processRadarr,
  prowlarr:     processProwlarr,
  sabnzbd:      processSabnzbd,
  qbittorrent:  processQbittorrent,
};

const rawEvents = db.prepare<[], { id: number; source: string; payload: string; received_at: string }>(
  'SELECT id, source, payload, received_at FROM raw_events ORDER BY id ASC'
).all();

const reprocess = db.transaction(() => {
  let reprocessed = 0;
  let skipped = 0;
  let nulled = 0;

  for (const row of rawEvents) {
    const processor = processors[row.source];
    if (!processor) {
      skipped++;
      continue;
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(row.payload);
    } catch {
      console.warn(`[backfill] Failed to parse payload for raw_event ${row.id}, skipping`);
      skipped++;
      continue;
    }

    const entry = processor(payload);
    if (entry) {
      // Preserve original received_at as ts; created_at stays untouched on update, updated_at bumps
      upsertLogEntry.run(row.received_at, entry.app, entry.level, entry.message, entry.log_type, row.id);
      reprocessed++;
    } else {
      nulled++;
    }
  }

  return { reprocessed, skipped, nulled };
});

console.log(`[backfill] Processing ${rawEvents.length} raw events...`);
const result = reprocess();
console.log(`[backfill] Done. reprocessed=${result.reprocessed} nulled=${result.nulled} skipped=${result.skipped}`);
