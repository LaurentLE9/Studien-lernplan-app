# KAN-131 – Kostenfreie Integrationsverträge

Stand: 2026-09-04

Dieses Dokument definiert den minimalen, kostenfreien Integrationsumfang für den
n8n-PoC. Es ist ein technischer Vertrag und keine Freigabe zur Einrichtung oder
Erweiterung produktiver Credentials.

## Vertragsübersicht

| System | PoC-Nutzung | Minimaler Zugriff | Writes | Kostenpflichtige API |
| --- | --- | --- | --- | --- |
| GitHub | signiertes `workflow_run`-Ereignis und Repository-Metadaten | Repository-Metadaten lesen | keine | nein |
| Jira | CI-Nachweis am validierten Vorgang | Vorgang lesen, Kommentar schreiben | definierter Kommentar | nein |
| Confluence | bestehende Prozess-/Projektseite prüfen und kommentieren | Seite lesen, Footer-Kommentar schreiben | definierter Kommentar | nein |
| Supabase | isolierte Testdaten für Validierung lesen | Testdaten lesen | keine | nein |

Die Integrationen verwenden keine kostenpflichtigen Connectoren und keine
LLM-Aufrufe. Secrets werden ausschließlich über den jeweiligen serverseitigen
Credential-Store beziehungsweise Environment-Variablen eingebracht.

## Ablauf und Grenzen

1. GitHub liefert nur signierte, abgeschlossene `workflow_run`-Ereignisse des
   erwarteten Repositorys. Fork-Ursprünge und unbekannte Ereignisse werden
   abgewiesen.
2. Die Delivery-ID wird vor der Weiterleitung persistent und atomar reserviert.
   Eine Wiederholung derselben Delivery erzeugt keinen zweiten Jira-Write.
3. Der Jira-Write erfolgt nur nach erfolgreicher Jira-Key-Validierung und enthält
   ausschließlich Status, Run-URL, Commit-SHA und die Null-KI-Metrik.
4. Confluence-Writes sind auf die definierte bestehende Dokumentationsseite und
   einen strukturierten Footer-Kommentar begrenzt. Neue Seiten werden im PoC
   nicht automatisch angelegt.
5. Supabase bleibt read-only und auf isolierte Testdaten begrenzt. Service-Role,
   RLS-, Auth- oder Berechtigungsänderungen sind ausgeschlossen.

## Fehler, Rate Limits und Wiederholung

Die Bridge behandelt HTTP 408, 425, 429 sowie 5xx als potenziell temporär und
verwendet exponentiellen Backoff mit Obergrenze. Andere 4xx-Fehler sind
deterministisch und nicht automatisch zu wiederholen. Nach erschöpften Versuchen
endet der Lauf kontrolliert als `failed` oder `escalate`; es gibt keine
unkontrollierten Folgeaktionen.

Idempotenzschlüssel werden aus den fachlich stabilen Ereignisfeldern gebildet:

- GitHub: Delivery-ID
- Jira: Delivery-ID und Commit-SHA
- Confluence: Seiten-ID und Versionsnummer
- Supabase: read-only, kein Write-Schlüssel erforderlich

Auditdaten dürfen nur Zeit, Zielsystem, Ergebnis, Statuscode, Lauf-ID,
Idempotenz-Ergebnis und Dauer enthalten. Tokens, Authorization-Header, Cookies,
Payloads mit personenbezogenen Daten und Service-Keys sind ausgeschlossen.

## Implementierungsnachweis

Die maschinenlesbaren Verträge und die deterministischen Retry-/Idempotenz-
Hilfsfunktionen liegen in `ops/n8n/integration-contracts.mjs`. Die bestehende
GitHub-CI-zu-Jira-Workflowdefinition und der isolierte Webhook-Verifier bleiben
die ausführbare PoC-Route; ihre Secret- und Duplikatschutzregeln werden durch
`src/test/n8n-integration-contracts.test.js` gegen diesen Vertrag geprüft.
