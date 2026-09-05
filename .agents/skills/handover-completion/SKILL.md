---
name: handover-completion
description: Erstellt Handover- und Abschlussnachweise und steuert Review-Readiness beziehungsweise Post-Merge-Abschluss. Verwenden am Ende eines Arbeitsblocks, vor einem PR oder nach bestätigtem Merge.
---

# Handover and Completion

## Eingaben

- Jira-Key
- Branch/Commit/PR-/Merge-Status
- aktuelle Prüfnachweise

## Mindestkontext

- `AGENTS.md`
- `docs/agent-context/process-jira.md`
- Jira-Vorgang und GitHub Issue
- finaler Diff bzw. bestätigter Merge-Stand
- relevante Review-Hinweise
- betroffene Confluence-Seiten nur für den erforderlichen Abschlussabgleich

## Ablauf

### Vor Merge / Review-Readiness

1. Akzeptanzkriterien, Scope und Prüfungen abgleichen.
2. Jira, GitHub Issue, Branch, Commits und PR korrekt verknüpfen.
3. `npm run integrity:finish` vor Push/PR ausführen, soweit vorgesehen.
4. Task-State/Handover mit gültigen Nachweisen, Risiken und nächsten Schritten aktualisieren.
5. Nur `technisch reviewbereit` melden; Jira nicht vorzeitig auf `Erledigt` setzen.

### Nach bestätigtem Merge

1. maßgeblichen GitHub-PR-/Copilot-Review-Stand prüfen,
2. relevante Hinweise klären oder dokumentiert verwerfen,
3. erforderliche Nachprüfung durchführen,
4. Projekt-Hub und betroffene Confluence-Seiten prüfen/aktualisieren,
5. Jira auf `Erledigt` setzen,
6. anschließend GitHub Issue mit Abschlussnachweis schließen.

## Erlaubte Aktionen und Grenzen

- Handover-/Prozessdokumentation aktualisieren und erlaubte Status-/Link-Aktionen durchführen.
- Kein autonomer Merge, wenn bestehende Freigaberegeln dies nicht erlauben.
- Keine offenen relevanten Review-, Test-, Security- oder Datenintegritätsprobleme als erledigt markieren.

## Eskalation / Stop

Stoppen, wenn Merge nicht bestätigt ist, Review-Hinweise ungeklärt sind, Pflichtprüfungen fehlen oder menschliche Freigabe erforderlich ist.

## Ausgabe

- Jira-Key und GitHub Issue,
- verwendete Router/Skills,
- Prüfungen/Nachweise,
- Routing-Modus und `requiredCapability`,
- Branch/Commit/PR/Merge-Status,
- Confluence-Abgleich,
- Vollscan ja-nein mit Grund,
- offene Risiken/Blocker,
- Status: `technisch reviewbereit`, `post-merge offen` oder `vollständig abgeschlossen`.