# Verbindliche Modell-Routing-Regel

Diese Regel gilt für Codex und andere Entwicklungs-Agenten im normalen Entwicklungsworkflow. Ziel ist, Nutzerlimit und Rechenbudget zu schonen, ohne Qualität oder Sicherheit zu verschlechtern.

**Integrationsanforderung:** `AGENTS.md` muss diese Datei verbindlich referenzieren. Die zentrale Definition of Done muss die unten aufgeführten Routing-Prüfungen enthalten. Ohne beide Verankerungen ist diese Regel nicht vollständig integriert.

## Grundprinzip

Jede neue Aufgabe startet mit dem kleinsten verfügbaren geeigneten Modell. Das Startmodell liest zuerst den aktiven Jira-Vorgang, `AGENTS.md`, den aktuellen dokumentierten Arbeitsstand sowie nur den für den Scope notwendigen Repository-Kontext. Es soll zunächst Scope, Risiken, betroffene Dateien und den nächsten Arbeitsschritt bestimmen.

Die Eskalationsleiter lautet grundsätzlich:

1. **GPT-5.6 Luna** – Startmodell für kostensensitive, häufige und klar abgegrenzte Arbeit.
2. **GPT-5.6 Terra** – wenn mehr Zuverlässigkeit oder Reasoning nötig ist, aber Sol noch nicht erforderlich ist.
3. **GPT-5.6 Sol** – für komplexes Reasoning, anspruchsvolle Programmierung, Architektur, schwierige Debugging-Aufgaben und erhöhte Sicherheits-/Risikofälle.

## Routing nach Aufgabenart

### Luna

Luna ist der Standardstart und bleibt aktiv, wenn die Aufgabe zuverlässig damit erledigt werden kann, insbesondere für:

- Jira-/GitHub-/Confluence-Kontext zusammenfassen,
- Scope, Nicht-Ziele und relevante Dateien bestimmen,
- einfache Recherche im Repository,
- kleine, eindeutig lokalisierte Änderungen,
- einfache Tests oder Log-Auswertung,
- Dokumentations- und Statusaufgaben,
- klar strukturierte Klassifizierungs- und Analyseaufgaben,
- Vorprüfung, ob eine stärkere Modellstufe erforderlich ist.

### Terra

Auf Terra eskalieren, wenn Luna den nächsten Schritt nicht mit ausreichender Zuverlässigkeit ausführen kann, insbesondere bei:

- Änderungen über mehrere zusammenhängende Dateien mit überschaubaren Abhängigkeiten,
- Integrationslogik zwischen mehreren Systemen oder Verträgen,
- mittlerem Refactoring,
- nichttrivialer Fehleranalyse,
- komplexerer Testauswertung,
- fachlicher Logik mit mehreren Randfällen,
- Aufgaben, bei denen Luna geringe Confidence oder widersprüchliche Ergebnisse liefert.

### Sol

Auf Sol eskalieren, wenn hohe Zuverlässigkeit oder komplexes Reasoning nötig ist, insbesondere bei:

- Architektur- und Modulgrenzen,
- großen oder stark gekoppelten Refactorings,
- schwierigen oder wiederholt nicht gelösten Bugs,
- Authentifizierung, Sessions, RLS, Secrets, Berechtigungen und Security-relevanten Änderungen,
- Datenbankmigrationen oder Änderungen mit erhöhtem Datenverlustrisiko,
- komplexen Repository-Änderungen mit vielen Abhängigkeiten,
- sicherheitskritischer Analyse oder anspruchsvoller Codebewertung,
- Aufgaben, für die Terra keine ausreichende Confidence erreicht.

## Temporary Manual Codex Routing

Diese Übergangsregel gilt ausschließlich für den direkten Codex-Entwicklungschat während der Umsetzung des KAN-110-Epics. Solange Codex das Modell in diesem Chat nicht selbst zuverlässig umschalten kann, erfolgt ein erforderlicher Modellwechsel manuell durch den Benutzer.

### Verbindliches Pre-Write-Gate

Read-only-Arbeit ist vor dem Gate erlaubt: Jira-/GitHub-/Confluence-Kontext lesen, `git status`/Diff prüfen, Scope bestimmen und gezielt Dateien inspizieren.

**Vor dem ersten Edit/Patch/Write eines Implementierungsblocks muss das Modell-Gate abgeschlossen sein.** Dazu ist der deterministische Guard auszuführen:

```bash
npm run model:gate -- --current <luna|terra|sol> --files <anzahl> --complexity <low|medium|high> [Signale]
```

Verfügbare Signale sind insbesondere `--integration`, `--refactor`, `--uncertainty`, `--architecture`, `--security`, `--auth`, `--rls`, `--secrets`, `--migration` und `--data-loss`.

Der Guard liefert nur einen der folgenden fachlichen Zustände:

- `CONTINUE` – der geplante Implementierungsblock darf mit dem aktuellen Modell geschrieben werden.
- `MODEL_SWITCH_REQUIRED` – der Block ist gesperrt. Die CLI gibt ausschließlich `Jetzt brauchen wir Terra.` oder `Jetzt brauchen wir Sol.` aus und beendet sich ungleich null.

Bis `CONTINUE` für den konkreten Implementierungsblock vorliegt, sind **keine Dateiänderungen, Patches, Writes oder Commits** zulässig. Der Guard wird erneut ausgeführt, wenn sich Scope, Dateianzahl, Komplexität, Risiko oder Unsicherheit deutlich erhöht.

