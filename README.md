> **WIP**

# logline

Watches your media stack and keeps a permanent record of everything it does.

Receives webhooks from Sonarr, Radarr, Prowlarr, SABnzbd, and qBittorrent. Stores the raw payload alongside a structured log entry in SQLite. Exposes a `/logs` endpoint that Home Assistant REST sensors can poll to display a live activity feed.

## Endpoints

- `POST /webhook/:source` — ingest events (Basic Auth per source)
- `GET /logs/:log_type?limit=10` — retrieve recent entries (`media_log`, `media_downloads_log`, `media_other_log`)

## Setup

Copy `.env.example` to `.env` and fill in credentials, then:

```bash
docker compose up -d
```

Sonarr, Radarr, and Prowlarr are registered automatically on startup.
