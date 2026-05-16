const HA_URL = process.env.HA_URL ?? 'http://homeassistant:8123';
const HA_TOKEN = process.env.HA_TOKEN ?? '';

const LOG_TYPE_ENTITIES: Record<string, string[]> = {
  media_log:            ['sensor.media_log'],
  media_downloads_log:  ['sensor.media_downloads_log'],
  media_other_log:      ['sensor.media_other_log'],
};

export function notifyHa(logType: string): void {
  if (!HA_TOKEN) return;
  const entity_id = LOG_TYPE_ENTITIES[logType];
  if (!entity_id) return;

  fetch(`${HA_URL}/api/services/homeassistant/update_entity`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${HA_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ entity_id }),
  }).catch(err => console.warn('[ha] update_entity failed:', (err as Error).message));
}
