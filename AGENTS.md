# AGENTS.md

Diese Datei ist die verbindliche Repository-Regelbasis für Codex und andere Entwicklungs-Agenten in `LaurentLE9/Studien-lernplan-app`.

## 1. Verbindliche Quellen

Vor Änderungen müssen Agenten mindestens lesen:

1. den aktiven Jira-Vorgang mit Akzeptanzkriterien,
2. `AGENTS.md`,
3. `README.md`,
4. `docs/LOOP_ENGINEERING.md`,
5. relevante Quell- und Testdateien.

Die dauerhafte Definition of Done und der Arbeitsprozess liegen im Confluence-Projekt-Hub auf der Seite **„Arbeitsprozess und Definition of Done“**. Jira bleibt die operative Quelle für Status, Sprint, Priorität und Scope.

Verknüpfte Vorgänge:

- KAN-30 – Entwicklungs- und Jira-Workflow dokumentieren
- KAN-72 – Isolierten Testnutzer und Browser-End-to-End-Tests einführen
- KAN-73 – Kontrollierten Entwicklungs-Loop für Codex einführen
- KAN-74 – AGENTS.md erstellen und mit Definition of Done verknüpfen
- KAN-109 – Browser-/E2E-Regressionstest erweitern und Test-Account ohne Rückfrage verbindlich machen

## 2. Git- und Branch-Regeln

- Niemals direkt auf `main` entwickeln oder pushen.
- Vor Änderungen Branch, HEAD, Remote und `git status` prüfen.
- Fremde oder unklare uncommittierte Änderungen nicht überschreiben oder mitcommitten.
- Aufgaben-Branch vom aktuellen `main` erstellen.
- Branch-Namen enthalten den Jira-Key.

Schema:

- Feature: `feature/KAN-XX-kurzer-name`
- Bugfix: `fix/KAN-XX-kurzer-name`
- Refactoring: `refactor/KAN-XX-kurzer-name`
- Tests: `test/KAN-XX-kurzer-name`
- Dokumentation: `docs/KAN-XX-kurzer-name`

### Jira-/GitHub-Issue-Abgleich

- Jira bleibt die operative Quelle für Status, Sprint, Priorität und Scope. GitHub Issues spiegeln die repositorynahe technische Nachverfolgung.
- Für jeden eigenständig bearbeitbaren Jira-Vorgang, der einen Aufgaben-Branch und Pull Request erfordert, ist vor der Implementierung ein GitHub Issue erforderlich. Dies gilt insbesondere für Tasks, Features, Stories, Bugs und eigenständig umgesetzte Sub-Tasks.
- Vor dem Anlegen müssen offene und geschlossene GitHub Issues nach Jira-Key und Inhalt durchsucht werden. Ein passendes Issue wird weiterverwendet; Duplikate sind unzulässig.
- Das GitHub Issue enthält den Jira-Key und einen Jira-Link. Der Jira-Vorgang enthält den Link zum GitHub Issue. Branch, Commits und Pull Request enthalten den Jira-Key; der Pull Request referenziert das Issue mit `Refs #<Nummer>`.
- Automatische Schließformeln wie `Closes #<Nummer>` dürfen nicht verwendet werden, weil der Merge allein die Definition of Done noch nicht erfüllt. Das GitHub Issue wird erst nach bestätigtem Merge, vollständiger Nachprüfung, abgeschlossenem Confluence-Abgleich und Jira-Status `Erledigt` mit einem Abschlussnachweis geschlossen.
- Dokumentierte Ausnahmen gelten für reine Epics/Sammelvorgänge ohne eigene Implementierung, reine Planungs- oder Verwaltungsarbeit ohne Repository-Änderung, Duplikate oder verworfene Vorgänge sowie Inhalte, die aus Sicherheits- oder Datenschutzgründen nicht in GitHub stehen dürfen. Die Ausnahme und ihr Grund müssen vor Arbeitsbeginn im Jira-Vorgang stehen.
- Vor KAN-85 bereits erledigte Vorgänge erhalten nach dokumentierter Inventur nicht rückwirkend leere GitHub Issues. Bei Wiederaufnahme oder neuem Repository-Änderungsbedarf gilt die Issue-Pflicht.
- Abweichende Jira-/GitHub-Status werden dokumentiert und ausgehend von Jira kontrolliert bereinigt. Ein GitHub Issue zu einem noch offenen Jira-Vorgang darf nicht allein wegen eines vorhandenen Merges geschlossen werden.
- Secrets, Zugangsdaten, Testpasswörter und unnötige personenbezogene Daten gehören weder in Jira noch in GitHub Issues.

