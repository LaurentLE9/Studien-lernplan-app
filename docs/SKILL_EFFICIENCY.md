# KAN-158 – Skill-/Kontext-Effizienztest

## Zweck

Nachweis, dass wiederkehrende Verfahren nicht mehr bei jeder Aufgabe aus langen Kernel-/Policy-Blöcken rekonstruiert werden müssen, sondern über progressive Skill-Discovery geladen werden.

## Testszenario

Typischer Auftrag: **„Mit KAN-XX weitermachen, aktuellen Stand prüfen und die nächste Änderung vorbereiten.“**

### Vor KAN-158

Der Agent musste aus folgenden immer bzw. häufig geladenen Quellen selbst rekonstruieren, welcher Start-/Fortsetzungsablauf gilt:

- vollständige `AGENTS.md`,
- `docs/agent-context/README.md`,
- `docs/agent-context/process-jira.md`,
- bei nicht-trivialer Arbeit zusätzlich `docs/LOOP_ENGINEERING.md`,
- bei Modellbedarf zusätzlich `docs/MODEL_ROUTING.md`.

Die konkrete Reihenfolge für Jira-Status, GitHub Issue, Branch, Handover, Scope-Rekonstruktion und nächsten Arbeitsblock war über mehrere Quellen verteilt.

### Nach KAN-158

Stufe 0 lädt nur:

- Jira,
- schlanke `AGENTS.md`,
- Context Router,
- Skill-Discovery-Metadaten (`name` + `description`),
- Branch-/HEAD-/Diff-Metadaten.

Für dieses Szenario wird anschließend nur `task-bootstrap/SKILL.md` geladen. Dieser Skill verweist gezielt auf `process-jira.md`; weitere Skills oder Policies werden erst geladen, wenn der nächste konkrete Schritt sie benötigt.

## Vergleich

| Aspekt | Vorher | Nachher |
| --- | --- | --- |
| Wiederkehrender Startablauf | über Kernel + Router + Prozessquellen rekonstruieren | ein ausgewählter `task-bootstrap`-Workflow |
| Alle Workflow-Anweisungen beim Start laden | häufig mehrere Detailquellen | nur Skill-Metadaten + ein passender Skill-Body |
| Provider-spezifische Skill-Logik | Gefahr von Duplikaten | keine; Capability bleibt `low|medium|high` |
| Claude/Codex | getrennte Anweisungslogik möglich | gleiche kanonische `.agents/skills`-Quelle; Claude nur mit dünnem Adapter |
| Breiter Kontext | Agent musste selbst begrenzen | Skill + Router verlangen explizit Progressive Loading |

## Ergebnis

**PASS für den Struktur-/Kontexttest:** Der wiederkehrende Start-/Fortsetzungsablauf ist jetzt einmalig als kleiner Skill definiert und wird nur bei passender Aufgabe vollständig geladen. Andere Workflow-Skills (`repository-analysis`, `ticket-implementation`, `change-verification`, `handover-completion`, `n8n-delegation`) bleiben bis zu ihrem tatsächlichen Trigger außerhalb des Arbeitskontexts.

Dadurch sinkt die wiederholte prozedurale Kontextlast insbesondere bei kleinen Fortsetzungen und Read-only-Analysen. Die notwendigen permanenten Sicherheits-, Git- und DoD-Invarianten bleiben im Kernel.

## Technische Validierung in dieser Umsetzung

- GitHub bestätigt sechs kanonische Skill-Verzeichnisse unter `.agents/skills/`.
- Stichprobe `task-bootstrap`: gültiges YAML-Frontmatter mit `name` und `description`, danach klarer Workflow-Vertrag.
- Claude-Adapter besitzt dieselben Discovery-Metadaten und verweist auf die kanonische `.agents`-Datei statt Workflow-Logik zu duplizieren.
- Kein App-Code, Datenmodell oder Supabase-Scope wurde verändert.
- Lokale npm-/Integrity-Ausführung konnte in der ausführenden ChatGPT-Umgebung nicht gestartet werden, weil der Container beim Git-Clone keinen DNS-Zugriff auf `github.com` hatte. Das ist als Umgebungsblocker zu behandeln; Repository-Struktur wurde über die verbundene GitHub-Schnittstelle geprüft.
