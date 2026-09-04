# Router: Backend / Supabase

Nutzen bei Persistenz, Supabase-Repositories, Auth, RLS, Datenbank, Migrationen und serverseitigen Integrationen.

## Primär laden

- betroffene Datei unter `src/infrastructure/supabase/`, `src/lib/` oder `supabase/migrations/`
- direkte Domain-/Feature-Aufrufer
- zugehörige Repository-/Migrations-/Regressionstests

## Sicherheitsgrenze

Bei Authentifizierung, Session, RLS, Berechtigungen, Secrets, Migrationen mit Datenrisiko oder destruktiven Änderungen gelten die Stop- und Freigaberegeln aus `AGENTS.md`. Kein breiter Datenbankkontext wird vorsorglich geladen.

## Bei Bedarf

`supabase/schema.sql` nur bei schemaweitem Scope oder wenn eine konkrete Migration/Abhängigkeit dies erfordert.
