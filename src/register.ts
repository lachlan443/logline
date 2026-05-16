import { getRegistration, setRegistration } from './db.js';

const BASE_URL = process.env.LOGLINE_URL ?? 'http://logline:5959';

interface ArrApp {
  name: string;
  url: string;
  apiKey: string;
  apiVersion: 'v1' | 'v3';
  webhookPath: string;
  webhookUser: string;
  webhookPass: string;
}

const apps: ArrApp[] = [
  {
    name: 'Sonarr',
    url: process.env.SONARR_URL ?? 'http://sonarr:8989',
    apiKey: process.env.SONARR_API_KEY ?? '',
    apiVersion: 'v3',
    webhookPath: '/webhook/sonarr',
    webhookUser: process.env.SONARR_WEBHOOK_USER ?? 'sonarr',
    webhookPass: process.env.SONARR_WEBHOOK_PASS ?? '',
  },
  {
    name: 'Radarr',
    url: process.env.RADARR_URL ?? 'http://radarr:7878',
    apiKey: process.env.RADARR_API_KEY ?? '',
    apiVersion: 'v3',
    webhookPath: '/webhook/radarr',
    webhookUser: process.env.RADARR_WEBHOOK_USER ?? 'radarr',
    webhookPass: process.env.RADARR_WEBHOOK_PASS ?? '',
  },
  {
    name: 'Prowlarr',
    url: process.env.PROWLARR_URL ?? 'http://prowlarr:9696',
    apiKey: process.env.PROWLARR_API_KEY ?? '',
    apiVersion: 'v1',
    webhookPath: '/webhook/prowlarr',
    webhookUser: process.env.PROWLARR_WEBHOOK_USER ?? 'prowlarr',
    webhookPass: process.env.PROWLARR_WEBHOOK_PASS ?? '',
  },
];

async function getEventFlags(apiBase: string, headers: Record<string, string>): Promise<Record<string, boolean>> {
  const res = await fetch(`${apiBase}/notification/schema`, { headers });
  if (!res.ok) throw new Error(`schema: ${res.status} ${res.statusText}`);

  const schemas = await res.json() as Array<Record<string, unknown>>;
  const webhook = schemas.find(s => s.implementation === 'Webhook');
  if (!webhook) throw new Error('Webhook implementation not found in schema');

  const SKIP = new Set(['id', 'name', 'implementation', 'implementationName', 'configContract', 'infoLink', 'message', 'tags']);
  const flags: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(webhook)) {
    if (key.startsWith('supportsOn') && value === true) {
      flags['on' + key.slice('supportsOn'.length)] = true;
    } else if (typeof value === 'boolean' && !key.startsWith('supports') && !SKIP.has(key)) {
      flags[key] = true;
    }
  }
  return flags;
}

async function upsertNotification(app: ArrApp): Promise<void> {
  const headers = { 'X-Api-Key': app.apiKey, 'Content-Type': 'application/json' };
  const apiBase = `${app.url}/api/${app.apiVersion}`;
  const expectedUrl = `${BASE_URL}${app.webhookPath}`;
  const stored = getRegistration(app.name);

  let existingId: number | null = null;

  if (stored) {
    const checkRes = await fetch(`${apiBase}/notification/${stored.notification_id}`, { headers });
    if (checkRes.ok) {
      if (stored.url === expectedUrl) {
        console.log(`[register] ${app.name}: up to date (id=${stored.notification_id}), skipping`);
        return;
      }
      existingId = stored.notification_id;
    } else if (checkRes.status !== 404) {
      throw new Error(`check: ${checkRes.status} ${checkRes.statusText}`);
    }
    // 404: our notification was deleted, fall through to POST
  } else {
    // No DB record — check for a name conflict before creating
    const listRes = await fetch(`${apiBase}/notification`, { headers });
    if (!listRes.ok) throw new Error(`list: ${listRes.status} ${listRes.statusText}`);
    const all = await listRes.json() as Array<{ id: number; name: string }>;
    if (all.some(n => n.name === 'Logline')) {
      console.warn(`[register] ${app.name}: a "Logline" notification already exists but is not managed by us — remove it manually to allow registration`);
      return;
    }
  }

  const eventFlags = await getEventFlags(apiBase, headers);

  const body = JSON.stringify({
    name: 'Logline',
    implementation: 'Webhook',
    configContract: 'WebhookSettings',
    fields: [
      { name: 'url', value: expectedUrl },
      { name: 'method', value: 1 },
      { name: 'username', value: app.webhookUser },
      { name: 'password', value: app.webhookPass },
    ],
    ...eventFlags,
    ...(existingId ? { id: existingId } : {}),
  });

  const method = existingId ? 'PUT' : 'POST';
  const url = existingId ? `${apiBase}/notification/${existingId}` : `${apiBase}/notification`;

  const res = await fetch(url, { method, headers, body });
  if (!res.ok) throw new Error(`${method}: ${res.status} ${res.statusText}`);

  const result = await res.json() as { id: number };
  setRegistration(app.name, result.id, expectedUrl);
  console.log(`[register] ${app.name}: ${existingId ? 'updated' : 'created'} webhook notification (id=${result.id})`);
}

export async function registerAll(): Promise<void> {
  for (const app of apps) {
    if (!app.apiKey) {
      console.warn(`[register] ${app.name}: no API key configured, skipping`);
      continue;
    }
    try {
      await upsertNotification(app);
    } catch (err) {
      console.warn(`[register] ${app.name}: failed — ${(err as Error).message}`);
    }
  }
}
