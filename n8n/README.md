# n8n infrastructure (KAN-110)

Diese Dateien bereiten die kostenfreie self-hosted n8n-Automatisierungsschicht vor.

## Voraussetzungen

- Ubuntu-VM auf dem in `docs/n8n/HOSTING_DECISION.md` festgelegten Free-Tier-Ziel
- Docker + Docker Compose Plugin
- TLS-fähiger Reverse Proxy vor n8n
- DNS-Name für `N8N_HOST`

## Installation

```bash
cd n8n
cp .env.example .env
# .env ausschließlich auf dem Server mit echten Werten befüllen
docker compose pull
docker compose up -d
docker compose ps
```

n8n bindet absichtlich nur an `127.0.0.1`; öffentlicher Zugriff erfolgt ausschließlich über den HTTPS-Reverse-Proxy.

## Verifikation

```bash
docker compose ps
docker compose logs --tail=100 n8n
curl -fsS http://127.0.0.1:5678/healthz
```

Von extern muss anschließend ausschließlich die HTTPS-Adresse erreichbar sein.

## Backup

Vor Updates:

```bash
docker compose stop n8n
docker run --rm \
  -v n8n_n8n_data:/data:ro \
  -v "$PWD/backups:/backup" \
  alpine sh -c 'cd /data && tar czf /backup/n8n-data-$(date +%Y%m%d-%H%M%S).tgz .'
docker compose start n8n
```

Backup-Dateien nicht ins Repository committen.

## Restore-Test

Restore immer zuerst in einer isolierten Testinstanz durchführen. Der produktive Datenträger wird erst ersetzt, wenn Integrität und Startfähigkeit bestätigt wurden.

## Update

1. Backup erstellen.
2. Zielversion explizit in `.env` setzen.
3. `docker compose pull`.
4. `docker compose up -d`.
5. Healthcheck und PoC-Workflow ausführen.
6. Bei Fehlern auf vorherige Version zurückrollen und Backup verwenden.

## Noch nicht erledigt

Die Dateien erzeugen noch keine externe VM und legen keine Zugangsdaten an. Das Deployment benötigt Zugriff auf den ausgewählten Hostingaccount und wird in KAN-129 verifiziert.
