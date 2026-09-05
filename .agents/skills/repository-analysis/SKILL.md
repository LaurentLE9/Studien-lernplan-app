---
name: repository-analysis
description: Führt eine gezielte Read-only-Analyse des Repositories für einen Ticket-Scope, Bug oder Architekturpunkt durch. Verwenden, bevor eine Änderung geplant wird oder wenn Ursache, Abhängigkeiten oder betroffene Dateien noch unklar sind.
---

# Repository Analysis

## Eingaben

- Jira-/Aufgaben-Scope
- konkrete Analysefrage oder Fehlerbild

## Mindestkontext

- `AGENTS.md`
- `docs/agent-context/README.md`
- nur die zum Scope passenden Domänen-Router
- relevante Datei-/Symbol-/Diff-Bereiche und kleinste direkte Abhängigkeiten

## Ablauf

1. Analysefrage in überprüfbare Teilfragen zerlegen.
2. Mit Suche, Symbolen, Imports, Diffs und kleinen Zeilenbereichen beginnen.
3. Direkte Aufrufer, Datenflüsse und relevante Tests nur bei belegter Notwendigkeit nachladen.
4. Ist-Verhalten, vermutete Ursache und Belege strikt trennen.
5. Risiken für Security, Datenintegrität, Regression und Architektur markieren.
6. Kleinsten sinnvollen Implementierungs- und Test-Scope vorschlagen.
7. Nur wenn der enge Pfad nicht genügt, auf eine breitere Kontextstufe eskalieren und Grund dokumentieren.

## Erlaubte Aktionen und Grenzen

- Read-only-Analyse; keine Repository-Dateien verändern.
- Kein vollständiger Repository-/Jira-/Confluence-Scan ohne konkrete Notwendigkeit.
- Keine unbelegten Architektur- oder Datenannahmen als Tatsache darstellen.

## Eskalation / Stop

- `medium` oder `high` Capability anfordern, wenn Architekturkopplung, Security-Risiko oder Unsicherheit dies verlangt.
- Bei Auth/RLS, riskanten Migrationen oder möglichem Datenverlust die Stop-Regeln aus `AGENTS.md` beachten.

## Ausgabe

- untersuchte Bereiche,
- belegte Findings,
- Ursache bzw. verbleibende Hypothesen,
- betroffene Dateien/Schichten,
- Risiken,
- vorgeschlagener Implementierungs-Scope,
- vorgeschlagene Tests,
- Kontextstufe/Vollscan ja-nein mit Begründung.