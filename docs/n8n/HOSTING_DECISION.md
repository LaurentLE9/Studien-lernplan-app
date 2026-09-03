# KAN-132 – Hostingentscheidung für n8n

Stand: 2026-09-03

## Entscheidung

Primärziel ist **Oracle Cloud Infrastructure (OCI) Always Free / Ampere A1** mit Ubuntu und Docker Compose.

Begründung:
- Oracle dokumentiert weiterhin Always-Free-Compute.
- Für Ampere A1 stehen im Always-Free-Rahmen insgesamt bis zu 2 OCPUs und 12 GB RAM zur Verfügung.
- Insgesamt 200 GB Always-Free Block-Volume-Speicher und fünf Volume-Backups sind dokumentiert.
- Persistenter Blockspeicher ist für n8n geeigneter als Free-Web-Services mit ephemerem Dateisystem.
- n8n Community Edition kann containerisiert self-hosted betrieben werden.

## Verworfene/sekundäre Alternativen

### Render Free
Nicht als primäres Ziel gewählt. Free Web Services schlafen nach Inaktivität ein; das lokale Dateisystem ist ephemer. Free Postgres hat eine begrenzte Lebensdauer. Das widerspricht dem Ziel eines dauerhaft belastbaren, persistenten n8n-Betriebs.

### Google Cloud Free Tier e2-micro
Als Exit-/Fallback-Weg dokumentiert. Google führt weiterhin eine e2-micro-Instanz im Free Tier. Für n8n ist das Ressourcenbudget aber deutlich knapper als OCI A1.

## Zielarchitektur

```text
Internet
  |
HTTPS 443
  |
Reverse Proxy / TLS
  |
n8n container
  |
persistentes Volume
```

Für den ersten Betrieb darf n8n SQLite auf persistentem Storage verwenden. Bei wachsender Last ist PostgreSQL der bevorzugte Migrationspfad.

## Kostenkontrolle

- Nur Ressourcen verwenden, die im OCI-Portal ausdrücklich als Always Free gekennzeichnet sind.
- Hauptregion beachten; Always-Free-Ressourcen sind regionsgebunden.
- Keine kostenpflichtigen Shapes, Volumes oder zusätzlichen Services anlegen.
- Kein Upgrade auf Pay-as-you-go im Rahmen von KAN-110 durchführen.
- Kostenstatus vor und nach Bereitstellung dokumentieren.
- Exit-Plan bereithalten, falls Free-Tier-Bedingungen geändert werden.

## Reproduzierbarkeit

Die Repository-Konfiguration unter `ops/n8n/` enthält:
- Docker-Compose-Basis
- Environment-Template ohne Secrets
- persistente Volumes
- dokumentierten externen HTTP-Healthcheck (kein Docker-Compose-`healthcheck`)
- Caddy-Konfiguration für HTTPS
- isolierten GitHub-Webhook-Verifier
- versionierten PoC-Workflow

Die ausführliche Betriebs- und Recovery-Dokumentation steht in
`docs/N8N_OCI_FREE_TIER.md`.

## Verifizierter Betrieb

Die OCI-Always-Free-Instanz wurde bereitgestellt und der Grundbetrieb unter
KAN-129 verifiziert. Nachgewiesen sind HTTPS-Erreichbarkeit, Zugriffsschutz,
ein externer HTTP-Healthcheck, kontrollierter Neustart, Workflow-Persistenz,
Backup/Restore, Monitoring sowie bestätigter E-Mail-Transport der
OCI-Alarmierung. Innerhalb der verwendeten Always-Free-Ressourcen entstehen
keine laufenden Hostingkosten.
