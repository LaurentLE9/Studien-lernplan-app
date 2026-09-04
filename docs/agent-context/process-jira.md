# Router: Prozess / Jira

Nutzen bei Jira-, GitHub-, Confluence-, DoD-, Branch-, PR-, Review- und Handover-Aufgaben.

## Primär laden

- aktiven Jira-Vorgang mit Akzeptanzkriterien
- `AGENTS.md`
- GitHub Issue zum Jira-Key
- aktuellen Branch/Commit-/Diff-Stand

## Nach Bedarf

- `docs/LOOP_ENGINEERING.md` bei nicht-trivialer Implementierung oder Prozessfrage
- relevante Confluence-Seite nur, wenn Ticket oder Abschlussabgleich sie betrifft
- frühere PRs/Kommentare nur, wenn sie für offenen Scope, Review oder Regression nötig sind

## Fortsetzung

Bei „mit KAN-XX weitermachen“ zuerst vorhandenen `docs/ai-handoffs/KAN-XX-status.md` oder gleichwertigen Task-State prüfen. Danach nur seit diesem Stand geänderte oder als offen markierte Quellen nachladen.

## Merge-Readiness

Vor „merge-ready“ müssen finaler Diff, alle für den finalen Head erforderlichen automatisierten Prüfungen und offene Review-Hinweise geklärt sein. Der endgültige Confluence-Abgleich und Jira-Status `Erledigt` erfolgen weiterhin erst nach bestätigtem Merge gemäß `AGENTS.md`.
