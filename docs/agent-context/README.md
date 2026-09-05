# Agent Context Router

**Jira:** KAN-157, KAN-158, KAN-161

Diese Datei ist der zentrale Context Router für Entwicklungs-Agenten. `AGENTS.md` ist das Agent Operating System bzw. der Kernel; dieser Router ergänzt den Kernel um Progressive Context Loading, ersetzt aber weder Jira noch Definition of Done, Sicherheitsregeln oder Testpflichten.

## Startregel

Vor einer Aufgabe nur laden:

1. aktiven Jira-Vorgang,
2. `AGENTS.md`,
3. diese Router-Datei,
4. anhand von Name/Beschreibung nur die zum Workflow passenden Skills aus `.agents/skills/` auswählen,
5. danach ausschließlich die für den ermittelten Scope notwendigen Skill-Bodies, Domänen-Router und Quellen.

Ein vollständiger Repository-, Jira- oder Confluence-Scan ist nur zulässig, wenn der Ticket-Scope ihn ausdrücklich erfordert. Fehlender notwendiger Kontext wird gezielt nachgeladen.

Wenn mehr Modellleistung nötig ist, bestimmt `docs/MODEL_ROUTING.md` im manuellen Übergangsmodus zuerst `requiredCapability=low|medium|high` unabhängig von Provider oder aktivem Modell. Erst danach wird über `config/manual-model-routing.json` auf OpenAI/Codex, Anthropic/Claude oder weitere Provider abgebildet. Das automatische n8n-Routing bleibt davon getrennt und wählt Route, Provider und Modell selbst. Beide Modi dürfen nicht vermischt werden. `ASK_USER` bleibt echten menschlichen Entscheidungen/Freigaben vorbehalten.

## Skill Routing

Die kanonische Skill-Konvention steht in `.agents/skills/README.md`.

Typische Workflow-Auswahl:

- Aufgabe starten/fortsetzen → `task-bootstrap`
- Code-/Architekturscope erst verstehen → `repository-analysis`
- bestätigten Scope umsetzen → `ticket-implementation`
- Änderung prüfen/evaluieren → `change-verification`
- Review-Readiness/Handover/Post-Merge → `handover-completion`
- n8n delegieren/Ergebnis prüfen → `n8n-delegation`

Skills sind progressive Workflow-Bausteine. Sie dürfen den Kernel, Sicherheits-/Test-Gates oder die Definition of Done nicht überschreiben. Nicht alle Skills zu Beginn laden; nur passende Bodies lesen. Für Code Review keinen zweiten allgemeinen Skill erzeugen: KAN-83 bleibt die projektspezifische Review-Skill-Quelle.

## Routing

| Signal im Ticket / Diff | Router | Typische Quellen |
| --- | --- | --- |
| Architektur, Modulgrenzen, App-Shell, Refactoring | `architecture.md` | Architektur-Doku, direkte Abhängigkeiten, relevante ADR-/Jira-Nachweise |
| React, UI, Dashboard, Seiten, Komponenten, Styling | `frontend.md` | betroffene Feature-/UI-Dateien, relevante App-Aufrufer, UI-Tests |
| Supabase, Persistenz, Repository-Adapter, Auth, RLS, Datenbank | `backend-supabase.md` | betroffene Infrastructure-/Migration-Dateien; Stop-Regeln beachten |
| Tests, Regression, Browser/E2E, CI | `testing.md` | betroffene Tests, Policies, Workflow-Dateien |
| Jira, GitHub, Confluence, DoD, Branch/PR, Handover | `process-jira.md` | Ticket, Task-State, Prozessdokumente |
| n8n, KI-Router, Modelle, Agenten, Provider, Claude, Codex | `ai-n8n.md` | `docs/MODEL_ROUTING.md`, `config/manual-model-routing.json`, KAN-110-Familie, Modell-/Bridge-Doku |

Mehrere Router oder Skills dürfen kombiniert werden, aber nur wenn direkte Abhängigkeiten dies erfordern.

## Progressive Context Loading

### Stufe 0 – Scope

Nur Ticket, `AGENTS.md`, Router, Skill-Metadaten, Branch/HEAD/Diff-Metadaten.

### Stufe 1 – Primärkontext

Nur ausgewählte Skill-Bodies, betroffene Dateien, direkte Aufrufer/Imports und kleinster passender Test.

### Stufe 2 – Abhängigkeiten

Nur bei belegter Notwendigkeit angrenzende Module, Architektur- oder Prozessquellen nachladen.

### Stufe 3 – Breiter Scan

Nur wenn Scope, Fehlerbild oder Architekturänderung einen breiteren Überblick verlangt. Grund im Abschlussnachweis dokumentieren.

## Task-State für Fortsetzungen

Für längere Tickets soll `docs/ai-handoffs/<JIRA-ID>-status.md` oder ein gleichwertiger versionierter Task-State mindestens enthalten:

- Jira-Key und Status,
- Branch und letzter relevanter Commit,
- abgeschlossene Schritte,
- aktuell gültige Prüfnachweise,
- offene Risiken/Blocker,
- nächste konkrete Schritte,
- geladene Router/Domänen und verwendete Skills,
- verwendeter Routing-Modus,
- im manuellen Modus `requiredCapability` sowie `activeProvider`, `activeModel` und `activeCapability` nur soweit zuverlässig bekannt,
- im automatisierten n8n-Modus nur die tatsächlich gewählte Route-/Provider-/Modellmetadaten, soweit vorhanden.

Keine Secrets, Tokens, Passwörter oder produktiven Nutzerdaten speichern.

## Kontext-Nachweis

Im Abschlussbericht kurz festhalten:

- verwendete Skills und Router,
- geladene Primärquellen,
- zusätzlich nachgeladene Quellen und Grund,
- ob ein Vollscan stattfand und warum,
- welche vorhandenen Nachweise wiederverwendet wurden,
- welcher Modell-Routing-Modus aktiv war,
- bei manuellem Routing die benötigte Capability und das angewendete Provider-Mapping.

Der reproduzierbare Vorher-/Nachher-Vergleich für KAN-157 ist in `docs/CONTEXT_EFFICIENCY.md` dokumentiert.