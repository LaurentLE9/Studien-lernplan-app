# Verbindliche Modell-Routing-Regel

Diese Regel gilt für Codex und andere Entwicklungs-Agenten im normalen Entwicklungsworkflow. Ziel ist, Nutzerlimit und Rechenbudget zu schonen, ohne Qualität oder Sicherheit zu verschlechtern.

**Integrationsanforderung:** `AGENTS.md` muss diese Datei verbindlich referenzieren. Die zentrale Definition of Done muss die unten aufgeführten Routing-Prüfungen enthalten. Ohne beide Verankerungen ist diese Regel nicht vollständig integriert.

## Grundprinzip

Jede neue Aufgabe startet mit dem kleinsten verfügbaren geeigneten Modell. Das Startmodell liest zuerst den aktiven Jira-Vorgang, `AGENTS.md`, den aktuellen dokumentierten Arbeitsstand sowie nur den für den Scope notwendigen Repository-Kontext. Es soll zunächst Scope, Risiken, betroffene Dateien und den nächsten Arbeitsschritt bestimmen.

Die Eskalationsleiter lautet grundsätzlich:

1. **GPT-5.6 Luna** – Startmodell für kostensensitive, häufige und klar abgegrenzte Arbeit.
2. **GPT-5.6 Terra** – wenn mehr Zuverlässigkeit oder Reasoning nötig ist, aber Sol noch nicht erforderlich ist.
3. **GPT-5.6 Sol** – für komplexes Reasoning, anspruchsvolle Programmierung, Architektur, schwierige Debugging-Aufgaben und erhöhte Sicherheits-/Risikofälle.

Die Einordnung folgt der offiziellen OpenAI-Modellpositionierung: Luna ist das schnellste und kostengünstigste GPT-5.6-Modell, Terra balanciert Leistungsfähigkeit und Kosten für alltägliche Arbeit, Sol ist das Flagship-Modell für komplexe professionelle Arbeit, Reasoning und Coding.

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

## Verbindliche manuelle Modellumschaltung

Solange Codex das Modell im laufenden Chat nicht selbst zuverlässig umschalten kann, erfolgt ein erforderlicher Modellwechsel manuell durch den Benutzer.

Sobald das aktuelle Modell erkennt, dass die nächste Stufe erforderlich ist, muss es **vor dem betreffenden Arbeitsschritt stoppen**. Die Benutzerhinweiszeile enthält ausschließlich den benötigten Modellnamen:

- `Jetzt brauchen wir Terra.`
- `Jetzt brauchen wir Sol.`
- falls künftig ein anderes im Projekt freigegebenes Modell gezielt erforderlich ist: `Jetzt brauchen wir <Modellname>.`

Dabei keine Begründung, keinen Modellvergleich und keine lange Erklärung ausgeben. Nach der manuellen Umschaltung wird im bestehenden Arbeitskontext fortgesetzt; der Benutzer muss den Auftrag nicht erneut erklären.

### Technische Kontrollschicht

KAN-127 setzt die Entscheidung zusätzlich als technisches Pre-Step-Gate unter
`ops/n8n/model-router.mjs` um. Vor dem vorgesehenen Executor entstehen nur die
Modell-Routingzustände `CONTINUE` oder `MODEL_SWITCH_REQUIRED`. Bei
`MODEL_SWITCH_REQUIRED` wird der Arbeitsschritt nicht aufgerufen; der sichere
Task-State bleibt für die Fortsetzung erhalten. Die Benutzeroberfläche gibt nur
`Jetzt brauchen wir Terra.` beziehungsweise `Jetzt brauchen wir Sol.` aus.

Diese Zustände sind ausdrücklich von den Loop-Zuständen `PASS`, `RETRY`,
`ASK_USER` und `ABORT` getrennt. Ein Modellwechsel ist weder `ASK_USER` noch ein
allgemeiner `ESCALATE`-Zustand. Routing-Audits enthalten nur Modellstufen,
Grundkategorie, Jira-Key und State-Revision, keine Aufgabeninhalte oder Secrets.

## Anti-Verschwendungs-Regeln

- Ein kleineres Modell darf einen bereits als zu schwierig erkannten Schritt nicht mehrfach versuchen.
- Nicht vorsorglich auf Sol wechseln, solange Luna oder Terra den nächsten Schritt zuverlässig erledigen kann.
- Bereits gelesenen und weiterhin gültigen Kontext nach Modellwechsel wiederverwenden; keine unnötige vollständige Repository-Analyse wiederholen.
- Deterministische Aufgaben bevorzugt ohne LLM erledigen, wenn lokale Tools oder n8n dieselbe Aussage zuverlässig liefern.
- Modellrouting darf niemals notwendige Sicherheits-, Qualitäts-, Datenintegritäts-, Browser- oder Regressionstests ersetzen oder abschwächen.

## Definition-of-Done-Nachweis

Für Aufgaben, bei denen Modellrouting relevant war, muss vor `technisch reviewbereit` geprüft werden:

- [ ] Mit dem kleinsten geeigneten verfügbaren Modell gestartet.
- [ ] Luna, Terra und Sol nur entsprechend dem tatsächlichen Bedarf verwendet.
- [ ] Vor einer notwendigen Eskalation wurde der aktuelle Arbeitsschritt gestoppt.
- [ ] Der Modellwechsel-Hinweis enthielt nur `Jetzt brauchen wir <Modellname>.`
- [ ] Keine unnötigen Wiederholungsversuche mit einem zu schwachen Modell.
- [ ] Vorhandener Kontext wurde nach dem Modellwechsel wiederverwendet.
- [ ] Modellwahl oder Nutzerlimit-Optimierung hat Qualität und Sicherheit nicht reduziert.
