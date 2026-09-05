---
name: ticket-implementation
description: Implementiert eine bestätigte Änderung innerhalb eines Jira-Ticket-Scopes. Verwenden, wenn Scope, betroffene Dateien und erforderliche Capability bereits bestimmt sind und die eigentliche Code- oder Dokumentänderung ausgeführt werden soll.
---

# Ticket Implementation

## Eingaben

- aktiver Jira-Key mit Akzeptanzkriterien
- bestätigter Implementierungs-Scope
- `requiredCapability`

## Mindestkontext

- `AGENTS.md`
- passender Domänen-Router
- relevante Dateien und direkte Abhängigkeiten
- vorhandene Regressionstests
- bei nicht-trivialer Arbeit `docs/LOOP_ENGINEERING.md`

## Vorbedingungen

1. nicht auf `main`,
2. passendes GitHub Issue vorhanden, sofern keine dokumentierte Ausnahme gilt,
3. `npm run integrity:start` für nicht-triviale Änderungen erfolgreich,
4. aktive Capability ist ausreichend, soweit zuverlässig bekannt; andernfalls Model-Routing-Regeln anwenden.

## Ablauf

1. Kleinste Änderung umsetzen, die die Akzeptanzkriterien erfüllt.
2. Bei Bugs nach Möglichkeit zuerst eine reproduzierbare Regression schaffen.
3. Bestehende Modul-/Adaptergrenzen respektieren.
4. Keine Paket-Upgrades, Zusatzfeatures oder Nebenbaustellen ohne eigenen Jira-Scope.
5. Nach jedem zusammenhängenden Implementierungsblock Diff auf Scope-Drift und unbeabsichtigte Änderungen prüfen.
6. Anschließend `change-verification` verwenden.

## Erlaubte Aktionen und Grenzen

- Dateien nur innerhalb des bestätigten Ticket-Scopes ändern.
- Keine Secrets oder produktiven Zugangsdaten erzeugen, kopieren oder protokollieren.
- Sicherheits-/RLS-/Migration-Stop-Bedingungen aus `AGENTS.md` haben Vorrang.
- Keine Tests oder Gates abschwächen, damit ein Build grün wird.

## Eskalation / Stop

Stoppen bei wesentlich erweitertem Scope, untrennbaren fremden Änderungen, fehlender Sicherheitsfreigabe oder wenn eine höhere Capability vor dem nächsten Write erforderlich ist.

## Ausgabe

- geänderte Dateien,
- kurze Begründung je Änderung,
- Akzeptanzkriterien-Abdeckung,
- bekannte Risiken/Restpunkte,
- empfohlene gezielte und vollständige Prüfungen,
- nächster Schritt: `change-verification`.