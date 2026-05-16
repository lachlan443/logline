import express from 'express';
import { registerAll } from './register.js';
import webhookRouter from './routes/webhooks.js';
import logsRouter from './routes/logs.js';

const PORT = parseInt(process.env.PORT ?? '5959');

const app = express();
app.use(express.json());

app.use('/webhook', webhookRouter);
app.use('/logs', logsRouter);

app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`[server] listening on :${PORT}`);
  registerAll();
});
