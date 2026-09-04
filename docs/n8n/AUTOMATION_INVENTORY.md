# KAN-130 – n8n Automatisierungsinventur und Baseline

Stand: 2026-09-03

## Ziel

Wiederkehrende Entwicklungsarbeit so klassifizieren, dass deterministische Schritte künftig ohne unnötige KI-Aufrufe ausgeführt werden. Semantische, risikoreiche oder unklare Entscheidungen bleiben bei Codex/ChatGPT bzw. benötigen menschliche Freigabe.

## Klassifizierung

Workflow | Klasse | Zielsystem | KI nötig? | Freigabe | PoC-Eignung
--- | --- | --- | --- | --- | ---
Pflichtchecks nach Codeänderung ausführen | deterministisch | GitHub/Repository | nein | nein | sehr hoch
Testergebnis + Commit-SHA an Jira kommentieren | deterministisch | Jira | nein | nein, nur definierter Vorgang | sehr hoch
GitHub-Commit/PR mit Jira-Key verknüpfen | deterministisch | GitHub/Jira | nein | nein | hoch
Status nach erfolgreichem Gate auf Test/Review setzen | regelbasiert | Jira | nein | nur bei vollständigen Gates | hoch
Confluence-Abschlussnachweis aus strukturierten Daten aktualisieren | regelbasiert | Confluence | normalerweise nein | bei Überschreiben bestehender Inhalte | mittel
Supabase-Daten lesen, um Testdaten zu validieren | deterministisch | Supabase | nein | nein, read-only Testdaten | mittel
Supabase-RLS/Auth/Berechtigungen ändern | risikoreich | Supabase | nein | zwingend menschlich | ungeeignet
Architekturentscheidung treffen | intelligent | Repository/Confluence | ja | Review | ungeeignet
unbekannten Fehler diagnostizieren | intelligent | Repository | ja | Review | ungeeignet
Secrets/Tokens erzeugen oder Rechte erweitern | risikoreich | Integrationen | nein | zwingend menschlich | ungeeignet

## Umgesetzter erster PoC

**Deterministischer GitHub-CI-zu-Jira-Nachweis.**

Trigger: signiertes GitHub-`workflow_run`-Webhook-Ereignis. Der aktuelle PoC
verwendet zuerst einen Jira-Key aus dem Branch-Namen und prüft anschließend die
Commit-Nachricht, wenn der Branch keinen Schlüssel enthält.

Ablauf:
1. Eingaben syntaktisch validieren.
2. ausschließlich abgeschlossene Workflow-Läufe weiterleiten.
3. Jira-Key deterministisch nach der oben beschriebenen Priorität extrahieren.
4. bei gültigem Schlüssel einen strukturierten Jira-Kommentar hinterlegen.
5. bei fehlendem Schlüssel oder ungültiger Signatur ohne Jira-Schreibzugriff enden.
6. Laufmetrik mit `ai_calls=0` ohne Inhalts-/Secretdaten erfassen.

Der Live-Nachweis wurde mit einer erfolgreichen n8n-Ausführung und einem
automatisch erzeugten Jira-Kommentar erbracht. Die technische Umsetzung liegt
unter `ops/n8n/`; Details stehen in `docs/N8N_OCI_FREE_TIER.md`.

Nicht Bestandteil des deterministischen Pfads: Codeanalyse, Fehlerdiagnose, Architekturentscheidungen, Auth-/RLS-Änderungen.

## Baseline-Metriken

Pro Workflowklasse werden erfasst:
- `runs_total`
- `runs_success`
- `runs_failed`
- `manual_interventions`
- `ai_calls_before`
- `ai_calls_after`
- `duration_ms`

Berechnung:

`avoided_ai_calls = max(ai_calls_before - ai_calls_after, 0)`

`automation_success_rate = runs_success / runs_total`

`manual_intervention_rate = manual_interventions / runs_total`

Für den ersten PoC gilt als Ziel: `ai_calls_after = 0` im deterministischen Pfad.

## Grenzen

- Keine produktiven Secrets in Workflow-JSON, Repository, Jira oder Confluence.
- Keine Auth-, Session-, RLS- oder Berechtigungsänderungen ohne menschliche Freigabe.
- Keine automatische Freigabe/Merge-Aktion, solange Qualitätsgates oder Zielzustand unklar sind.
- Der Verifier reserviert die GitHub-Delivery-ID atomar in einem persistenten
  Volume. Parallele Duplikate und Redeliveries nach einem Neustart werden nicht
  erneut an n8n weitergeleitet. Schlägt n8n beziehungsweise der abschließende
  Jira-Schritt fehl, wird die Reservierung für GitHubs Wiederholung freigegeben.
