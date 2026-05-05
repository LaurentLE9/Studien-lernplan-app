# Studien-lernplan-app

React/Vite App für Aufgabenplanung, Lernzeiterfassung, Timer (Stoppuhr/Pomodoro) und Statistikansichten.

## Start

1. Abhängigkeiten installieren:

	npm install

2. Entwicklungsserver starten:

	npm run dev

3. Build erzeugen:

	npm run build

4. Build lokal testen:

	npm run preview

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
