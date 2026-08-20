# GitHub Copilot Instructions – Studien-Lernplan-App

Diese Regeln gelten für GitHub Copilot beim Arbeiten in diesem Repository.

## Vor jeder Änderung

1. Aktiven Jira-Vorgang und Akzeptanzkriterien kennen.
2. Vor einer Repository-Änderung das zugehörige GitHub Issue oder die in Jira dokumentierte Ausnahme prüfen; keine Duplikate erzeugen.
3. `AGENTS.md` lesen und als verbindliche Arbeitsregel behandeln.
4. `README.md` lesen.
5. Bei nicht-trivialen Änderungen `docs/LOOP_ENGINEERING.md` lesen.
6. Relevante bestehende Tests vor der Implementierung prüfen.

## Copilot-Fallback bei erreichtem ChatGPT-/Codex-Limit

Die besonderen Fallback-Regeln gelten nur, wenn der Benutzerauftrag mit `[COPILOT-FALLBACK]` beginnt.

Dann gilt zusätzlich:

1. Den vollständigen Abschnitt **„GitHub-Copilot-Fallback“** in `AGENTS.md` befolgen. Nach der einmaligen Atlassian-OAuth-Verbindung genügt als Auftrag `[COPILOT-FALLBACK] KAN-XX`.
2. Vor jeder Codeänderung über den in `.vscode/mcp.json` konfigurierten Atlassian-Rovo-MCP-Server den aktuellen Jira-Vorgang vollständig laden: Titel, Beschreibung, Akzeptanzkriterien, Nicht-Ziele/Constraints, Status und Abhängigkeiten.
3. Nur mit vollständigem, widerspruchsfreiem Scope implementieren. Ist MCP nicht verfügbar, ist ausschließlich ein ausdrücklich aktueller, vollständiger Jira-Snapshot im Prompt oder vertrauenswürdig verknüpften GitHub Issue zulässig.
4. Wenn weder MCP-Daten noch ein vollständiger Offline-Snapshot vorliegen, zwingend `ASK_USER` ausgeben und vor Code-, Commit- und Push-Änderungen stoppen. Eine spätere Übergabedatei ersetzt diese Vorabprüfung nicht.
5. Mit Atlassian-Zugriff Jira und relevante Confluence-Seiten direkt lesen und nach der Umsetzung aktualisieren. Die bestehende Confluence-Seite **„KI-Entwicklungsworkflow – Codex- und Copilot-Fallback“** verwenden und kein Duplikat erstellen:
   https://studien-lernplan-app.atlassian.net/wiki/spaces/PROJEKTHUB/pages/13697025
6. Falls erst nach der Implementierung kein Atlassian-Schreibzugriff verfügbar ist, `docs/ai-handoffs/<JIRA-ID>-atlassian-update.md` mit kopierfertigem Jira- und Confluence-Inhalt erstellen.
7. In der Abschlussantwort Umsetzung, Dateien, Prüfungen, Jira-/Confluence-Status, Branch, Commit, Risiken, offene Punkte und nächsten Schritt nennen.
8. Am Schluss die fertigen Änderungen mit Jira-Key committen und ausschließlich den Aufgaben-Branch pushen. Nicht direkt auf `main` pushen und keinen Merge durchführen.

## Scope

- Nur Änderungen umsetzen, die zum aktiven Jira-Vorgang gehören.
- Keine zusätzlichen Features, Paket-Upgrades oder Refactorings ohne Ticket aufnehmen.
- Bestehendes Verhalten und Design erhalten, soweit das Ticket keine Änderung verlangt.
- Keine Secrets, Tokens, Passwörter oder produktiven Zugangsdaten erzeugen oder in Code/Logs/Dokumentation aufnehmen.

## Kontext- und Nutzerlimit-Effizienz

- Jede Aufgabe mit dem kleinstmöglichen notwendigen Kontext durchführen; vollständige Repository-Analysen nur bei tatsächlich repositoryweitem Scope.
- Mit Scope, `git status`, Git-Diff und geänderten Dateien beginnen. Unveränderte Dateien oder bereits geklärte Architektur nicht erneut analysieren.
- `docs/CONTEXT_EFFICIENCY.md` als kompakte Kontextkarte verwenden und weiterhin gültige Nachweise desselben Arbeitslaufs wiederverwenden.
- Große Dateien, insbesondere `src/App.jsx`, über Suche, Symbole und relevante Zeilenbereiche untersuchen.
- Lokale deterministische Prüfungen gegenüber KI-Analyse bevorzugen, wenn sie dieselbe Aussage zuverlässig liefern.
- Zuerst gezielte Tests ausführen, danach alle Pflichtprüfungen einmal für den finalen Kandidaten. Nach Änderungen nur die dadurch ungültig gewordenen Nachweise erneuern.
- Keine Ressourcenoptimierung darf notwendige Qualitäts-, Sicherheits-, Browser- oder Regressionstests auslassen.
- Im Abschlussbericht untersuchte Bereiche, Prüfungen, wiederverwendete Nachweise und begründete Vollscans nennen.

## Entwicklungs-Loop

