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

`ops/n8n/model-router.mjs` trennt zwei Betriebsmodi. Der direkte Codex-Chat
verwendet vorübergehend ein manuelles Pre-Step-Gate. Der n8n-Workflow verwendet
dagegen über `/controlled-execute` ausschließlich die automatische
Runtime-Route und benötigt kein aktuelles Benutzer-Modell.

## Temporary Manual Codex Routing

Das Modell-Gate bewertet vor dem nächsten Arbeitsschritt Komponenten,
Abhängigkeiten, Komplexität, Debugging-Aufwand, Confidence, frühere Fehler,
widersprüchliche Ergebnisse sowie Architektur-, Security-, Auth-, Session-,
RLS-, Secret-, Berechtigungs-, Migrations- und Datenverlustrisiken.

Dieser Modus gilt nur im direkten Codex-Entwicklungschat während KAN-110. Er
kennt ausschließlich diese Routingzustände:

- `CONTINUE`: Das aktuelle Modell erfüllt mindestens die benötigte Stufe.
- `MODEL_SWITCH_REQUIRED`: Der Executor wird nicht aufgerufen und der sichere
  Task-State unverändert für die Fortsetzung zurückgegeben.

Bei `MODEL_SWITCH_REQUIRED` enthält `userMessage` ausschließlich
`Jetzt brauchen wir Terra.` oder `Jetzt brauchen wir Sol.`. Die direkte
Codex-Ausgabe darf dem Benutzer in diesem Zustand keine weitere Erklärung oder
Ausgabe anhängen. Ein Wechsel auf Sol erfolgt nur für tatsächlich Sol-pflichtige
Architektur-, Security-, riskante Daten- oder wiederholt widersprüchliche
Fehlerfälle. Mittlere Komplexität verlangt höchstens Terra.

Die Loop-Zustände bleiben davon getrennt: `PASS`, `RETRY`, `ASK_USER`, `ABORT`.
`ASK_USER` wird nur nach bestandenem Modell-Gate für eine menschliche
Sachentscheidung verwendet.

Der versionierte Task-State enthält nur freigegebene technische Felder. Felder
für Tokens, Passwörter, Secrets, Credentials, Cookies oder Authorization werden
vor Audit und Ausführung abgewiesen. Das Audit speichert nur Routingstatus,
aktuelle/benötigte Modellstufe, Grundkategorie, Jira-Key und State-Revision.
Ein erforderlicher manueller Modellwechsel erhöht zugleich die Metrik
`manualInterventions`.

## Automated Runtime Routing

Der n8n-/KAN-147-Pfad verwendet den separaten Zustand `ROUTE_SELECTED`. Die
Runtime bestimmt `requiredModel=luna|terra|sol` intern und führt den Task danach
automatisch über `deterministic`, `cheap_model` oder `codex` weiter.

- Luna/Terra werden ohne Benutzerintervention an den erlaubten Modellpfad
  weitergegeben.
- Sol-pflichtige nicht-deterministische Aufgaben gehen automatisch an die
  Codex-/Sol-Route; ein günstiger Provider wird dafür nicht aufgerufen.
- Ein Modellwechsel erzeugt keine `userMessage` und kein `ASK_USER`.
- Nur `requiresHumanDecision=true` darf `ASK_USER` auslösen. Das kennzeichnet
  eine echte fachliche Freigabe und nicht die Auswahl einer Modellstufe.
- Der Runtime-Executor weist Ergebnisse zurück, die dennoch eine manuelle
  Modellwechsel-Nachricht enthalten.

Audit und Task-State verwenden dieselben Secret-Schutzregeln wie der direkte
Modus. Automatische Auswahlen werden als `automaticSelections` gezählt und
erhöhen `manualInterventions` nicht.

## Eingabe

Eine Teilaufgabe enthält nur den minimal notwendigen Inhalt und die für die
Policy erforderlichen Metadaten:

```json
{
  "step": {
    "complexity": "medium",
    "componentCount": 2,
    "riskSignals": []
  },
  "taskState": {
    "jiraKey": "KAN-147",
    "revision": 1
  },
  "task": {
    "jobId": "eindeutige-id",
    "type": "summarization",
    "complexity": "low",
    "risk": "low",
    "readOnly": true,
    "contextComplete": true,
    "instructions": "Kurze Zusammenfassung erzeugen",
    "content": "Minimal notwendiger Inhalt"
  }
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
  "mode": "automated_runtime",
  "routingStatus": "ROUTE_SELECTED",
  "requiredModel": "luna|terra|sol",
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
- manuelle Eingriffe, automatische Modell-/Route-Auswahlen und mittlere Laufzeit.

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
5. Je einen deterministischen, günstigen und automatisch zur Codex-/Sol-Route
   eskalierenden Testfall senden; keiner darf eine manuelle Modellwechsel-Zeile
   zurückgeben.
6. Low-Confidence, Timeout/Providerfehler und ausgeschöpftes Budget prüfen.
7. `/metrics` gegen die Testläufe plausibilisieren.

Automatisierte Repository-Tests prüfen jede verbindliche Routingregel, das
Budget unter Parallelität, die Metrikdaten, den Providervertrag und den
n8n-/Compose-Vertrag ohne echten API-Key und ohne kostenpflichtigen Aufruf.
