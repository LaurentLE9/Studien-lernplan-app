# Studien-lernplan-app

React/Vite App fuer Aufgabenplanung, Lernzeiterfassung, Timer (Stoppuhr/Pomodoro) und Statistikansichten.

## Start

1. Abhaengigkeiten installieren:

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
	```

### 3. Datenbank-Schema einrichten

1. Öffne Supabase Console → SQL Editor
2. Kopiere den Inhalt von `supabase/schema.sql`
3. Führe die SQL aus
4. Anpassung: Stelle sicher, dass RLS (Row Level Security) aktiviert ist

### 4. Authentifizierung testen

1. Starte den Dev-Server: `npm run dev`
2. Erstelle ein Testkonto
3. Deine Daten werden automatisch in der Cloud synchronisiert

## Funktionen mit Cloud-Sync

- ✅ Benutzerregistration und Login
- ✅ Automatische Cloud-Synchronisierung (Debounce 2 Sekunden)
- ✅ Multi-Device Support: Daten werden überall aktualisiert
- ✅ Session Persistence: Login bleibt erhalten
- ✅ Row-Level Security: Jeden Nutzer sieht nur eigene Daten
