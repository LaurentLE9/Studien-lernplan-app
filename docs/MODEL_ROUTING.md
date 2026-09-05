# Verbindliche Modell-Routing-Regel

Diese Regel gilt für Codex und andere Entwicklungs-Agenten im normalen Entwicklungsworkflow. Ziel ist, Nutzerlimit und Rechenbudget zu schonen, ohne Qualität oder Sicherheit zu verschlechtern.

`AGENTS.md` ist das Agent Operating System und legt fest, **wann** diese Policy geladen und angewendet wird. Diese Datei beschreibt **wie** die erforderliche Modellstufe bestimmt und je nach Betriebsmodus umgesetzt wird.

## 1. Zentrale Begriffe

Die Routing-Entscheidung verwendet drei getrennte Zustände:

### `requiredModel`

Die für den nächsten Implementierungsblock erforderliche Mindeststufe.

Werte:

- `luna`
- `terra`
- `sol`

`requiredModel` wird ausschließlich aus **Scope, Risiko, Komplexität und Unsicherheit** bestimmt. Es darf nicht davon abhängen, welches Modell aktuell aktiv ist oder ob diese Information überhaupt verfügbar ist.

### `activeModel`

Optionales Laufzeit-Metadatum des tatsächlich aktiven Modells.

Werte:

- `luna`
- `terra`
- `sol`
- `unknown`

`activeModel` darf nur gesetzt werden, wenn der Client bzw. die Laufzeit diese Information zuverlässig bereitstellt. Ein Agent darf das aktive Modell niemals raten, aus seiner vermuteten Fähigkeit ableiten oder erfinden.

### `routingAction`

Die aus Betriebsmodus, `requiredModel` und gegebenenfalls `activeModel` resultierende Aktion.

Mögliche Zustände:

- `CONTINUE`
- `MODEL_SWITCH_REQUIRED`
- `ROUTE_SELECTED`
- `ACTIVE_MODEL_UNKNOWN`

`ACTIVE_MODEL_UNKNOWN` bedeutet im manuellen Übergangsmodus: Die erforderliche Modellstufe ist bekannt, aber die tatsächliche aktive Modellstufe kann nicht zuverlässig verifiziert werden. Dieser Zustand darf nicht durch Raten aufgelöst werden.

## 2. Ermittlung von `requiredModel`

Jede neue Aufgabe startet konzeptionell mit der kleinsten geeigneten Stufe. Das Startmodell liest zuerst den aktiven Jira-Vorgang, `AGENTS.md`, den Agent Context Router und nur den für den Scope notwendigen Repository-Kontext.

Die Eskalationsleiter lautet:

1. **GPT-5.6 Luna** – kostensensitive, häufige und klar abgegrenzte Arbeit.
2. **GPT-5.6 Terra** – mehr Zuverlässigkeit/Reasoning bei mittlerer Komplexität.
3. **GPT-5.6 Sol** – komplexes Reasoning, Architektur, schwieriges Debugging und erhöhte Sicherheits-/Risikofälle.

### Luna

`requiredModel=luna`, insbesondere bei:

- Jira-/GitHub-/Confluence-Kontext zusammenfassen,
- Scope, Nicht-Ziele und relevante Dateien bestimmen,
- einfacher Repository-Recherche,
- einer klar abgegrenzten risikoarmen Änderung,
- einfacher Test-/Log-Auswertung,
- Dokumentations-/Statusaufgaben,
- klar strukturierten Klassifizierungsaufgaben,
- Vorprüfung für eine mögliche Eskalation.

### Terra

`requiredModel=terra`, insbesondere bei:

- mehreren zusammenhängenden Dateien mit überschaubaren Abhängigkeiten,
- Integrationslogik zwischen mehreren Systemen oder Verträgen,
- mittlerem Refactoring,
- nichttrivialer Fehleranalyse,
- komplexerer Testauswertung,
- fachlicher Logik mit mehreren Randfällen,
- erhöhter Unsicherheit oder widersprüchlichen Ergebnissen.

### Sol

`requiredModel=sol`, insbesondere bei:

- Architektur- und Modulgrenzen,
- großen oder stark gekoppelten Refactorings,
- schwierigen oder wiederholt nicht gelösten Bugs,
- Authentifizierung, Sessions, RLS, Secrets, Berechtigungen und Security-relevanten Änderungen,
- Datenbankmigrationen oder erhöhtem Datenverlustrisiko,
- komplexen Repository-Änderungen mit vielen Abhängigkeiten,
- sicherheitskritischer Analyse oder anspruchsvoller Codebewertung,
- Aufgaben, für die Terra keine ausreichende Zuverlässigkeit erreicht.

## 3. Zwei strikt getrennte Betriebsmodi

Die beiden folgenden Modi dürfen niemals vermischt werden.

---

## 3.1 `TEMPORARY_MANUAL_CODEX_ROUTING`

### Zweck

Dieser Modus ist ausschließlich eine **Übergangslösung** für den direkten Codex-Entwicklungschat, solange das automatische n8n-Routing noch nicht produktiv und verbindlich für diesen Workflow aktiv ist.

