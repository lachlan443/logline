import type { LogEntry } from '../db.js';

export function processRadarr(payload: Record<string, unknown>): LogEntry | null {
  const et = payload.eventType as string;
  const now = new Date().toISOString();

  const INDEXER_TYPES = ['IndexerStatusCheck', 'IndexerRssCheck', 'IndexerSearchCheck', 'IndexerJackettAllCheck', 'IndexerLongTermStatusCheck'];

  let level: LogEntry['level'];
  let log_type: string;
  let message: string;

  const movie = payload.movie as Record<string, unknown> | undefined;

  if (et === 'Grab') {
    const release = payload.release as Record<string, unknown>;
    level = 'INFO';
    log_type = 'media_downloads_log';
    message = `Grabbed ${movie!.title} (${movie!.year}) (${release.quality}) and sent to ${payload.downloadClient} (${((release.size as number) / 1073741824).toFixed(2)} GB)`;

  } else if (et === 'Download') {
    const movieFile = payload.movieFile as Record<string, unknown>;
    level = 'INFO';
    log_type = 'media_downloads_log';
    message = `Plex Import Completed - ${movie!.title} (${movie!.year}) (${movieFile.quality})`;

  } else if (et === 'MovieFileDelete') {
    level = 'INFO';
    log_type = 'media_downloads_log';
    message = `Deleted ${movie!.title} (${movie!.year}) (Reason: ${payload.deleteReason})`;

  } else if (et === 'MovieAdded') {
    const tags = (movie!.tags as string[]) ?? [];
    const source = tags.includes('kometa') ? ' via kometa' : tags.includes('pulsarr') ? ' via pulsarr' : '';
    level = 'INFO';
    log_type = 'media_log';
    message = `Added ${movie!.title} (${movie!.year})${source}`;

  } else if (et === 'MovieDelete') {
    level = 'INFO';
    log_type = 'media_log';
    const kept = !(payload.deletedFiles as boolean);
    message = `Deleted ${movie!.title} (${movie!.year})${kept ? ' (files kept on disk)' : ' (files removed from disk)'}`;

  } else if (et === 'ManualInteractionRequired') {
    const msgs = payload.downloadStatusMessages as Record<string, unknown>[];
    const detail = ((msgs[1]?.messages as string[]) ?? (msgs[0]?.messages as string[]))[0];
    level = 'ERROR';
    log_type = 'media_other_log';
    message = `Manual Interaction Required for ${movie!.title} (${movie!.year}) - ${detail}`;

  } else if (et === 'Health') {
    const type = payload.type as string;
    if (INDEXER_TYPES.includes(type)) return null;
    level = (payload.level as string) === 'error' ? 'ERROR' : 'WARN';
    log_type = 'media_other_log';
    message = `Health: ${payload.message}`;

  } else if (et === 'HealthRestored') {
    const type = payload.type as string;
    if (INDEXER_TYPES.includes(type)) return null;
    level = 'INFO';
    log_type = 'media_other_log';
    message = `HealthRestored: ${payload.message}`;

  } else if (et === 'Test') {
    level = 'INFO';
    log_type = 'media_other_log';
    message = 'Test Payload Received';

  } else {
    level = 'WARN';
    log_type = 'media_other_log';
    message = `Event type "${et}" not handled.`;
  }

  return { ts: now, app: 'Radarr', level, message, log_type };
}
