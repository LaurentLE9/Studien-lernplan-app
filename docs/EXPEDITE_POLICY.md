# Expedite- und P0-Notfallprozess

Diese Richtlinie definiert den Umgang mit kritischen Blockern in der Studien-Lernplan-App.

## Grundsatz

Für Notfälle wird kein künstlicher eigener Sprint angelegt. Kritische Vorgänge laufen über eine Expedite-/P0-Lane und dürfen die normale Sprintarbeit unterbrechen.

## Wann Expedite/P0 gilt

Mindestens eines muss zutreffen:

- produktive Kernfunktion ist blockiert oder wesentlich fehlerhaft,
- Datenintegrität, Security oder Authentifizierung ist akut gefährdet,
- CI-, Test- oder Deployment-Infrastruktur blockiert die sichere Weiterentwicklung,
- ein Fehler verhindert die Arbeit an bereits priorisierten Sprint-Aufgaben,
- eine ausdrücklich als sofortiger Blocker festgelegte Aufgabe muss vor jeder weiteren Sprintarbeit abgeschlossen werden.

Normale Features, Komfortverbesserungen und gewöhnliche Bugs bleiben im regulären Backlog.

## Jira-Kennzeichnung

Expedite-Vorgänge erhalten:

- Priorität `Highest`,
- Label `expedite`,
- Label `p0`,
- bei blockierter Sprint-Fortsetzung zusätzlich `sprint-blocker`.

## WIP-Limit

Für Expedite gilt ein hartes WIP-Limit von 1.

Sobald ein Expedite-Vorgang aktiv ist:

1. normale Sprintarbeit pausieren,
2. keine zweite Expedite-Aufgabe parallel beginnen,
3. den Expedite-Vorgang vollständig durch Implementierung, Tests, Review, PR, Merge und Dokumentationsabgleich führen,
4. erst nach vollständiger Definition of Done die reguläre Sprintarbeit fortsetzen.

## Ablauf

```text
kritischer Befund
  -> P0/Expedite prüfen
  -> Highest + expedite + p0
  -> falls nötig sprint-blocker
  -> normale Sprintarbeit pausieren
  -> In Arbeit
  -> Implementierung
  -> Pflichtprüfungen / Browser-E2E / Security
  -> Code-Review
  -> Test
  -> PR + Merge nach main
  -> Deployment-/Endnachweis
  -> Jira-/Confluence-Abgleich
  -> Erledigt
  -> reguläre Sprintarbeit fortsetzen
```

## Keine verkürzte Definition of Done

P0 bedeutet höhere Reihenfolge, nicht geringere Qualität.

Ein Expedite-Vorgang darf nicht vorzeitig geschlossen oder direkt nach `main` gedrückt werden. Fehlende Pflichtprüfungen bleiben Blocker. Ein fehlgeschlagener oder nicht ausführbarer Browser-/E2E-Test darf nicht als PASS behandelt werden.

## Test-Account

Ist ein freigegebener Browser-/E2E-Test notwendig, wird der isolierte Test-Account gemäß `docs/BROWSER_E2E_POLICY.md` ohne zusätzliche Benutzer-Rückfrage verwendet. Secrets bleiben ausschließlich in sicheren Secret-/Environment-Konfigurationen.

## Aktueller Anwendungsfall

KAN-109 ist der erste Vorgang, auf den diese Regel angewendet wird. Er trägt Highest sowie `expedite`, `p0` und `sprint-blocker`. Die normale Sprint-Fortsetzung bleibt blockiert, bis KAN-109 die vollständige Definition of Done erfüllt.