## 3. Scope-Regeln

- Nur Änderungen durchführen, die für den aktiven Jira-Vorgang erforderlich sind.
- Keine zusätzlichen Features, Paket-Upgrades oder Nebenbaustellen ohne eigenen Jira-Vorgang aufnehmen.
- Bestehendes Design, Verhalten und Datenmodell erhalten, sofern das Ticket keine Änderung verlangt.
- Keine unnötigen Dateien verändern.
- Keine Tests abschwächen, überspringen oder löschen, nur damit Prüfungen grün werden.

### Kontext- und Nutzerlimit-Effizienz

> Jede Aufgabe muss mit dem kleinstmöglichen notwendigen Kontext durchgeführt werden. Vollständige Repository-Analysen dürfen nur erfolgen, wenn die Aufgabe sie tatsächlich erfordert.

- Vor jeder Analyse zuerst Scope, Nicht-Ziele, betroffene Schichten und benötigte Nachweise bestimmen.
- Standardmäßig mit `git status`, Git-Diff beziehungsweise den seit dem bestätigten Ausgangs-HEAD geänderten Dateien beginnen. Ein vollständiger Repository-Scan braucht eine konkrete Begründung aus dem Ticket.
- Unveränderte Dateien und bereits geklärte Architektur nicht erneut analysieren. Weiterhin gültige Dokumentation und belegte Ergebnisse aus demselben Arbeitslauf wiederverwenden.
- Große Dateien nur über Suche, Symbole, relevante Zeilenbereiche und direkte Abhängigkeiten untersuchen. Das gilt besonders für `src/App.jsx`; eine vollständige Verarbeitung ist nur bei dateiweitem Scope zulässig.
- Zuerst lokale, deterministische Mittel wie `rg`, Git-Diff, Typecheck, Lint, gezielte Tests oder vorhandene Skripte nutzen, wenn sie dieselbe Frage zuverlässig beantworten.
- Prompts und Tool-Ausgaben auf Ticket, geänderte Dateien, fehlende Evidenz und konkrete Fehler begrenzen. Große unveränderte Inhalte nicht wiederholt übertragen.
- Tests anhand des tatsächlichen Änderungsumfangs auswählen: zuerst kleine relevante Prüfungen, danach die nach Definition of Done erforderlichen vollständigen Regressionstests für den finalen Kandidaten.
- Build, Typecheck, Lint, Test- und Analysebefehle nicht ohne technischen Grund identisch wiederholen. Ein Prüfergebnis darf nur wiederverwendet werden, wenn geprüfter Commit beziehungsweise Arbeitsbaum und alle dafür relevanten Quellen, Konfigurationen und Abhängigkeiten unverändert sind.
- Nach einer Reparatur nur die dadurch ungültig gewordenen gezielten Nachweise sofort erneuern. Vor Veröffentlichung bleiben alle vollständigen Pflichtprüfungen für den finalen Stand verbindlich.
- Ressourcenoptimierung darf niemals notwendige Sicherheits-, Qualitäts-, Datenintegritäts-, Browser- oder Regressionstests auslassen oder deren Aussagekraft verringern.
- Der Abschlussbericht nennt kurz die untersuchten Dateien/Bereiche, ausgeführten Prüfungen, wiederverwendeten Nachweise und die Begründung für jeden vollständigen Repository-Scan.

Die wiederverwendbare Repository-Kontextkarte und die Regeln zur Gültigkeit von Prüfnachweisen stehen in `docs/CONTEXT_EFFICIENCY.md`.

## 4. Kontrollierter Entwicklungs-Loop

Für nicht-triviale Änderungen gilt:

```text
PLAN → IMPLEMENT → VERIFY → EVALUATE
                         ├─ PASS → PUBLISH/REVIEW
                         ├─ RETRY → REPAIR → VERIFY
                         ├─ ASK_USER → stoppen und Entscheidung einholen
                         └─ ABORT → sicher stoppen und dokumentieren
```

Details stehen in `docs/LOOP_ENGINEERING.md`.

### PLAN

