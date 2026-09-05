---
name: n8n-delegation
description: Bereitet eine sichere n8n-Delegation vor oder validiert ein n8n-Ergebnis gegen Ticket, Routing- und Qualitätsregeln. Verwenden bei wiederkehrenden deterministischen Integrationsaufgaben oder KI-Routing über die KAN-110-Schicht.
---

# n8n Delegation

## Eingaben

- Jira-/Aufgaben-Scope
- delegierbarer Teilprozess oder vorliegendes n8n-Ergebnis

## Mindestkontext

- `AGENTS.md`
- `docs/agent-context/ai-n8n.md`
- `docs/MODEL_ROUTING.md`
- relevante KAN-110-/KAN-127-Verträge und nur die betroffenen Integrationsquellen

## Ablauf

1. Prüfen, ob der Teilprozess deterministisch/wiederholbar und für Delegation vorgesehen ist.
2. Ein- und Ausgabe als minimale strukturierte Daten definieren; keine unnötigen Kontextblöcke übertragen.
3. Secrets, Tokens und produktive Nutzerdaten aus Payloads und Logs ausschließen.
4. Im automatisierten Modus Route/Provider/Modell ausschließlich aus dem tatsächlichen n8n-Ergebnis übernehmen; nichts erfinden.
5. Im manuellen Übergangsmodus nur `requiredCapability` bestimmen und Provider-Mapping dem zentralen Router überlassen.
6. Ergebnis gegen Ticket-Scope, Akzeptanzkriterien, Security, Datenintegrität und erwarteten Output validieren.
7. Bei ungültigem/unsicherem Ergebnis gezielt `RETRY`, Capability-Eskalation oder menschliche Freigabe wählen.

## Erlaubte Aktionen und Grenzen

- Nur bereits definierte/whitelistete n8n-Operationen verwenden.
- Keine n8n-Verfügbarkeit oder erfolgreiche Ausführung vortäuschen.
- Keine autonome Änderung von Routing-Policies, Provider-Mappings oder produktiven Credentials.
- n8n darf DoD-, Test- oder Publishing-Gates nicht umgehen.

## Eskalation / Stop

Stoppen bei unbekanntem Vertrag, fehlender Authentisierung, riskanten Writes, ungeklärtem Datenzugriff oder wenn eine menschliche Freigabe verlangt wird.

## Ausgabe

Für Delegation:
- Operation,
- minimale Inputs,
- erwartete Outputs,
- Sicherheitsgrenzen,
- `requiredCapability` bzw. automatischer Routing-Modus.

Für Validierung:
- tatsächliche Route/Provider/Modell nur soweit vorhanden,
- Validierungsergebnis,
- Abweichungen,
- `PASS|RETRY|ASK_USER|ABORT`.