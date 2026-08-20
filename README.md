# Studien-lernplan-app

React/Vite App für Aufgabenplanung, Lernzeiterfassung, Timer (Stoppuhr/Pomodoro) und Statistikansichten.

## Entwicklungsprozess, Definition of Done und Loop Engineering

Die Entwicklungsregeln dieses Repositories sind miteinander verknüpft:

```text
Jira → Confluence/Definition of Done → AGENTS.md → Loop Engineering
     → GitHub/Codex/Copilot → Tests/Review/PR/Merge → Jira Erledigt
```

Verbindliche Repository-Dokumente:

- [`AGENTS.md`](AGENTS.md) – Arbeits-, Sicherheits-, Test-, Branch- und Abschlussregeln für Entwicklungs-Agenten
- [`docs/LOOP_ENGINEERING.md`](docs/LOOP_ENGINEERING.md) – kontrollierter Entwicklungs-Loop, Evaluator, Retry-/Stop-Regeln sowie Zielarchitektur für die spätere KI-Integration
- [`docs/CONTEXT_EFFICIENCY.md`](docs/CONTEXT_EFFICIENCY.md) – kompakte Repository-Kontextkarte, Analyse-Routing und Regeln zur Wiederverwendung gültiger Prüfnachweise
- [`docs/TYPESCRIPT_STRATEGY.md`](docs/TYPESCRIPT_STRATEGY.md) – verbindliche Reihenfolge, Grenzen und Qualitäts-Gates für die schrittweise TypeScript-Migration
- [`.github/copilot-instructions.md`](.github/copilot-instructions.md) – GitHub-Copilot-spezifische Anweisungen

Projektsteuerung und dauerhafte Prozessregeln:

- Jira KAN-30 – Entwicklungs- und Jira-Workflow dokumentieren
- Jira KAN-72 – Isolierten Testnutzer und Browser-End-to-End-Tests einführen
- Jira KAN-73 – Kontrollierten Entwicklungs-Loop für Codex einführen
- Jira KAN-74 – `AGENTS.md` erstellen und mit Definition of Done verknüpfen
- Confluence – **Arbeitsprozess und Definition of Done**: https://studien-lernplan-app.atlassian.net/wiki/spaces/PROJEKTHUB/pages/622593/Arbeitsprozess+und+Definition+of+Done

Wichtig: Ein technisch erfolgreicher Agenten-Loop bedeutet nicht automatisch, dass ein Jira-Vorgang erledigt ist. `Erledigt` setzt weiterhin die vollständige Definition of Done einschließlich Review, erforderlicher Tests, Pull Request und bestätigtem Merge nach `main` voraus.

## Start

1. Abhängigkeiten installieren:

	npm install

2. Entwicklungsserver starten:

	npm run dev

3. Build erzeugen:

	npm run build

4. Build lokal testen:

	npm run preview

## Tests

- Einmalige Testausführung: `npm test`
- Watch-Modus: `npm run test:watch`
- Testausführung mit Coverage: `npm run test:coverage`
- TypeScript-Baseline prüfen: `npx tsc --noEmit`

## TypeScript

Das Repository verwendet TypeScript derzeit als `noEmit`-Prüfwerkzeug neben
der bestehenden JavaScript-/JSX-Codebasis. Die Migration erfolgt bewusst
inkrementell; eine Komplettumstellung ist nicht vorgesehen. Reihenfolge,
Interop-Regeln und Qualitäts-Gates stehen in
[`docs/TYPESCRIPT_STRATEGY.md`](docs/TYPESCRIPT_STRATEGY.md).

## Supabase Setup für Cloud-Sync & Authentifizierung

### 1. Supabase Projekt erstellen

1. Besuche [supabase.com](https://supabase.com) und erstelle ein kostenloses Konto
2. Erstelle ein neues Projekt
3. Notiere dir die **Project URL** und **Anon Key** (Settings → API)

### 2. Umgebungsvariablen konfigurieren

1. Kopiere `.env.example` zu `.env.local`:
	```bash
	cp .env.example .env.local
	```

2. Füge deine Supabase-Anmeldedaten ein:
	```
	VITE_SUPABASE_URL=https://your-project.supabase.co
	VITE_SUPABASE_ANON_KEY=eyJhbGc...your-anon-key...
	VITE_PUBLIC_APP_URL=https://studien-lernplan-app.vercel.app
	```

3. Für Vercel: Setze dieselben Werte in **Project Settings → Environment Variables**
	- `VITE_SUPABASE_URL`
	- `VITE_SUPABASE_ANON_KEY`
	- `VITE_PUBLIC_APP_URL` (deine feste Produktions-URL)
	Danach ein neues Deployment starten (Redeploy).

### 3. Datenbank-Schema einrichten

1. Öffne Supabase Console → SQL Editor
2. Führe entweder `supabase/schema.sql` oder die Migration `supabase/migrations/20260408_0001_create_user_plans.sql` aus
3. Für die Fach- und Semesterverwaltung zusätzlich `supabase/migrations/20260408_0002_subject_groups_and_subjects.sql` und danach `supabase/migrations/20260408_0003_semesters_configuration.sql` ausführen
4. Für den zweigleisigen Lernplan (Themen-Reviews + neue Themen) zusätzlich `supabase/migrations/20260417_0005_learning_plan_topics.sql` ausführen
5. Stelle sicher, dass danach der PostgREST Schema-Cache neu geladen wird
6. Falls du die Fehlermeldung `Could not find the table 'public.user_plans' in the schema cache` siehst, ist die Tabelle noch nicht angelegt oder der Cache wurde nicht refreshed
7. Anpassung: Stelle sicher, dass RLS (Row Level Security) aktiviert ist

### 4. Authentifizierung testen

1. Starte den Dev-Server: `npm run dev`
2. Erstelle ein Testkonto
3. Deine Daten werden automatisch in der Cloud synchronisiert

## Funktionen mit Cloud-Sync

- ✅ Benutzerregistration und Login
- ✅ Automatische Cloud-Synchronisierung (kurzer Debounce + Sofort-Sync bei Logout/Tab-Wechsel)
- ✅ Multi-Device Support: Daten werden überall aktualisiert
- ✅ Session Persistence: Login bleibt erhalten
- ✅ Row-Level Security: Jeden Nutzer sieht nur eigene Daten
- ✅ User-Scoped Fallback-Cache: Bei kurzzeitigem Cloud-Ausfall wird die letzte lokale Kopie des eingeloggten Users geladen

## Wichtige Persistenz-Hinweise (Vercel)

- Daten liegen persistent in Supabase (Tabelle `user_plans`) und nicht im Deployment-Artefakt.
- Jeder Datensatz ist über `user_id` an den eingeloggten User gebunden.
- Neue Deployments auf Vercel löschen keine Nutzerdaten, solange die ENV-Werte korrekt gesetzt sind.

## Debugging / Diagnose

- Setze optional `VITE_DEBUG_SYNC=true` (Standard aktiv), um Sync-Logs in der Browser-Konsole zu sehen.
- Relevante Log-Präfixe:
	- `[cloud-sync]` für Requests/Antworten gegen Supabase
	- `[app-sync]` für Login-Laden/Speichern im Frontend
