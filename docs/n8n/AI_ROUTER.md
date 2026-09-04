# KAN-127 – n8n-KI-Router, Budget und Metriken

## Ziel und Grenze

Der Router entscheidet vor jeder delegierten Teilaufgabe zwischen
`deterministic`, `cheap_model` und `codex`. Er ist ein interner Dienst im
Compose-Netz und wird nicht über Caddy veröffentlicht. Repository-Änderungen,
Architektur, Auth, Sessions, RLS, Secrets, Berechtigungen, Security,
Datenbankmigrationen, destruktive Aktionen, fehlender Kontext und
widersprüchliche Ergebnisse eskalieren immer an Codex.

Die Implementierung liegt in `ops/n8n/ai-router.mjs`. Der n8n-Workflow
`ops/n8n/workflows/task-router.json` ruft den Dienst über den normalisierten
Ergebnisvertrag auf. KAN-147 kann denselben internen Vertrag später für
Delegation und Progress verwenden, ohne Routinglogik zu duplizieren.

Vor diesem Aufgabenrouting erzwingt `ops/n8n/model-router.mjs` eine getrennte
Modellentscheidung für Luna, Terra und Sol. Der n8n-Workflow verwendet dafür
den Endpunkt `/controlled-execute`; der eigentliche Task-Executor wird erst
nach einem erfolgreichen `CONTINUE` aufgerufen. Das Gate akzeptiert sowohl die
Stufennamen als auch konfigurierte Modellbezeichner wie `gpt-5.6-luna` und
normalisiert sie vor der Entscheidung auf die jeweilige Stufe.

## Technisches Modell-Gate

Das Modell-Gate bewertet vor dem nächsten Arbeitsschritt Komponenten,
Abhängigkeiten, Komplexität, Debugging-Aufwand, Confidence, frühere Fehler,
widersprüchliche Ergebnisse sowie Architektur-, Security-, Auth-, Session-,
RLS-, Secret-, Berechtigungs-, Migrations- und Datenverlustrisiken.

Es kennt ausschließlich diese separaten Routingzustände:

- `CONTINUE`: Das aktuelle Modell erfüllt mindestens die benötigte Stufe.
- `MODEL_SWITCH_REQUIRED`: Der Executor wird nicht aufgerufen und der sichere
  Task-State unverändert für die Fortsetzung zurückgegeben.

Bei `MODEL_SWITCH_REQUIRED` enthält `userMessage` ausschließlich
`Jetzt brauchen wir Terra.` oder `Jetzt brauchen wir Sol.`. Die aufrufende
Codex-Bridge darf dem Benutzer in diesem Zustand keine weitere Erklärung oder
Ausgabe anhängen. Ein Wechsel auf Sol erfolgt nur für tatsächlich Sol-pflichtige
Architektur-, Security-, riskante Daten- oder wiederholt widersprüchliche
Fehlerfälle. Mittlere Komplexität verlangt höchstens Terra.

Die Loop-Zustände bleiben davon getrennt: `PASS`, `RETRY`, `ASK_USER`, `ABORT`.
`ASK_USER` wird nur nach bestandenem Modell-Gate für eine menschliche
Sachentscheidung verwendet. Ein Zustand `ESCALATE` gehört zu keinem dieser
beiden Verträge.

Der versionierte Task-State enthält nur freigegebene technische Felder. Felder
für Tokens, Passwörter, Secrets, Credentials, Cookies oder Authorization werden
vor Audit und Ausführung abgewiesen. Das Audit speichert nur Routingstatus,
aktuelle/benötigte Modellstufe, Grundkategorie, Jira-Key und State-Revision.
Ein erforderlicher manueller Modellwechsel erhöht zugleich die Metrik
`manualInterventions`.

## Eingabe

Eine Teilaufgabe enthält nur den minimal notwendigen Inhalt und die für die
Policy erforderlichen Metadaten:

```json
{
  "jobId": "eindeutige-id",
  "type": "summarization",
  "complexity": "low",
  "risk": "low",
  "readOnly": true,
  "contextComplete": true,
  "riskSignals": [],
  "instructions": "Kurze Zusammenfassung erzeugen",
  "content": "Minimal notwendiger Inhalt"
}
```

