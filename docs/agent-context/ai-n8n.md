# Router: AI / n8n

Nutzen bei KAN-110, n8n, Modellrouting, Agenten, Provider-Adaptern, Delegation und Codex↔n8n-Bridge.

## Primär laden

- aktiven Jira-Vorgang aus der KAN-110-Familie
- `docs/MODEL_ROUTING.md`
- relevante Bridge-/n8n-Dateien oder Task-State
- nur die konkret betroffenen Workflow-/Provider-/Adapter-Nachweise

## Routing

Deterministische Aufgaben ohne LLM lösen, wenn möglich. Einfache KI-Aufgaben an den kleinsten geeigneten Pfad geben. Komplexe, unsichere oder risikoreiche Schritte gemäß `docs/MODEL_ROUTING.md` eskalieren.

## Grenzen

Keine Provider-Secrets in Repository, Task-State, Logs oder Prompts. n8n darf keine unkontrollierten Repository-, Merge- oder Deploy-Aktionen auslösen.
