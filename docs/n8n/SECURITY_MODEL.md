# KAN-128 – n8n Sicherheits-, Secret- und Berechtigungskonzept

Stand: 2026-08-28

## Grundsätze

- Least Privilege für jede Integration.
- Keine Secrets im Repository, Workflow-Export, Jira, Confluence oder Clientcode.
- Produktions- und Testzugänge strikt trennen.
- Schreibzugriffe nur dort aktivieren, wo der jeweilige Workflow sie benötigt.
- Auth-, Session-, RLS-, Rollen- und Berechtigungsänderungen benötigen menschliche Freigabe.

## Trust Boundaries

1. Öffentliches Internet ↔ Reverse Proxy
2. Reverse Proxy ↔ n8n
3. n8n ↔ GitHub
4. n8n ↔ Jira/Confluence
5. n8n ↔ Supabase
6. n8n ↔ persistenter Datenträger / Backup

## Secrets

Erforderliche Secrets werden ausschließlich als Server-Environment/Credential-Store eingebracht. Beispiele:
- GitHub Token/App Credential
- Atlassian API Credential
- Supabase Server-Credential für den konkret benötigten Scope
- n8n Encryption Key

Regeln:
- keine `VITE_`-Variable für Server-Secrets
- keine Werte in `.env.example`
- Rotation nach Verdacht auf Offenlegung
- Widerruf vor Löschung/Stilllegung einer Integration
- Backup des n8n-Credential-Stores nur verschlüsselt und zusammen mit passendem Encryption Key nach gesichertem Verfahren

## Integrationsrechte

### GitHub
PoC: Repository-Metadaten und Commit/Status lesen; Schreibrecht nur für explizit benötigte Kommentare/Statusaktionen. Kein Admin-, Secret- oder Repository-Delete-Recht.

### Jira/Confluence
PoC: konkreten Vorgang lesen und definierte Kommentare/Statusänderungen schreiben. Keine globale Administration.

### Supabase
Default read-only gegen isolierte Testdaten. Keine Service-Role im Browser. Änderungen an RLS/Auth/Berechtigungen sind nicht automatisiert freigegeben.

## Webhooks

- nur HTTPS
- zufälliges Secret bzw. signierte Requests
- Replay-/Duplikatschutz über Run-ID + Commit-SHA/Jira-Key
- Payload-Schema validieren
- unbekannte Felder ignorieren oder Request ablehnen
- keine Secrets in Fehlerantworten

## Logging

Erlaubt: Zeit, Workflow-ID, Run-ID, Zielsystem, Resultat, Statuscode, Dauer, anonymisierte Metriken.

Nicht erlaubt: Access Tokens, Refresh Tokens, Cookies, Authorization Header, vollständige personenbezogene Nutzdaten, Supabase Service Keys.

## Recovery

- kontrollierter Container-Neustart
- persistentes Volume sichern
- Restore regelmäßig in isolierter Umgebung testen
- n8n-Versionen pinnen und Updates kontrolliert durchführen
- bei kompromittiertem Credential: widerrufen → neu ausstellen → n8n-Credential aktualisieren → Audit durchführen