- Ticket, Scope, Akzeptanzkriterien und Nicht-Ziele erfassen.
- relevante Dateien und Abhängigkeiten identifizieren.
- Risiken und benötigte Tests bestimmen.
- Projekt-Hub und fachlich möglicherweise betroffene Confluence-Seiten für den späteren Abschlussabgleich identifizieren.

### IMPLEMENT

- kleinste sinnvolle Änderung umsetzen.
- bei Bugs nach Möglichkeit zuerst Regression reproduzierbar machen.
- Architektur- und Modulgrenzen respektieren.

### VERIFY

Zuerst gezielte Tests, danach grundsätzlich:

```bash
npm test
npm run test:coverage
npx tsc --noEmit
npm run build
```

Bei UI-/Interaktionsänderungen zusätzlich Preview-/Browserprüfung durchführen und Branch + Commit des geprüften Deployments eindeutig bestätigen.

Die vollständigen Pflichtprüfungen werden einmal für den finalen Kandidaten ausgeführt. Ändert sich der Stand danach, werden alle durch die Änderung ungültig gewordenen Prüfungen erneut ausgeführt; unveränderte, eindeutig einem Stand zuordenbare Nachweise werden nicht ohne Grund wiederholt.

### EVALUATE

Mindestens bewerten:

- correctness
- acceptance criteria
- scope
- regression risk
- security
- data integrity
- test quality
- documentation
- evidence

Entscheidung muss `PASS`, `RETRY`, `ASK_USER` oder `ABORT` sein.

### RETRY

- Maximal drei Reparaturversuche pro zusammenhängender Fehlerursache.
- Keine bereits nachweislich fehlgeschlagene Strategie unverändert wiederholen.
- Nach jeder Reparatur relevante Tests erneut ausführen.
- Nach drei erfolglosen Versuchen stoppen und Ursache dokumentieren.

## 5. Sicherheits- und Stop-Regeln

Sofort stoppen bzw. menschliche Freigabe verlangen bei:

- Authentifizierungs-/Session-Sicherheitsänderungen,
- Änderungen an Supabase RLS oder Berechtigungsmodellen,
- destruktiven oder riskanten Datenbankmigrationen,
- möglichem Datenverlust,
- Secrets, API-Keys, Tokens oder produktiven Zugangsdaten,
- wesentlich erweitertem Scope,
- untrennbaren fremden Änderungen,
- drei erfolglosen Reparaturversuchen.

Secrets dürfen niemals in Code, Logs, Tests, Commits oder Dokumentation aufgenommen werden.

## 6. Browser- und End-to-End-Prüfung

Soweit eine Änderung sichtbares oder interaktives Verhalten betrifft, ist die Browser-/E2E-Prüfung ein verbindlicher Teil der Verifikation. Die Detailregeln stehen in `docs/BROWSER_E2E_POLICY.md`.

### Test-Account-Policy – keine zusätzliche Rückfrage

Der vorgesehene isolierte Test-Account ist für Browser-, E2E-, Smoke-, Regression- und Funktionsprüfungen vorab freigegeben.

Wenn ein Test aufgrund des Jira-Scopes, einer Codeänderung, eines Bugs oder der Definition of Done erforderlich ist:

1. Test-Account selbstständig verwenden.
2. erforderliche E2E-Testdaten selbstständig erstellen.
3. Test selbstständig ausführen.
4. Ergebnis auswerten.
5. eindeutig erzeugte Testdaten nach Erfolg oder Fehler bereinigen.
6. **nicht** fragen, ob der Browser-Test gestartet oder das Testkonto verwendet werden soll.

Diese Freigabe gilt ausschließlich für den isolierten Test-Account und eindeutig mit `E2E-<Run-ID>-...` markierte Testdaten. Sie gilt nicht für echte Benutzerkonten oder fremde Produktivdaten. Testpasswörter, Tokens und sonstige Zugangsdaten dürfen ausschließlich über Secrets/Umgebungsvariablen bereitgestellt werden und gehören weder in Code noch Logs, Jira oder Confluence.

Fehlende Testkonto-/Supabase-Secrets sind ein **Blocker**. Der E2E-Test darf in diesem Fall nicht still übersprungen, als PASS gewertet oder durch eine manuelle Sichtprüfung ersetzt werden.

### Verbindlicher Kern-Regressionsumfang

