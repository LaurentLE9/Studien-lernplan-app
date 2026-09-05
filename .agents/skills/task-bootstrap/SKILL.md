---
name: task-bootstrap
description: Startet oder setzt eine Jira-basierte Entwicklungsaufgabe fort. Verwenden, wenn ein KAN-Ticket begonnen, wiederaufgenommen oder der aktuelle Arbeitsstand rekonstruiert werden soll.
---

# Task Bootstrap

## Eingaben

- Jira-Key bzw. eindeutig bestimmbarer aktiver Vorgang
- aktueller Benutzerauftrag

## Mindestkontext

1. aktiven Jira-Vorgang vollständig lesen,
2. `AGENTS.md`,
3. `docs/agent-context/README.md`,
4. `docs/agent-context/process-jira.md`,
5. Branch/HEAD/Remote/Working-Tree-Status,
6. verknüpftes GitHub Issue,
7. bei Fortsetzung vorhandenen Task-State unter `docs/ai-handoffs/`.

## Ablauf

1. Ticket-Scope, Akzeptanzkriterien, Nicht-Ziele und Status zusammenfassen.
2. Prüfen, ob ein passendes GitHub Issue existiert; keine Duplikate erzeugen.
3. Prüfen, ob auf einem Jira-konformen Aufgaben-Branch gearbeitet wird; niemals direkt auf `main` implementieren.
4. Bei Fortsetzung nur seit dem Task-State geänderte oder offene Quellen nachladen.
5. Betroffene Domänen bestimmen und nur passende Router/Skills nachladen.
6. `requiredCapability=low|medium|high` nach `docs/MODEL_ROUTING.md` bestimmen.
7. Nächsten passenden Skill oder `PLAN` festlegen.

## Erlaubte Aktionen und Grenzen

- Prozess-/Statusinformationen lesen und verknüpfen.
- Fehlendes GitHub Issue bzw. Aufgaben-Branch nur nach den verbindlichen Regeln aus `AGENTS.md` anlegen.
- Keine fachliche App-Implementierung innerhalb dieses Skills.
- Keine Annahmen über aktives Modell, Provider oder Capability.

## Eskalation / Stop

Stoppen oder gezielt nachladen, wenn Ticket-Scope, Sicherheitsfreigabe, fremde Änderungen oder erforderlicher Kontext nicht sicher bestimmbar sind. Bei Capability-Eskalation ausschließlich den Model-Router verwenden.

## Ausgabe

Kurz ausgeben:

- Jira-Key und Status,
- GitHub Issue,
- Branch/HEAD,
- Scope und Nicht-Ziele,
- geladene Router,
- `requiredCapability`,
- offene Blocker/Risiken,
- nächster Skill bzw. nächster konkreter Schritt.