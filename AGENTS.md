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

Soweit eine Änderung sichtbares oder interaktives Verhalten betrifft:

- isolierte Testumgebung/Testgruppe verwenden,
- keine vorhandenen Nutzertabs verändern,
- Vercel-Deployment anhand Jira-Key, Branch und Commit identifizieren,
- Status `Ready` bestätigen,
- zugehörige Preview öffnen,
- betroffene Funktionen und zentrale abhängige Kernabläufe prüfen,
- neue Console Errors dokumentieren,
- Testtabs nach Abschluss schließen.

Sobald KAN-72 umgesetzt ist, ist der isolierte Testnutzer für diese Prüfungen verbindlich zu verwenden.

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
- erforderliche Browserprüfung dokumentiert ist,
- Sicherheitsregeln eingehalten sind,
- keine Tests manipuliert wurden, um Erfolg vorzutäuschen,
- Repair-Loops und offene Risiken dokumentiert sind,
- finaler Diff geprüft wurde,
- erforderliches GitHub Issue und Jira-Vorgang gegenseitig verknüpft sind oder eine zulässige Ausnahme im Jira-Vorgang dokumentiert ist,
- Commit und Pull Request den Jira-Key enthalten,
- Projekt-Hub und alle fachlich betroffenen Confluence-Seiten geprüft und erforderliche Aktualisierungen vorgenommen sind.

**Technisch reviewbereit ist nicht gleich Jira `Erledigt`.** Jira darf erst nach abgeschlossenem Review, erforderlichem Test, erfolgreichem Pull Request, bestätigtem Merge nach `main` und abgeschlossenem Confluence-Abgleich auf `Erledigt` gesetzt werden.

## 8. Verbindlicher Confluence-Abgleich

Für jeden Jira-Vorgang gilt vor dem Status `Erledigt`:

1. Nach dem Merge den Projekt-Hub und alle in PLAN identifizierten, fachlich betroffenen Confluence-Seiten erneut prüfen.
2. Änderungen an Architektur, Datenmodell, Arbeitsprozess, Roadmap, Sprint, Qualität oder Anleitungen unmittelbar in den jeweiligen Seiten nachziehen.
3. Beschädigte, widersprüchliche oder nachweislich veraltete Inhalte im betroffenen Scope korrigieren; bekannte Dokumentationswidersprüche blockieren `Erledigt`.
4. Wenn keine Confluence-Inhaltsänderung erforderlich ist, im Jira-Abschlusskommentar ausdrücklich `Confluence geprüft – keine Aktualisierung erforderlich` dokumentieren.
5. Jira bleibt die operative Quelle für Status, Sprint, Priorität und Scope; Confluence darf diese Angaben nicht widersprüchlich wiedergeben.
6. Zugangsdaten, Secrets und Testpasswörter niemals in Confluence oder Jira-Nachweisen dokumentieren.

## 9. Commit, Push, PR und Merge

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

## 10. KI-/Agenten-Code in der App

Neue AI-/Agentenlogik nicht weiter in `src/App.jsx` konzentrieren. Bevorzugte Zuständigkeiten:

- `src/features/ai/` – UI/Feature-Orchestrierung
- `src/domain/ai/` – fachliche Modelle/Regeln
- `src/infrastructure/ai/` – Provider-, Tool- und Persistenzadapter

Provider-Secrets gehören niemals in clientseitigen React-Code. Serverseitige Provider-Aufrufe, Policies, RLS-konforme Datenzugriffe, Audit Logging, Tool-Schemas und Loop-Budgets müssen getrennt umgesetzt werden.

Weitere Architekturregeln: `docs/LOOP_ENGINEERING.md`.
