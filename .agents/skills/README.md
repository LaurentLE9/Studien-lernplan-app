# Agent Skills – Konvention

**Jira:** KAN-158  
**GitHub Issue:** #73

Dieses Verzeichnis ist die kanonische, providerneutrale Skill-Quelle der Study App.

## Prinzipien

- Jeder Skill folgt dem offenen Agent-Skills-Format mit `SKILL.md` und YAML-Frontmatter.
- `name` und `description` dienen der Discovery; der Body wird nur bei passendem Scope geladen.
- Skills beschreiben wiederkehrende Verfahren, nicht dauerhafte Projektregeln.
- `AGENTS.md` bleibt Kernel und hat Vorrang vor jedem Skill.
- Große Policies, Architekturtexte und Referenzen werden nicht kopiert, sondern gezielt referenziert.
- Skills verwenden nur `requiredCapability=low|medium|high`; konkrete Provider-/Modellnamen gehören in `docs/MODEL_ROUTING.md` und `config/manual-model-routing.json`.
- Keine Secrets, Tokens, Passwörter oder produktiven Zugangsdaten in Skills oder Referenzen.
- Ein Skill darf Sicherheits-, Test-, Review-, Publishing- oder Definition-of-Done-Gates nicht abschwächen.

## Skills

| Skill | Verwenden für |
| --- | --- |
| `task-bootstrap` | Jira-Aufgabe starten oder fortsetzen, Arbeitsstand rekonstruieren |
| `repository-analysis` | gezielte Read-only-Code-/Architekturanalyse |
| `ticket-implementation` | Implementierung innerhalb eines bestätigten Ticket-Scopes |
| `change-verification` | Testauswahl, Pflichtprüfungen und Evaluation |
| `handover-completion` | Review-Readiness, Handover und Post-Merge-Abschluss |
| `n8n-delegation` | n8n-Delegation vorbereiten oder Ergebnisse validieren |

## Code Review

Keinen zweiten allgemeinen Code-Review-Skill anlegen. **KAN-83** bleibt die einzige Quelle für den projektspezifischen Copilot-Code-Review-Skill unter `.github/skills/code-review/SKILL.md`.

## Provider-Kompatibilität

Codex nutzt die kanonischen Skills direkt aus `.agents/skills/`.

Claude Code erwartet projektspezifische Skills unter `.claude/skills/`. Dort liegen deshalb nur kleine Adapter mit derselben Discovery-Metadatenbeschreibung; sie verweisen auf den jeweiligen kanonischen Skill in `.agents/skills/`. Die fachliche Workflow-Logik wird nicht dupliziert.

Andere Agenten dürfen dieselben kanonischen `SKILL.md`-Dateien verwenden, sofern sie den Agent-Skills-Standard unterstützen oder über einen dünnen Adapter darauf verweisen.

## Skill-Vertrag

Jeder Skill enthält mindestens:

1. benötigte Eingaben,
2. Mindestkontext,
3. Ablauf,
4. erlaubte Aktionen und Grenzen,
5. Eskalations-/Stop-Bedingungen,
6. erwartetes Ausgabeformat.

Neue Skills nur für tatsächlich wiederkehrende, klar abgrenzbare Abläufe anlegen. Ein einmaliger Prozess gehört in Ticket-/Handover-Dokumentation, eine dauerhafte Regel in `AGENTS.md` oder eine passende Policy.