Der Benutzer wechselt bei Bedarf das Modell manuell. Der Agent selbst darf keine automatische Modellumschaltung vortäuschen.

### Pre-Write-Gate

Read-only-Arbeit ist vor dem Gate erlaubt: Jira-/GitHub-/Confluence-Kontext lesen, `git status`/Diff prüfen, Scope bestimmen und gezielt Dateien inspizieren.

**Vor dem ersten Edit/Patch/Write eines Implementierungsblocks muss das Modell-Gate abgeschlossen sein.**

Die erforderliche Modellstufe wird deterministisch aus dem geplanten Block bestimmt:

```bash
npm run model:gate -- --files <anzahl> --complexity <low|medium|high> [Signale]
```

Optional darf das aktive Modell angegeben werden, **nur wenn es zuverlässig bekannt ist**:

```bash
npm run model:gate -- --active <luna|terra|sol|unknown> --files <anzahl> --complexity <low|medium|high> [Signale]
```

Kompatibilität: Solange alte lokale Aufrufe noch existieren, darf der Guard `--current` als Alias für `--active` akzeptieren. Neue Dokumentation und neue Aufrufe verwenden ausschließlich `--active`.

Verfügbare Signale sind insbesondere:

- `--integration`
- `--refactor`
- `--uncertainty`
- `--architecture`
- `--security`
- `--auth`
- `--rls`
- `--secrets`
- `--migration`
- `--data-loss`

### Gate-Ausgaben

Der Guard bestimmt immer zuerst `requiredModel`.

#### Fall A – aktive Modellstufe zuverlässig bekannt und ausreichend

```text
routingAction=CONTINUE
requiredModel=<luna|terra|sol>
activeModel=<luna|terra|sol>
```

Der Implementierungsblock darf ausgeführt werden.

#### Fall B – aktive Modellstufe zuverlässig bekannt, aber zu schwach

```text
routingAction=MODEL_SWITCH_REQUIRED
requiredModel=<terra|sol>
activeModel=<luna|terra>
```

Der Block ist gesperrt. Die Benutzerhinweiszeile darf ausschließlich lauten:

- `Jetzt brauchen wir Terra.`
- `Jetzt brauchen wir Sol.`

Danach muss der Agent stoppen. Keine Begründung, kein Modellvergleich und kein erneuter Write-Versuch mit der zu schwachen Stufe.

#### Fall C – aktive Modellstufe nicht zuverlässig bekannt

```text
routingAction=ACTIVE_MODEL_UNKNOWN
requiredModel=<luna|terra|sol>
activeModel=unknown
```

Der Agent darf kein Modell erfinden.

Für reine Read-only-Planung darf weitergearbeitet werden. Vor einem Implementierungsblock, der `requiredModel=terra` oder `requiredModel=sol` verlangt, muss die Modellstufe im direkten Codex-Client zuverlässig geklärt bzw. manuell passend gewählt werden. Die notwendige Zielstufe bleibt trotzdem deterministisch bekannt.

Für `requiredModel=luna` darf der Guard den risikoarmen Block als `CONTINUE` behandeln, sofern keine Sicherheits-/Stop-Regel greift; damit erzeugt fehlende Runtime-Metadaten nicht unnötig Blockaden bei einfachen Aufgaben.

### Konservative Mindeststufen

- genau eine klar abgegrenzte, risikoarme Datei mit niedriger Komplexität → Luna möglich,
- mehrere zusammenhängende Dateien, Integrationslogik, mittleres Refactoring oder erhöhte Unsicherheit → mindestens Terra,
- Architektur, Security, Auth, Session/RLS/Secrets, riskante Migrationen oder Datenverlustrisiko → Sol.

### Abschaltbedingung

`TEMPORARY_MANUAL_CODEX_ROUTING` wird deaktiviert, sobald der produktive n8n-Router für den direkten Entwicklungsworkflow nachweislich:

1. Scope, Risiko, Komplexität und Unsicherheit bewertet,
2. `requiredModel`/Route zuverlässig bestimmt,
3. den ausführenden Modell-/Providerpfad automatisch auswählt,
4. Qualitäts-, Sicherheits- und Stop-Gates einhält,
5. und als verbindlicher Standard für diesen Workflow freigegeben wurde.

Ab diesem Zeitpunkt darf der direkte Workflow nicht mehr wegen reinen Modellbedarfs den Benutzer zur Modellwahl auffordern. Der manuelle Übergangsmodus bleibt nur als historische/Notfall-Dokumentation erhalten oder wird vollständig entfernt, sobald seine Entfernung freigegeben wurde.

---

## 3.2 `AUTOMATED_N8N_ROUTING`

### Zweck

Dies ist das **dauerhafte Zielsystem** für KAN-110/KAN-127/KAN-147 und die darauf aufbauende Orchestrierung.

