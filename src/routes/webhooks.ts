import { Router, type Request, type Response } from 'express';
import { storeEvent } from '../db.js';
import { notifyHa } from '../ha.js';
import { processSonarr } from '../processors/sonarr.js';
import { processRadarr } from '../processors/radarr.js';
import { processProwlarr } from '../processors/prowlarr.js';
import { processSabnzbd } from '../processors/sabnzbd.js';
import { processQbittorrent } from '../processors/qbittorrent.js';

const router = Router();

type Processor = (payload: Record<string, unknown>) => import('../db.js').LogEntry | null;

const SOURCES: Record<string, { user: string; pass: string; process: Processor }> = {
  sonarr:       { user: process.env.SONARR_WEBHOOK_USER ?? '',      pass: process.env.SONARR_WEBHOOK_PASS ?? '',      process: processSonarr },
  radarr:       { user: process.env.RADARR_WEBHOOK_USER ?? '',      pass: process.env.RADARR_WEBHOOK_PASS ?? '',      process: processRadarr },
  prowlarr:     { user: process.env.PROWLARR_WEBHOOK_USER ?? '',    pass: process.env.PROWLARR_WEBHOOK_PASS ?? '',    process: processProwlarr },
  sabnzbd:      { user: process.env.SABNZBD_WEBHOOK_USER ?? '',     pass: process.env.SABNZBD_WEBHOOK_PASS ?? '',     process: processSabnzbd },
  qbittorrent:  { user: process.env.QBITTORRENT_WEBHOOK_USER ?? '', pass: process.env.QBITTORRENT_WEBHOOK_PASS ?? '', process: processQbittorrent },
};

function checkAuth(req: Request, source: typeof SOURCES[string]): boolean {
  const authHeader = req.headers.authorization ?? '';
  if (!authHeader.startsWith('Basic ')) return false;
  const decoded = Buffer.from(authHeader.slice(6), 'base64').toString();
  const [user, pass] = decoded.split(':');
  return user === source.user && pass === source.pass;
}

router.post('/:source', (req: Request, res: Response) => {
  const { source } = req.params;
  const config = SOURCES[source];

  if (!config) {
    res.status(404).json({ error: 'Unknown source' });
    return;
  }

  if (!checkAuth(req, config)) {
    res.setHeader('WWW-Authenticate', 'Basic realm="logline"');
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const payload = req.body as Record<string, unknown>;
  let entry: import('../db.js').LogEntry | null = null;

  try {
    entry = config.process(payload);
    storeEvent(source, payload, entry);
  } catch (err) {
    console.error(`[webhook/${source}] processing error:`, (err as Error).message);
    storeEvent(source, payload, null);
  }

  if (entry) {
    notifyHa(entry.log_type);
  }

  res.status(200).json({ ok: true });
});

export default router;
