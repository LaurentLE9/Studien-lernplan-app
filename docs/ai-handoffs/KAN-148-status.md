# KAN-148 – Arbeitsstand und direkte Fortsetzung

Stand: 2026-09-03, nach erfolgreichem E2E-Lauf und Merge von PR #50.

## Verknüpfungen

- Jira: https://studien-lernplan-app.atlassian.net/browse/KAN-148
- Blockierter Vorgang: KAN-134
- GitHub Issue: https://github.com/LaurentLE9/Studien-lernplan-app/issues/49
- Pull Request: https://github.com/LaurentLE9/Studien-lernplan-app/pull/50
- E2E-Run: https://github.com/LaurentLE9/Studien-lernplan-app/actions/runs/33625655182

## Git-Stand

- Branch: `fix/KAN-148-supabase-e2e-aborts`
- Ausgangs-HEAD (`origin/main`): `d70a34094f5517e470b89efb6104c97334d93818`
- Implementierungs-Commit: `403e26cf7660f9bda89d831332a6657de11a3a6a`
- Merge-Commit auf `main`: `e6718649c70ae9ca130aff3174d9d3e1e1031bd9`
- Dokumentationsbranch: `docs/KAN-148-abschlussnachweis`
- PR #50 wurde am 2026-09-03 erfolgreich gemergt.

## Bestätigte Ursache

Die fehlgeschlagenen Supabase-Requests waren keine RLS-, Auth- oder Backend-Fehler. Der Playwright-Trace des früheren Runs `33622563702` zeigt:

- `exams` und `study_time_entries` starteten unmittelbar vor einem Test-Reload.
- `page.waitForLoadState('networkidle')` kehrte sofort zurück, weil dieser Load-State bereits früher erreicht worden war; er prüft nicht zuverlässig die aktuell laufenden Requests.
- Der folgende Reload brach die noch laufenden Fetches mit `net::ERR_ABORTED` ab.
- Die App protokollierte deshalb `TypeError: Failed to fetch`.
- Supabase lieferte in anderen Trace-Snapshots HTTP 200; es gibt keinen Hinweis auf eine notwendige RLS-, Auth-, Session- oder Datenbankänderung.

## Umgesetzter Fix

- `e2e/helpers/app.js`
  - verfolgt laufende Supabase-API-Requests (`/auth/v1/` und `/rest/v1/`),
  - entfernt sie bei `requestfinished` oder `requestfailed`,
  - wartet vor Test-Reloads auf null laufende Requests und anschließend 800 ms stabile Ruhe,
  - bricht nach 10 Sekunden mit einem klaren Fehler ab, statt Fehler zu ignorieren oder Requests blind zu wiederholen.
- `src/test/e2e-browser-guard.test.js`
  - Regressionstest für einen laufenden Request,
  - Regressionstest für einen verspätet startenden Request während der Ruhephase,
  - Fehlerfall für einen dauerhaft offenen Request.

Die bestehenden Browser-Guards bleiben streng: echte `requestfailed`-, Konsolen-, API-4xx- und HTTP-5xx-Fehler werden weiterhin erfasst. Tests wurden nicht abgeschwächt.

## Bereits erfolgreiche Prüfungen für Commit 403e26c

- gezielter Regressionstest: 2/2 grün
- `npm run integrity:verify`: PASS
- `npm test`: 10 Dateien, 81 Tests, PASS
- `npm run test:coverage`: 10 Dateien, 81 Tests, PASS
- `npx tsc --noEmit`: PASS
- `npm run build`: PASS
- `npm run integrity:finish`: PASS
- vollständiger Browser-E2E-Lauf `33625655182`: PASS (2m18s)
- Vercel-Deployment für PR #50: PASS
- finaler PR-Diff-Review: PASS
- Jira-Abschlussnachweis vor Merge: Kommentar `10678`
- GitHub Issue #49 wurde mit dem technischen Nachweis aktualisiert.
- Confluence-Projekt-Hub auf Version 33 aktualisiert: frühere „transient“-Einordnung korrigiert und KAN-148-Abschluss ergänzt.
- „Arbeitsprozess und Definition of Done“ sowie „Qualität, Security und IT-IKS“ geprüft; dort war keine Inhaltsänderung erforderlich.

Bekannte, nicht ticketbezogene Warnungen: veraltete Browserslist-Daten und großer Vite-Chunk. Keine Paket-Upgrades im KAN-148-Scope.

## Fortsetzung

1. Dokumentationsbranch prüfen, committen und über einen separaten PR mergen.
2. Post-Merge-Prüfungen auf dem finalen `main`-Stand dokumentieren.
3. Projekt-Hub und fachlich betroffene Confluence-Seiten abgleichen.
4. Jira KAN-148 und GitHub Issue #49 erst nach vollständigem Abschlussnachweis schließen.
5. Anschließend den dadurch entsperrten KAN-134 gemäß Definition of Done fortsetzen.

Bei einem fehlgeschlagenen E2E-Lauf zuerst die GitHub-Logs und Playwright-Artefakte dieses Runs auswerten. Keine RLS-/Auth-/Session-Änderung ohne ausdrückliche Freigabe und keine Abschwächung von `assertNoBrowserErrors`.
