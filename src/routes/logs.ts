import { Router, type Request, type Response } from 'express';
import { getLogs } from '../db.js';

const router = Router();

const VALID_LOG_TYPES = new Set(['media_log', 'media_downloads_log', 'media_other_log']);

router.get('/:log_type', (req: Request, res: Response) => {
  const { log_type } = req.params;
  if (!VALID_LOG_TYPES.has(log_type)) {
    res.status(404).json({ error: 'Unknown log type' });
    return;
  }

  const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
  const data = getLogs(log_type, limit);
  res.json({ data });
});

export default router;
