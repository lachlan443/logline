import type { LogEntry } from '../db.js';

export function processSabnzbd(payload: Record<string, unknown>): LogEntry | null {
  const event = payload.event as string;
  const category = String(payload.category ?? '').replace(/\n/g, ' ');
  const job = payload.job_name as string | undefined;
  const now = new Date().toISOString();

  let level: LogEntry['level'];
  let log_type: string;
  let message: string;

  if (['complete', 'pp', 'download'].includes(event)) {
    level = 'INFO';
    log_type = 'media_downloads_log';
    message = event === 'complete'
      ? `Job finished - ${job}`
      : event === 'pp'
        ? `Post-processing started - ${job}`
        : `Added NZB - ${job}`;

  } else if (event === 'failed') {
    level = 'ERROR';
    log_type = 'media_downloads_log';
    message = `Job Failed - ${category}`;

  } else if (event === 'pause_resume') {
    level = 'INFO';
    log_type = 'media_downloads_log';
    message = category;

  } else if (event === 'warning') {
    level = 'WARN';
    log_type = 'media_other_log';
    message = category;

  } else if (event === 'error') {
    level = 'ERROR';
    log_type = 'media_other_log';
    message = category;

  } else if (event === 'disk_full') {
    level = 'ERROR';
    log_type = 'media_other_log';
    message = `Disk Full - ${category}`;

  } else {
    level = 'WARN';
    log_type = 'media_other_log';
    message = `Event "${event}" not handled.`;
  }

  return { ts: now, app: 'SABnzbd', level, message, log_type };
}
