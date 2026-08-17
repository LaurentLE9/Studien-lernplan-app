# GitHub Copilot Instructions – Studien-Lernplan-App

Diese Regeln gelten für GitHub Copilot beim Arbeiten in diesem Repository.

## Vor jeder Änderung

1. Aktiven Jira-Vorgang und Akzeptanzkriterien kennen.
2. Vor einer Repository-Änderung das zugehörige GitHub Issue oder die in Jira dokumentierte Ausnahme prüfen; keine Duplikate erzeugen.
3. `AGENTS.md` lesen und als verbindliche Arbeitsregel behandeln.
4. `README.md` lesen.
5. Bei nicht-trivialen Änderungen `docs/LOOP_ENGINEERING.md` lesen.
6. Relevante bestehende Tests vor der Implementierung prüfen.

## Scope

- Nur Änderungen umsetzen, die zum aktiven Jira-Vorgang gehören.
- Keine zusätzlichen Features, Paket-Upgrades oder Refactorings ohne Ticket aufnehmen.
- Bestehendes Verhalten und Design erhalten, soweit das Ticket keine Änderung verlangt.
- Keine Secrets, Tokens, Passwörter oder produktiven Zugangsdaten erzeugen oder in Code/Logs/Dokumentation aufnehmen.

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

Bei sichtbaren/interaktiven Änderungen zusätzlich Browser-/Preview-Prüfung vorsehen.

Tests niemals löschen, überspringen oder abschwächen, nur um einen grünen Status zu erreichen.

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

`Erledigt` setzt weiterhin voraus: Akzeptanzkriterien, Tests, erforderliche Browserprüfung, Review, geklärte Hinweise, erfolgreichen PR/Merge nach `main` sowie aktuelle Jira-/Confluence-Dokumentation.

## Verknüpfte Dokumente

- `AGENTS.md` – verbindliche Agentenregeln
- `docs/LOOP_ENGINEERING.md` – Loop-, Evaluations-, Retry- und Stop-Regeln
- `README.md` – Repository-Überblick
- Jira KAN-30 / KAN-72 / KAN-73 / KAN-74
- Confluence: „Arbeitsprozess und Definition of Done“
