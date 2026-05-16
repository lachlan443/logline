import type { LogEntry } from '../db.js';

export function processSonarr(payload: Record<string, unknown>): LogEntry | null {
  const et = payload.eventType as string;
  const now = new Date().toISOString();

  const INDEXER_TYPES = ['IndexerStatusCheck', 'IndexerRssCheck', 'IndexerSearchCheck', 'IndexerJackettAllCheck', 'IndexerLongTermStatusCheck'];

  let level: LogEntry['level'];
  let log_type: string;
  let message: string;

  if (et === 'Grab') {
    const series = payload.series as Record<string, unknown>;
    const episodes = payload.episodes as Record<string, unknown>[];
    const release = payload.release as Record<string, unknown>;
    level = 'INFO';
    log_type = 'media_downloads_log';
    message = `Grabbed ${series.title} S${String(episodes[0].seasonNumber).padStart(2,'0')}E${String(episodes[0].episodeNumber).padStart(2,'0')} (${release.quality}) and sent to ${payload.downloadClient} (${((release.size as number) / 1073741824).toFixed(2)} GB)`;

  } else if (et === 'Download') {
    const episodeFiles = payload.episodeFiles as Record<string, unknown>[] | undefined;
    if (!episodeFiles || !('destinationPath' in (episodeFiles[0] ?? {}))) return null;
    const series = payload.series as Record<string, unknown>;
    const episodes = payload.episodes as Record<string, unknown>[];
    level = 'INFO';
    log_type = 'media_downloads_log';
    if (episodes.length > 1) {
      message = `Plex Import Completed: ${series.title} Season ${episodes[0].seasonNumber} (${episodes.length} episodes)`;
    } else {
      message = `Plex Import Completed: ${series.title} S${String(episodes[0].seasonNumber).padStart(2,'0')}E${String(episodes[0].episodeNumber).padStart(2,'0')} - ${episodes[0].title} (${(episodeFiles[0].quality as string)})`;
    }

  } else if (et === 'EpisodeFileDelete') {
    const series = payload.series as Record<string, unknown>;
    const episodes = payload.episodes as Record<string, unknown>[];
    level = 'INFO';
    log_type = 'media_downloads_log';
    message = `Deleted ${series.title} S${String(episodes[0].seasonNumber).padStart(2,'0')}E${String(episodes[0].episodeNumber).padStart(2,'0')} (Reason: ${payload.deleteReason})`;

  } else if (et === 'SeriesAdd') {
    const series = payload.series as Record<string, unknown>;
    const tags = (series.tags as string[]) ?? [];
    const source = tags.includes('kometa') ? ' via kometa' : tags.includes('pulsarr') ? ' via pulsarr' : '';
    level = 'INFO';
    log_type = 'media_log';
    message = `Added Series: ${series.title}${source}`;

  } else if (et === 'SeriesDelete') {
    const series = payload.series as Record<string, unknown>;
    level = 'INFO';
    log_type = 'media_log';
    const kept = !(payload.deletedFiles as boolean);
    message = `Deleted Series: ${series.title}${kept ? ' (files kept on disk)' : ' (files removed from disk)'}`;

  } else if (et === 'ManualInteractionRequired') {
    const series = payload.series as Record<string, unknown>;
    const episodes = payload.episodes as Record<string, unknown>[];
    const msgs = payload.downloadStatusMessages as Record<string, unknown>[];
    const detail = ((msgs[1]?.messages as string[]) ?? (msgs[0]?.messages as string[]))[0];
    level = 'ERROR';
    log_type = 'media_other_log';
    message = `Manual Interaction Required for ${series.title} S${String(episodes[0].seasonNumber).padStart(2,'0')}E${String(episodes[0].episodeNumber).padStart(2,'0')} - ${detail}`;

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

  return { ts: now, app: 'Sonarr', level, message, log_type };
}
