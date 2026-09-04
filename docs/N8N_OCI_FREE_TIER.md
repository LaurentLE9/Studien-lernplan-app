# n8n auf OCI Always Free

## Entscheidung

Für das persönliche Lernprojekt wird n8n Community Edition auf einer OCI-
Always-Free-Compute-Instanz betrieben. Oracle beschreibt die Always-Free-
Ressourcen als unbegrenzt nutzbar; die 300-USD-Testguthaben sind davon getrennt
und laufen nach spätestens 30 Tagen ab. Die Entscheidung bedeutet 0 EUR
laufende Hostingkosten innerhalb der veröffentlichten Limits, aber keinen SLA.

Quellen (zuletzt geprüft am 28.08.2026):

- [OCI Always Free Resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)
- [OCI Free Tier FAQ](https://www.oracle.com/cloud/free/)
- [n8n Hosting-Dokumentation](https://docs.n8n.io/hosting/)
- [GitHub Repository Webhooks](https://docs.github.com/en/webhooks/using-webhooks/creating-webhooks)

## Grenzen und Gegenmaßnahmen

- Always-Free-Compute ist auf die veröffentlichten OCPU-, RAM-, Storage- und
  Netzwerkgrenzen beschränkt. Es darf nur eine als Always Free gekennzeichnete
  Ressource verwendet werden.
- Oracle kann freie Kapazität bei der Erstellung nicht verfügbar haben.
  Die Region wird deshalb bei der Kontoerstellung bewusst gewählt und die
  Terraform-/Provisionierungsparameter werden versioniert dokumentiert.
- Oracle kann inaktive Always-Free-Compute-Instanzen zurückfordern. n8n wird
  deshalb mit Monitoring, täglichem Datenbank-/Volume-Backup und einem
  getesteten Wiederherstellungsablauf betrieben.
- Es gibt keinen SLA und nur Community-Support. OCI ist damit für Lernen und
  einen persönlichen PoC geeignet, nicht für geschäftskritische Verfügbarkeit.

## Sicherheitsbaseline

`ops/n8n/docker-compose.yml` veröffentlicht den n8n-Port nicht am Host. Ein
Reverse Proxy terminiert TLS; Port 5678 bleibt ausschließlich im privaten
Compose-Netz erreichbar.
Die Domain, der Image-Tag und der persistente `N8N_ENCRYPTION_KEY` werden nur
auf dem Server in `.env` gesetzt. `.env` und n8n-Credentials werden niemals in
Git, Client-Code, Jira oder Confluence gespeichert.

Vor dem ersten öffentlichen Betrieb sind zusätzlich abzuschließen:

1. OCI Security List/Network Security Group: nur SSH (mit Schlüssel) und
   HTTPS am Reverse Proxy erlauben.
2. TLS-Zertifikat und automatische Erneuerung einrichten.
3. OCI-Volume-Backup und Restore auf einer frischen Instanz testen.
4. n8n-Sicherheitsaudit (`n8n audit`) ausführen.
5. Image-Tag pinnen, Updates zunächst auf einer Kopie prüfen und danach mit
   `docker compose pull && docker compose up -d` ausrollen.

## Proof of Concept

Der isolierte Webhook-Verifier empfängt ein GitHub-`workflow_run`-Ereignis,
prüft dessen Signatur gegen die unveränderten Request-Bytes und leitet nur
abgeschlossene Läufe weiter, deren Basis- und Head-Repository der konfigurierten
Allowlist entsprechen. Der Workflow extrahiert anschließend den ersten
Jira-Key aus Branch oder Commit-Nachricht und beendet sich bei fehlendem Key
ohne Schreibzugriff.
Nur bei erfolgreicher Validierung wird ein strukturierter Jira-Kommentar mit
Run-URL, Ergebnis und Commit erzeugt. Alle Schritte sind regelbasiert; der PoC
ruft kein LLM und keine kostenpflichtige KI-API auf.

Das Webhook-Secret ist ausschließlich im Verifier-Container verfügbar. Der
n8n-Container erhält weder dieses Secret noch allgemeinen Zugriff auf
Umgebungsvariablen aus Code-Knoten. Jira-Token und n8n-API-Credentials werden
als n8n-Credentials bzw. Server-Secrets verwaltet. Exportierte Workflows werden
vor dem Commit auf Credential- und Secret-Inhalte geprüft.

## Messung der Einsparung

Für jeden PoC-Lauf werden mindestens GitHub-Run-ID, Jira-Key, Ergebnis,
Zeitstempel und `ai_calls=0` erfasst. Damit lässt sich gegenüber dem bisherigen
manuellen Codex-Statusnachweis die Zahl der entfallenen KI-Aufrufe zählen,
ohne Payloads oder Secrets zu protokollieren.

### Reproduzierbare Einrichtung

1. Auf dem OCI-Host `GITHUB_WEBHOOK_SECRET` und `N8N_ENCRYPTION_KEY` nur in
   der nicht versionierten `.env` setzen. `GITHUB_EXPECTED_REPOSITORY` aus
   dem Environment-Template auf das vertrauenswürdige Repository festlegen.
2. Das Compose-Setup reicht `GITHUB_WEBHOOK_SECRET` ausschließlich an den
   gehärteten `webhook-verifier`-Container durch. Caddy leitet nur den Pfad
   `/webhook/github-ci-to-jira` an diesen Dienst. Nach erfolgreicher HMAC-
   Prüfung wird der unveränderte JSON-Body intern an n8n weitergegeben. Andere
   öffentliche n8n-Webhook-Pfade werden durch Caddy blockiert.
3. `ops/n8n/workflows/github-ci-to-jira.json` in n8n importieren.
4. Einen Atlassian-API-Token mit Ablaufdatum und dem klassischen Scope
   `write:jira-work` erstellen. Im HTTP-Request-Knoten serverseitig das
   n8n-Basic-Auth-Credential `jiraApiToken` hinterlegen (Benutzername:
   Atlassian-Konto-E-Mail, Passwort: Token); niemals Tokenwerte exportieren
   oder committen. Der Workflow verwendet dafür den für Scoped Tokens
   vorgeschriebenen Endpoint `api.atlassian.com/ex/jira/<cloud-id>`.
5. Den GitHub-Webhook auf den n8n-Webhook-Endpunkt mit `workflow_run` und
   Secret konfigurieren. Der Workflow bleibt zunächst inaktiv, bis der
   Signatur-, gültige-Key- und fehlende-Key-Test erfolgreich durchgeführt sind.

Der Verifier reserviert jede GitHub-Delivery-ID atomar im persistenten
`verifier_data`-Volume. n8n antwortet erst nach seinem letzten ausgeführten
Knoten; nur ein erfolgreicher Jira-Pfad wird als abgeschlossen gespeichert.
Bei einem Upstream-Fehler wird die Reservierung für eine Wiederholung
freigegeben. Eine nach einem Prozessabbruch verbleibende `pending`-Datei darf
erst nach Prüfung des Jira-Nachweises manuell entfernt werden.

Die HMAC-Prüfung verwendet die unveränderten Request-Bytes im isolierten
Verifier; ein erneut serialisiertes JSON-Objekt ist für GitHub-Signaturen nicht
ausreichend. Von den signierten `workflow_run`-Lebenszyklusereignissen wird
ausschließlich `action=completed` an n8n und Jira weitergeleitet. `requested`,
`in_progress`, ungültige Signaturen und andere Ereignistypen enden ohne
Schreibzugriff.
