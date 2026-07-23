# Studien-lernplan-app

React/Vite App fuer Aufgabenplanung, Lernzeiterfassung, Timer (Stoppuhr/Pomodoro) und Statistikansichten.

## Lokaler Start

1. Abhaengigkeiten installieren:

   npm install

2. Entwicklungsserver starten:

   npm run dev

3. Build erzeugen:

   npm run build

4. Build lokal testen:

   npm run preview

## Cloud-Setup (Datenbank + Authentifizierung)

Die App nutzt Supabase fuer:

- Konto anlegen / Login
- verpflichtende Authentifizierung
- Speichern aller Planner-Daten in der Cloud

### 1) Supabase Projekt vorbereiten

1. Neues Supabase-Projekt erstellen.
2. Im SQL Editor den Inhalt aus `supabase/schema.sql` ausfuehren.
3. Unter `Authentication > Providers` den E-Mail-Provider aktivieren.

### 2) Lokale Umgebungsvariablen setzen

1. Datei `.env.example` nach `.env` kopieren.
2. Werte aus dem Supabase-Projekt eintragen:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

Dann lokal neu starten:

```bash
npm run dev
```

### 3) Verhalten in der App

- Ohne Login ist kein Zugriff auf den Planner moeglich.
- Jeder Nutzer sieht nur seine eigenen Daten (RLS Policy in Supabase).
- Aenderungen werden automatisch in die Cloud-Datenbank synchronisiert.

## Vorbereitung fuer Online-Nutzung (Hosting)

Das Projekt ist zusaetzlich fuer statisches Hosting vorbereitet (Vercel + Netlify).

### Enthaltene Deploy-Konfigurationen

- `vercel.json` fuer Vercel Build- und SPA-Routing.
- `netlify.toml` fuer Netlify Build- und SPA-Routing.

### Deployment (empfohlen: Vercel)

1. Repository zu GitHub pushen.
2. Auf Vercel ein neues Projekt mit diesem Repository verbinden.
3. Vercel erkennt Vite automatisch:
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Deploy starten.

Danach ist die App unter einer oeffentlichen URL verfuegbar und von ueberall erreichbar.

## Naechster Schritt (Cloud-Daten + Login)

Wenn du willst, kann ich als naechstes zusaetzlich ein Passwort-Reset, E-Mail-Verifizierung-Flow und Team-/Freigabe-Funktionen einbauen.