`containsSensitiveData`, `repositoryWrite`, `multipleDependentFiles`,
`destructive`, `conflictingResults` oder ein unvollständiger Kontext schließen
den günstigen Modellpfad aus. `contextComplete` und `readOnly` müssen für diesen
Pfad ausdrücklich `true` sein. Unbekannte beziehungsweise komplexe Typen
eskalieren standardmäßig.

## Ergebnisvertrag

```json
{
  "status": "completed|escalate|failed",
  "route": "deterministic|cheap_model|codex",
  "model": "provider/model-or-null",
  "confidence": 0.0,
  "risk": "low|medium|high",
  "reason": "stabiler_reason_code",
  "result": {},
  "estimated_cost": 0.0
}
```

Low Confidence (< 0,75), Providerfehler, Timeout, ungültige Kostenangaben und
Budgetüberschreitung liefern `escalate`/`codex`. Es werden keine Folgeaktionen
ausgeführt. Eine bereits laufende identische `jobId` wird ebenfalls geschlossen
mit `duplicate_job_id` abgewiesen.

## Provider und Kostenlimit

Der Adapter spricht eine OpenAI-kompatible Chat-Completions-Schnittstelle. URL,
Modell, API-Key und Preise werden ausschließlich serverseitig konfiguriert.
Der API-Key gehört nicht in n8n-Workflow-Exporte, Git, Jira, Confluence oder
Logs. Fehlt die vollständige Providerkonfiguration, eskaliert ein
`cheap_model`-Fall geschlossen zu Codex.

Vor jedem Modellaufruf reserviert der Router konservativ die maximalen Kosten
aus Eingabelänge, maximalen Ausgabetokens und den konfigurierten Preisen. Die
gemeinsame Monatsgrenze ist fest auf **20 EUR** gesetzt. Reservierte und bereits
verbrauchte Kosten zählen gemeinsam gegen die Grenze; parallele Anfragen
können sie daher nicht überschreiten. Ab 80 Prozent wird `budgetWarning=true`
ausgegeben. Der Provider sollte zusätzlich ein eigenes monatliches Hard Limit
von höchstens 20 EUR erhalten, sofern er dies unterstützt.

## Metrikbericht

`GET /metrics` (nur mit internem Bearer-Credential) liefert:

- Läufe und Routenverteilung,
- verwendete Modelle und Modellaufrufe,
- verbrauchte, reservierte und verbleibende EUR,
- vermiedene Codex-Aufrufe,
- Eskalationen und Eskalationsquote,
- Fehler und Fehlerrate,
- manuelle Eingriffe und mittlere Laufzeit.

Der persistente Zustand enthält ausschließlich Zähler, Modellnamen, Monat und
Kostenwerte. Aufgabeninhalte, Prompts, Tokens, Credentials und personenbezogene
Daten werden nicht gespeichert.

## n8n-Einrichtung und Test

1. Server-`.env` anhand `ops/n8n/.env.example` ergänzen. Für n8n ein Header-Auth-
   Credential `aiRouterInternalAuth` mit `Authorization: Bearer <Secret>`
   anlegen; dasselbe Secret nur serverseitig als `ROUTER_SHARED_SECRET` setzen.
2. Optional einen günstigen Provider konfigurieren und dessen Preise aus der
   Anbieterabrechnung übernehmen. Alle Providerfelder gemeinsam setzen.
3. `docker compose config` prüfen und den Router-Dienst starten.
4. `ops/n8n/workflows/task-router.json` importieren. Der Workflow bleibt bis
   zum internen Bridge-Test inaktiv und ist öffentlich durch Caddy blockiert.
5. Je einen deterministischen, günstigen und eskalierenden Testfall senden.
6. Low-Confidence, Timeout/Providerfehler und ausgeschöpftes Budget prüfen.
7. `/metrics` gegen die Testläufe plausibilisieren.

Automatisierte Repository-Tests prüfen jede verbindliche Routingregel, das
Budget unter Parallelität, die Metrikdaten, den Providervertrag und den
n8n-/Compose-Vertrag ohne echten API-Key und ohne kostenpflichtigen Aufruf.