Konservative Mindeststufen für die Übergangsphase:

- genau eine klar abgegrenzte, risikoarme Datei mit niedriger Komplexität → Luna möglich,
- mehrere zusammenhängende Dateien, Integrationslogik, mittleres Refactoring oder erhöhte Unsicherheit → mindestens Terra,
- Architektur, Security, Auth, Session/RLS/Secrets, riskante Migrationen oder Datenverlustrisiko → Sol.

Sobald das aktuelle Modell erkennt oder der Guard feststellt, dass die nächste Stufe erforderlich ist, muss es **vor dem betreffenden Arbeitsschritt stoppen**. Die Benutzerhinweiszeile enthält ausschließlich den benötigten Modellnamen:

- `Jetzt brauchen wir Terra.`
- `Jetzt brauchen wir Sol.`

Dabei keine Begründung, keinen Modellvergleich und keine lange Erklärung ausgeben. Nach der manuellen Umschaltung wird im bestehenden Arbeitskontext fortgesetzt; der Benutzer muss den Auftrag nicht erneut erklären.

### Technische Grenze der Übergangslösung

`scripts/codex-prewrite-model-gate.mjs` ist der deterministische Pre-Write-Guard für den direkten Codex-Modus. Er ersetzt keine Codex-Sandbox und kann einen Agenten, der die Repository-Regel absichtlich umgeht, nicht auf Betriebssystemebene am Schreiben hindern. Seine Ausführung ist deshalb zusammen mit `AGENTS.md` verbindlicher Bestandteil des direkten Entwicklungsprozesses.

Der n8n-Runtime-Router ist davon getrennt. `ops/n8n/model-router.mjs` und `/controlled-execute` gehören nicht zur manuellen Benutzerumschaltung.

## Automated Runtime Routing

Der spätere n8n-/KAN-127-/KAN-147-Pfad verwendet **nicht** die manuelle Codex-Übergangslösung. Er bewertet Scope, Risiko, Komplexität, Confidence und Budget, setzt intern `requiredModel` und wählt automatisch die ausführende Route. Der Runtime-Zustand lautet `ROUTE_SELECTED`; ein `currentModel` oder eine Benutzer-Modellwahl ist dafür nicht erforderlich.

- `requiredModel=luna|terra` führt automatisch in den dafür vorgesehenen Modell-/Providerpfad, sofern die Aufgabenpolicy den Modellpfad erlaubt.
- `requiredModel=sol` führt automatisch zur Sol-/Codex-Route; der günstige Provider wird nicht aufgerufen.
- Deterministische Aufgaben bleiben ohne LLM-Aufruf.
- Modellbedarf allein erzeugt weder `MODEL_SWITCH_REQUIRED`, `userMessage` noch `ASK_USER`.
- `ASK_USER` ist ausschließlich für eine ausdrücklich markierte echte menschliche Sachentscheidung oder Freigabe zulässig.

Der interne n8n-Endpunkt `/controlled-execute` nutzt ausschließlich Automated Runtime Routing. Die manuelle Terra-/Sol-Zeile darf in seiner Antwort weder direkt noch verschachtelt vorkommen.

## Anti-Verschwendungs-Regeln

- Ein kleineres Modell darf einen bereits als zu schwierig erkannten Schritt nicht mehrfach versuchen.
- Nicht vorsorglich auf Sol wechseln, solange Luna oder Terra den nächsten Schritt zuverlässig erledigen kann.
- Bereits gelesenen und weiterhin gültigen Kontext nach Modellwechsel wiederverwenden; keine unnötige vollständige Repository-Analyse wiederholen.
- Deterministische Aufgaben bevorzugt ohne LLM erledigen, wenn lokale Tools oder n8n dieselbe Aussage zuverlässig liefern.
- Modellrouting darf niemals notwendige Sicherheits-, Qualitäts-, Datenintegritäts-, Browser- oder Regressionstests ersetzen oder abschwächen.

## Definition-of-Done-Nachweis

Für Aufgaben, bei denen Modellrouting relevant war, muss vor `technisch reviewbereit` geprüft werden:

- [ ] Mit dem kleinsten geeigneten verfügbaren Modell gestartet.
- [ ] Vor dem ersten Write jedes Implementierungsblocks wurde das Pre-Write-Gate ausgeführt.
- [ ] Luna, Terra und Sol nur entsprechend dem tatsächlichen Bedarf verwendet.
- [ ] Vor einer notwendigen Eskalation wurde der aktuelle Arbeitsschritt gestoppt.
- [ ] Der Modellwechsel-Hinweis enthielt nur `Jetzt brauchen wir <Modellname>.`
- [ ] Keine unnötigen Wiederholungsversuche mit einem zu schwachen Modell.
- [ ] Vorhandener Kontext wurde nach dem Modellwechsel wiederverwendet.
- [ ] Der automatisierte n8n-/KAN-147-Pfad hat Modell-/Route-Eskalationen ohne manuelle Benutzer-Modellwahl verarbeitet.
- [ ] Reiner Modellbedarf hat im automatisierten Pfad weder `ASK_USER` noch `Jetzt brauchen wir <Modellname>.` erzeugt.
- [ ] Modellwahl oder Nutzerlimit-Optimierung hat Qualität und Sicherheit nicht reduziert.
