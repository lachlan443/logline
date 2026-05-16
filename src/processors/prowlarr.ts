import type { LogEntry } from '../db.js';

export function processProwlarr(payload: Record<string, unknown>): LogEntry | null {
  const et = payload.eventType as string;
  const now = new Date().toISOString();

  const INDEXER_TYPES = ['IndexerStatusCheck', 'IndexerRssCheck', 'IndexerSearchCheck', 'IndexerJackettAllCheck', 'IndexerLongTermStatusCheck'];

  if (et === 'Health') {
    const type = payload.type as string;
    if (INDEXER_TYPES.includes(type)) return null;
    const level: LogEntry['level'] = (payload.level as string) === 'error' ? 'ERROR' : 'WARN';
    return { ts: now, app: 'Prowlarr', level, message: `Health: ${payload.message}`, log_type: 'media_other_log' };
  }

  if (et === 'HealthRestored') {
    const type = payload.type as string;
    if (INDEXER_TYPES.includes(type)) return null;
    return { ts: now, app: 'Prowlarr', level: 'INFO', message: `HealthRestored: ${payload.message}`, log_type: 'media_other_log' };
  }

  if (et === 'Test') {
    return { ts: now, app: 'Prowlarr', level: 'INFO', message: 'Test Payload Received', log_type: 'media_other_log' };
  }

  return null;
}
