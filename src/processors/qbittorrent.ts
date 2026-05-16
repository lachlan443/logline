import type { LogEntry } from '../db.js';

export function processQbittorrent(payload: Record<string, unknown>): LogEntry | null {
  const eventType = payload.eventType as string;
  const name = payload.torrent_name as string | undefined;
  const eventLabel = payload.event as string | undefined;
  const now = new Date().toISOString();

  if (eventType === 'added') {
    return { ts: now, app: 'qBittorrent', level: 'INFO', message: `${eventLabel ?? 'Torrent Added'} - ${name}`, log_type: 'media_downloads_log' };
  }

  if (eventType === 'completed') {
    return { ts: now, app: 'qBittorrent', level: 'INFO', message: `${eventLabel ?? 'Download Complete'} - ${name}`, log_type: 'media_downloads_log' };
  }

  return null;
}