Bei nicht-trivialen Aufgaben nach folgendem Muster arbeiten:

```text
PLAN → IMPLEMENT → VERIFY → EVALUATE
                         ├─ PASS
                         ├─ RETRY
                         ├─ ASK_USER
                         └─ ABORT
```

- Vorher Ziel, Scope, Risiken und Tests bestimmen.
- Nach jeder Implementierungsrunde das Ergebnis gegen Akzeptanzkriterien prüfen.
- Maximal drei Reparaturversuche pro zusammenhängender Fehlerursache.
- Eine bereits fehlgeschlagene Strategie nicht unverändert wiederholen.
- Identische Analysen oder vollständige Prüfläufe nicht ohne geänderten Stand oder neue technische Begründung wiederholen.
- Bei Auth-/RLS-/destruktiven Datenbank-/Secret-Risiken stoppen und menschliche Entscheidung verlangen.

Die vollständigen Regeln stehen in `docs/LOOP_ENGINEERING.md`.

## Qualität

Grundsätzlich vorhandene Pflichtprüfungen verwenden:

```bash
npm test
npm run test:coverage
npx tsc --noEmit
npm run build
```

Bei sichtbaren/interaktiven Änderungen zusätzlich Browser-/E2E-Prüfung vorsehen.

Tests niemals löschen, überspringen oder abschwächen, nur um einen grünen Status zu erreichen.

## Browser-/E2E-Regeln

`AGENTS.md` und `docs/BROWSER_E2E_POLICY.md` sind verbindlich.

- Der isolierte Test-Account ist für erforderliche Browser-, E2E-, Smoke-, Regression- und Funktionstests vorab freigegeben.
- **Nicht nachfragen**, ob der Test gestartet oder der Test-Account verwendet werden soll.
- Notwendige E2E-Testdaten selbstständig mit `E2E-<Run-ID>-...` kennzeichnen, erstellen und anschließend bereinigen.
- Fehlende Testkonto-/Supabase-Secrets sind ein Blocker; Tests niemals still skippen oder als PASS werten.
- Bei Änderungen an Timer, Semester, Aufgaben, Projekten, Statistik, Dashboard, Navigation, Persistenz oder Synchronisierung den betroffenen echten Benutzerablauf selbstständig auswählen und testen.
- Der Kernregressionslauf umfasst Semester A → B → A, Fach, Aufgabe, Projekt/Subtask, Timer normal und aus Aufgabe, Pause/Fortsetzen/Beenden, seitenübergreifende Timeranzeige, Reload, Statistik, Persistenz sowie Console-/Request-Fehler.
- `.github/workflows/e2e-regression.yml` und `e2e/core-regression.spec.js` sind der automatisierte Kernnachweis. Ein nicht ausgeführter erforderlicher Browser-Test blockiert `Done`.

## Git / GitHub

- Nicht direkt auf `main` arbeiten oder pushen.
- Jira bleibt die operative Quelle; das GitHub Issue dient der repositorynahen technischen Nachverfolgung.
- Jira-Vorgang und GitHub Issue müssen vor der Implementierung gegenseitig verknüpft sein, sofern keine in `AGENTS.md` definierte und in Jira dokumentierte Ausnahme greift.
- Branch und Commit müssen den Jira-Kontext eindeutig erkennen lassen.
- Commit-Nachricht enthält den Jira-Key.
- Der Pull Request enthält Jira-Link und `Refs #<GitHub-Issue>`, aber keine automatische Schließformel.
- Das GitHub Issue bleibt bis zum bestätigten Merge, vollständiger Definition of Done, Confluence-Abgleich und Jira `Erledigt` offen und wird anschließend mit Abschlussnachweis geschlossen.
- Nur ticketbezogene Änderungen committen.
- Review-/PR-/Merge-Regeln aus `AGENTS.md` und der Confluence-Definition-of-Done beachten.

## Definition of Done

Ein erfolgreiches Copilot-Ergebnis bedeutet nur **technisch reviewbereit**, nicht automatisch Jira `Erledigt`.

`Erledigt` setzt weiterhin voraus: Akzeptanzkriterien, Tests, erforderliche tatsächlich ausgeführte Browser-/E2E-Prüfung, Review, geklärte Hinweise, erfolgreichen PR/Merge nach `main` sowie aktuelle Jira-/Confluence-Dokumentation. Bei blockierenden Sofortaufgaben darf der nächste Sprint erst weitergeführt werden, wenn diese vollständige Definition of Done erfüllt ist.

## Verknüpfte Dokumente

- `AGENTS.md` – verbindliche Agentenregeln
- `docs/LOOP_ENGINEERING.md` – Loop-, Evaluations-, Retry- und Stop-Regeln
- `docs/BROWSER_E2E_POLICY.md` – Browser-/E2E-Kernregression und Testkonto-Regeln
- `README.md` – Repository-Überblick
- Jira KAN-30 / KAN-72 / KAN-73 / KAN-74 / KAN-109
- Confluence: „Arbeitsprozess und Definition of Done“
- Confluence: „KI-Entwicklungsworkflow – Codex- und Copilot-Fallback“