Der Browser-Test muss für den vollständigen Kernregressionslauf mindestens abdecken:

- Login mit Testkonto und Dashboard-Ladevorgang,
- zwei Semester anlegen,
- Semester A → B → A wechseln und Datentrennung prüfen,
- Fach anlegen,
- Aufgabe anlegen und Fach/Semester-Zuordnung prüfen,
- Projekt und Unteraufgabe anlegen,
- Timer direkt aus einer Aufgabe starten,
- globalen Timer starten,
- Timer pausieren, fortsetzen und beenden,
- laufenden Timer mindestens auf Dashboard, Aufgaben, Projekte, Statistik, Lernplan, Fächer und Semesterkonfiguration prüfen,
- Reload bei laufendem Timer prüfen,
- Persistenz nach Reload prüfen,
- Statistik gegen die erzeugte Lernzeit fachlich plausibilisieren und Semestertrennung prüfen,
- `console.error`, ungefangene Exceptions, fehlgeschlagene Requests, API-4xx und HTTP-5xx auswerten,
- E2E-Testdaten nach Abschluss bereinigen.

Agenten wählen anhand des tatsächlichen Diffs selbstständig den erforderlichen Testumfang. Der Benutzer muss nicht entscheiden, welcher Browser-Test nötig ist. Timer-, Semester-, Aufgaben-, Projekt-, Statistik-, Dashboard-, Navigations-, Persistenz- und Synchronisationsänderungen lösen mindestens die jeweils betroffenen Kernabläufe aus.

Für automatisierte Regressionen ist der Branch-Build zu testen. Die GitHub-Action `.github/workflows/e2e-regression.yml` baut den aktuellen Branch, startet den Branch-Build lokal und führt Playwright dagegen aus. Bei Fehlern werden soweit verfügbar Trace, Screenshot, Video, Report und Logs als Nachweis aufbewahrt.

## 7. Definition of Done

Ein Agent darf eine Änderung nur als technisch reviewbereit melden, wenn mindestens:

- Akzeptanzkriterien erfüllt sind,
- Scope eingehalten ist,
- relevante Tests erfolgreich sind,
- Regressionstests erfolgreich sind,
- `npm test` erfolgreich ist,
- `npm run test:coverage` erfolgreich ist,
- `npx tsc --noEmit` erfolgreich ist,
- `npm run build` erfolgreich ist,
- bei sichtbaren/interaktiven Kernfunktionen der relevante Browser-/E2E-Test **tatsächlich erfolgreich ausgeführt** wurde,
- der isolierte Test-Account ohne zusätzliche Benutzer-Rückfrage verwendet wurde, sofern ein Browser-/E2E-Test erforderlich war,
- erforderliche E2E-Testdaten eindeutig markiert, erstellt und anschließend bereinigt wurden,
- Timeränderungen mit Start/Pause/Fortsetzen/Beenden, Seitenwechsel, Dashboard, Reload und Statistik geprüft wurden,
- Semesteränderungen mindestens mit A → B → A und Datentrennung geprüft wurden,
- Aufgaben-/Projekt-/Statistikänderungen mit den zugehörigen echten Benutzerabläufen geprüft wurden,
- Browser-Console, ungefangene Exceptions und relevante Request-Fehler geprüft wurden,
- ein fehlender Testlauf oder fehlende E2E-Secrets nicht als PASS behandelt wurden,
- Sicherheitsregeln eingehalten sind,
- keine Tests manipuliert, abgeschwächt oder übersprungen wurden, um Erfolg vorzutäuschen,
- Repair-Loops und offene Risiken dokumentiert sind,
- finaler Diff geprüft wurde,
- erforderliches GitHub Issue und Jira-Vorgang gegenseitig verknüpft sind oder eine zulässige Ausnahme im Jira-Vorgang dokumentiert ist,
- Commit und Pull Request den Jira-Key enthalten,
- Projekt-Hub und alle fachlich betroffenen Confluence-Seiten geprüft und erforderliche Aktualisierungen vorgenommen sind,
- bei aktiviertem `[COPILOT-FALLBACK]` Jira-Scope und Akzeptanzkriterien vor der ersten Codeänderung vollständig geladen und geprüft wurden; fehlender Kontext führt zwingend zu `ASK_USER`, und bei später fehlendem Atlassian-Schreibzugriff wurde eine vollständige Übergabe unter `docs/ai-handoffs/` erstellt.

