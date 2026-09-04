# Router: Testing

Nutzen bei Unit-, Integration-, Regression-, Browser-/E2E- und CI-Themen.

## Primär laden

- den Test, der den betroffenen Ablauf direkt abdeckt
- die unmittelbar getestete Produktionsdatei
- nur die für den Test relevante Konfiguration

## Reihenfolge

1. kleinster aussagekräftiger Test/statischer Check,
2. nach Reparaturen nur invalidierte Nachweise erneuern,
3. vollständige Pflichtprüfungen einmal für den finalen Kandidaten gemäß `AGENTS.md`.

## Browser/E2E

`docs/BROWSER_E2E_POLICY.md` nur laden, wenn sichtbares/interaktives Verhalten oder ein entsprechender Ticket-Scope betroffen ist. E2E-Secrets niemals in Kontext- oder Handover-Dateien kopieren.
