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

## Verbindliches Post-Merge-Gate: Copilot-Review

Nach einem Merge darf der Jira-Vorgang nicht sofort auf `Erledigt` gesetzt und das GitHub Issue nicht sofort geschlossen werden.

1. Wenn eine GitHub-Copilot-E-Mail zum Pull Request/Review eingegangen ist, diese prüfen.
2. Unabhängig von der E-Mail den maßgeblichen GitHub-PR-Review-Stand prüfen, damit fehlende/deaktivierte Copilot-E-Mails oder Zustellfehler den Abschluss nicht dauerhaft blockieren.
3. Enthaltene Review-, Security-, Quality- oder Regression-Hinweise vollständig bewerten.
4. Sinnvolle Hinweise über den bestehenden Jira-/Branch-/Test-/Review-Prozess beheben; bei notwendiger Korrektur bleibt bzw. wird der Vorgang wieder `In Arbeit`.
5. Unzutreffende Hinweise mit kurzer Begründung im Abschlussnachweis dokumentieren.
6. Das Gate gilt als erfüllt, wenn entweder die vorhandene Copilot-E-Mail geprüft wurde oder – falls keine solche E-Mail existiert – der aktuelle PR-Review-Stand ausdrücklich geprüft und dokumentiert wurde und keine ungeklärten relevanten Hinweise offen sind.
7. Erst danach den finalen Confluence-Abgleich durchführen, Jira auf `Erledigt` setzen und das GitHub Issue schließen.

Die E-Mail ist ein zusätzlicher Prüftrigger, aber nicht die alleinige Quelle der Wahrheit. Maßgeblich ist der GitHub-PR-/Review-Stand. Secrets oder Zugangsdaten dürfen weder aus E-Mails noch aus Review-Inhalten in Jira, GitHub oder Handover-Dateien kopiert werden.