### Ressourcen- und Kontext-Effizienz

- [ ] Es wurden nur die für die Aufgabe notwendigen Dateien und Bereiche analysiert.
- [ ] Es wurde kein unnötiger vollständiger Repository-Scan durchgeführt.
- [ ] Bereits vorhandener und weiterhin gültiger Kontext wurde wiederverwendet.
- [ ] Wiederholte identische Analysen wurden vermieden.
- [ ] Tests wurden entsprechend dem tatsächlichen Änderungsumfang ausgewählt.
- [ ] Große Dateien wurden möglichst gezielt statt vollständig verarbeitet.
- [ ] Die Optimierung des Nutzerlimits beeinträchtigt weder Qualität noch Sicherheit.
- [ ] Neue Funktionen führen nicht ohne nachvollziehbaren Grund zu deutlich höherem Kontext- oder Nutzerverbrauch.
- [ ] Bei auffällig hohem Ressourcenverbrauch wurde die Ursache dokumentiert.

**Technisch reviewbereit ist nicht gleich Jira `Erledigt`.** Jira darf erst nach abgeschlossenem Review, erforderlichem Test, erfolgreichem Pull Request, bestätigtem Merge nach `main` und abgeschlossenem Confluence-Abgleich auf `Erledigt` gesetzt werden. Ein erforderlicher, aber nicht erfolgreich ausgeführter Browser-/E2E-Test blockiert `Erledigt` und damit die Fortsetzung eines davon abhängigen Sprints.

## 8. Verbindlicher Confluence-Abgleich

Für jeden Jira-Vorgang gilt vor dem Status `Erledigt`:

1. Nach dem Merge den Projekt-Hub und alle in PLAN identifizierten, fachlich betroffenen Confluence-Seiten erneut prüfen.
2. Änderungen an Architektur, Datenmodell, Arbeitsprozess, Roadmap, Sprint, Qualität oder Anleitungen unmittelbar in den jeweiligen Seiten nachziehen.
3. Beschädigte, widersprüchliche oder nachweislich veraltete Inhalte im betroffenen Scope korrigieren; bekannte Dokumentationswidersprüche blockieren `Erledigt`.
4. Wenn keine Confluence-Inhaltsänderung erforderlich ist, im Jira-Abschlusskommentar ausdrücklich `Confluence geprüft – keine Aktualisierung erforderlich` dokumentieren.
5. Jira bleibt die operative Quelle für Status, Sprint, Priorität und Scope; Confluence darf diese Angaben nicht widersprüchlich wiedergeben.
6. Zugangsdaten, Secrets und Testpasswörter niemals in Confluence oder Jira-Nachweisen dokumentieren.

## 9. GitHub-Copilot-Fallback

Der Fallback wird nur aktiviert, wenn ein Benutzerauftrag mit `[COPILOT-FALLBACK]` beginnt. Ein erreichtes ChatGPT-/Codex-Nutzerlimit wird nicht automatisch erkannt.

Zentrale Anleitung und kopierbarer Prompt:

- Confluence: **„KI-Entwicklungsworkflow – Codex- und Copilot-Fallback“**
- https://studien-lernplan-app.atlassian.net/wiki/spaces/PROJEKTHUB/pages/13697025

Bei aktiviertem Fallback gilt:

