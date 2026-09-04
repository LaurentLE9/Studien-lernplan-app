# Router: Architektur

Nutzen bei Änderungen an Modulgrenzen, App-Shell, übergreifendem Zustand, Refactorings oder neuen technischen Schnittstellen.

## Primär laden

- Jira-Scope und Akzeptanzkriterien
- `docs/agent-context/README.md`
- relevante Abschnitte aus `docs/LOOP_ENGINEERING.md`
- relevante Architektur-/Datenmodell-Dokumentation
- nur betroffene Module und direkte Abhängigkeiten

## Bei Bedarf nachladen

- `src/App.jsx` nur über relevante Symbole/Zeilenbereiche
- angrenzende Domain-/Feature-/Infrastructure-Module
- frühere Jira-/PR-Nachweise nur wenn Architekturhistorie für die Entscheidung nötig ist

## Eskalieren

Architekturänderungen, viele gekoppelte Dateien, Security-/Datenrisiken oder widersprüchliche Modulgrenzen gemäß `docs/MODEL_ROUTING.md` an die erforderliche Modellstufe eskalieren.