Der n8n-/Runtime-Router bewertet Scope, Risiko, Komplexität, Confidence und Budget, setzt intern `requiredModel` bzw. die Ausführungsroute und wählt automatisch den passenden Modell-/Providerpfad.

### Regeln

- `requiredModel=luna|terra` führt automatisch in den vorgesehenen Modell-/Providerpfad, sofern die Aufgabenpolicy diesen Pfad erlaubt.
- `requiredModel=sol` führt automatisch zur Sol-/Codex-Route; ein ungeeigneter günstiger Provider wird nicht aufgerufen.
- Deterministische Aufgaben bleiben ohne LLM-Aufruf, wenn lokale Tools/n8n dieselbe Aussage zuverlässig liefern.
- Modellbedarf allein erzeugt weder `MODEL_SWITCH_REQUIRED`, eine Benutzer-Modellwahl noch die manuelle Hinweiszeile.
- `ASK_USER` ist ausschließlich für echte fachliche Entscheidungen, Freigaben oder Risiken zulässig, die eine menschliche Entscheidung erfordern.
- Der interne n8n-Endpunkt `/controlled-execute` nutzt ausschließlich `AUTOMATED_N8N_ROUTING`.
- `activeModel` ist für die Routingentscheidung nicht erforderlich. Die Runtime wählt die Route aus `requiredModel`/Policy; der fachliche Zustand lautet `ROUTE_SELECTED`.
- Die manuelle Terra-/Sol-Zeile darf in automatisierten Antworten weder direkt noch verschachtelt vorkommen.

## 4. Anti-Verschwendungs-Regeln

- Ein kleineres Modell darf einen bereits als zu schwierig erkannten Schritt nicht mehrfach versuchen.
- Nicht vorsorglich auf Sol wechseln, solange Luna oder Terra den nächsten Schritt zuverlässig erledigen kann.
- Bereits gelesenen und weiterhin gültigen Kontext nach Modellwechsel wiederverwenden; keinen unnötigen vollständigen Repository-Scan wiederholen.
- Deterministische Aufgaben bevorzugt ohne LLM erledigen, wenn lokale Tools oder n8n dieselbe Aussage zuverlässig liefern.
- Modellrouting darf niemals notwendige Sicherheits-, Qualitäts-, Datenintegritäts-, Browser- oder Regressionstests ersetzen oder abschwächen.
- `requiredModel` wird neu bewertet, wenn Scope, Dateianzahl, Komplexität, Risiko oder Unsicherheit deutlich ansteigen.

## 5. Technische Grenze des manuellen Guards

`scripts/codex-prewrite-model-gate.mjs` ist der deterministische Pre-Write-Guard für den direkten Codex-Modus. Er ersetzt keine Codex-Sandbox und kann einen Agenten, der Repository-Regeln absichtlich umgeht, nicht auf Betriebssystemebene am Schreiben hindern.

Seine Ausführung ist deshalb zusammen mit `AGENTS.md` verbindlicher Bestandteil des temporären direkten Entwicklungsprozesses.

Der n8n-Runtime-Router ist davon getrennt. `ops/n8n/model-router.mjs` und `/controlled-execute` gehören ausschließlich zu `AUTOMATED_N8N_ROUTING`.

## 6. Definition-of-Done-Nachweis

Für Aufgaben, bei denen Modellrouting relevant war, muss vor `technisch reviewbereit` geprüft werden:

- [ ] Routing-Modus eindeutig als `TEMPORARY_MANUAL_CODEX_ROUTING` oder `AUTOMATED_N8N_ROUTING` bestimmt.
- [ ] Beide Modi wurden nicht vermischt.
- [ ] `requiredModel` unabhängig von `activeModel` aus Scope/Risiko/Komplexität/Unsicherheit bestimmt.
- [ ] `activeModel` nur verwendet, wenn zuverlässig bekannt; andernfalls `unknown`.
- [ ] Kein aktives Modell geraten oder erfunden.
- [ ] Im manuellen Übergangsmodus wurde vor dem ersten Write jedes relevanten Implementierungsblocks das Pre-Write-Gate ausgeführt.
- [ ] Vor notwendiger manueller Eskalation wurde der aktuelle Arbeitsschritt gestoppt.
- [ ] Manueller Modellwechsel-Hinweis enthielt ausschließlich `Jetzt brauchen wir <Modellname>.`.
- [ ] Keine unnötigen Wiederholungsversuche mit einer zu schwachen Modellstufe.
- [ ] Vorhandener Kontext wurde nach einem Wechsel wiederverwendet.
- [ ] Im automatisierten n8n-Pfad wurde die Route ohne Benutzer-Modellwahl bestimmt.
- [ ] Reiner Modellbedarf hat im automatisierten Pfad weder `ASK_USER` noch `Jetzt brauchen wir <Modellname>.` erzeugt.
- [ ] Modellwahl oder Nutzerlimit-Optimierung hat Qualität und Sicherheit nicht reduziert.
- [ ] Abschaltbedingung des temporären Modus wurde beachtet, falls der n8n-Pfad bereits als verbindlicher Standard freigegeben ist.