1. Der Minimalauftrag `[COPILOT-FALLBACK] KAN-XX` ist ausreichend, sobald der Atlassian-Rovo-MCP-Server einmalig per OAuth verbunden wurde. Die Repository-Konfiguration liegt in `.vscode/mcp.json`; Secrets oder Tokens dürfen dort nicht gespeichert werden.
2. Vor jeder Codeänderung über Atlassian Rovo MCP den aktuellen Jira-Vorgang vollständig laden: Titel, Beschreibung, Akzeptanzkriterien, Nicht-Ziele/Constraints, Status und Abhängigkeiten. Danach GitHub Issue, `AGENTS.md`, `.github/copilot-instructions.md`, `README.md` und bei nicht-trivialen Aufgaben `docs/LOOP_ENGINEERING.md` lesen.
3. Erst implementieren, wenn Jira-Scope und Akzeptanzkriterien vollständig und widerspruchsfrei vorliegen. Fehlen Angaben, ist das Ergebnis `ASK_USER`; vor der Antwort dürfen keine Code-, Commit- oder Push-Änderungen erfolgen.
4. Falls Atlassian Rovo MCP nicht verfügbar ist, darf nur dann gearbeitet werden, wenn der Benutzerprompt oder ein vertrauenswürdig verknüpftes GitHub Issue einen ausdrücklich aktuellen, vollständigen Jira-Snapshot mit Titel, Beschreibung, Akzeptanzkriterien, Nicht-Zielen/Constraints, Status und Abhängigkeiten enthält. Vollständigkeit und Widerspruchsfreiheit müssen vor der Implementierung geprüft werden.
5. Fehlt dieser vollständige Offline-Snapshot, gilt zwingend `ASK_USER` und Arbeitsstopp. Eine erst nach der Implementierung erzeugte Übergabedatei ersetzt die vorherige Scope-Prüfung nicht.
6. Mit Atlassian-Zugriff Jira und fachlich betroffene Confluence-Seiten vor der Änderung lesen und nach der Umsetzung aktualisieren. Die vorhandene zentrale Workflow-Seite verwenden und niemals eine gleichnamige zweite Seite anlegen.
7. Sind nach der Implementierung Jira-/Confluence-Schreibzugriffe nicht verfügbar, `docs/ai-handoffs/<JIRA-ID>-atlassian-update.md` erstellen. Diese Übergabe dokumentiert ausschließlich ausstehende Aktualisierungen; sie ist keine Freigabe, ohne vorher geladene Kriterien zu programmieren.
8. Die Übergabe muss Jira-Kommentar, empfohlenen Jira-Status, geprüfte Akzeptanzkriterien, geänderte Dateien, Prüfungen, Branch, Commit, vollständigen Confluence-Text, Zielseite, Einfügestelle, Risiken, offene Punkte und nächsten Schritt enthalten. Dieselben Informationen zusätzlich kopierfertig in der Abschlussantwort ausgeben.
9. Keine Secrets, Tokens, Passwörter oder Testzugangsdaten in Konfiguration oder Übergaben aufnehmen.
10. Ein erfolgreicher Commit oder Push bedeutet nur technisch reviewbereit und setzt Jira nicht automatisch auf `Erledigt`.
11. Ausschließlich den Aufgaben-Branch committen und pushen; nicht direkt nach `main` pushen oder mergen.

Der Abschlussbericht nennt Umsetzung, Dateien, Prüfungen, Akzeptanzkriterien, Jira-/Confluence-Status, Branch, Commit, Risiken, offene Punkte und nächsten Schritt.

## 10. Commit, Push, PR und Merge

Nach erfolgreichen Prüfungen:

1. `git diff` und `git status` kontrollieren.
2. nur Ticket-Scope committen.
3. Commit-Nachricht mit Jira-Key verwenden.
4. Pull Request mit Jira-Key, Jira-Link und `Refs #<GitHub-Issue>` vorbereiten.
5. ausschließlich Aufgaben-Branch pushen.
6. keinen direkten Push nach `main` durchführen.
7. Pull Request nach dem dokumentierten Workflow erstellen/prüfen.
8. Review-Hinweise vollständig bewerten und nötige Änderungen erneut testen.
9. Merge nur nach den festgelegten Freigaberegeln.
10. GitHub Issue erst nach Merge, vollständiger Definition of Done und Jira `Erledigt` mit Abschlussnachweis schließen.

Der Abschlussbericht enthält Branch, Ausgangs-HEAD, Commit, geänderte Dateien, Prüfungen, Browserergebnis, Repair-Loops, Risiken und offene Punkte.

## 11. KI-/Agenten-Code in der App

Neue AI-/Agentenlogik nicht weiter in `src/App.jsx` konzentrieren. Bevorzugte Zuständigkeiten:

- `src/features/ai/` – UI/Feature-Orchestrierung
- `src/domain/ai/` – fachliche Modelle/Regeln
- `src/infrastructure/ai/` – Provider-, Tool- und Persistenzadapter

Provider-Secrets gehören niemals in clientseitigen React-Code. Serverseitige Provider-Aufrufe, Policies, RLS-konforme Datenzugriffe, Audit Logging, Tool-Schemas und Loop-Budgets müssen getrennt umgesetzt werden.

Weitere Architekturregeln: `docs/LOOP_ENGINEERING.md`.
