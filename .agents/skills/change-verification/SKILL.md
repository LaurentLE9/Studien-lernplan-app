---
name: change-verification
description: Wählt und führt die für eine Änderung erforderlichen Prüfungen aus und bewertet das Ergebnis. Verwenden nach Implementierung, Review-Fixes oder vor technischer Review-Readiness.
---

# Change Verification

## Eingaben

- Jira-Key und Akzeptanzkriterien
- finaler Kandidaten-Diff
- betroffene Domänen und Verhalten

## Mindestkontext

- `AGENTS.md`
- `docs/agent-context/testing.md`
- `docs/LOOP_ENGINEERING.md`
- bei UI/Interaktion `docs/BROWSER_E2E_POLICY.md`
- betroffene Tests und relevante CI-/Package-Skripte

## Ablauf

1. `npm run integrity:verify` ausführen, soweit für den Workflow vorgesehen.
2. Zuerst kleinste gezielte Tests für die Änderung ausführen.
3. Danach alle laut DoD und Scope erforderlichen vollständigen Prüfungen ausführen.
4. Bei sichtbarem/interaktivem Verhalten erforderliche Browser-/E2E-Prüfung tatsächlich durchführen.
5. `git diff --check` und finalen Diff auf Scope, Security und Datenintegrität prüfen.
6. Fehlgeschlagene Prüfung analysieren; maximal drei Reparaturversuche pro zusammenhängender Ursache.
7. Ergebnis als `PASS`, `RETRY`, `ASK_USER` oder `ABORT` klassifizieren.

## Erlaubte Aktionen und Grenzen

- Prüfungen und notwendige kleine Reparaturen gemäß Execution Loop.
- Weiterhin gültige Nachweise nur wiederverwenden, wenn relevanter Commit/Arbeitsbaum und Quellen unverändert sind.
- Tests, Assertions, Coverage-Grenzen oder Gates niemals nur zum Erreichen von Grün abschwächen.
- Fehlende erforderliche Test-Secrets sind Blocker, kein PASS.

## Eskalation / Stop

- `ASK_USER` nur für echte menschliche Entscheidung/Freigabe.
- Capability-Eskalation über `docs/MODEL_ROUTING.md`, nicht über erfundene Modellnamen.
- Nach drei erfolglosen Reparaturversuchen `ABORT` bzw. Stop-Regel anwenden.

## Ausgabe

- ausgeführte und wiederverwendete Prüfungen,
- Ergebnis je Prüfung,
- Browser/E2E erforderlich und tatsächlich ausgeführt ja-nein,
- Security-/Datenintegritätscheck,
- Repair-Loops,
- Gesamtergebnis `PASS|RETRY|ASK_USER|ABORT`,
- offene Blocker.