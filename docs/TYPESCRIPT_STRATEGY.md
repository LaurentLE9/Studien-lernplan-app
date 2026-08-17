# TypeScript-Strategie

- **Status:** verbindliche Migrationsstrategie
- **Stand:** 17.08.2026
- **Jira:** KAN-15

## 1. Ziel und Nicht-Ziele

Die Studien-Lernplan-App wird schrittweise von JavaScript/JSX zu TypeScript/TSX
weiterentwickelt. Jeder Migrationsschritt muss klein, einzeln testbar und ohne
Änderung des Produktverhaltens bleiben.

KAN-15 legt nur die Strategie fest. Nicht Bestandteil sind:

- eine vollständige oder mechanische Umbenennung aller Dateien,
- fachliche Änderungen, Refactorings oder ein Redesign,
- Paket-Upgrades allein für TypeScript,
- ein globales `checkJs` für die bestehende JavaScript-Codebasis,
- die sofortige Migration von `App.jsx`, React-Komponenten oder Tests.

## 2. Aktueller Stand

| Bereich | Stand |
| --- | --- |
| Compiler | TypeScript `~6.0.2` ist als Entwicklungsabhängigkeit vorhanden. |
| Konfiguration | `tsconfig.json` nutzt Bundler-Modulauflösung, `noEmit`, `allowJs: true` und `checkJs: false`. |
| Quelldateien | `src` enthält JavaScript und JSX, aber noch keine `.ts`- oder `.tsx`-Dateien. |
| Typecheck | `npx tsc --noEmit` prüft heute Konfiguration und Modulauflösung; JavaScript-Funktionskörper werden wegen `checkJs: false` nicht flächendeckend typgeprüft. |
| Imports | Vite und TypeScript kennen den Alias `@` für `src`; vorhandene Imports sind überwiegend endungslos und damit migrationsfreundlich. |
| React-Typen | `@types/react` und `@types/react-dom` sind noch nicht als direkte Entwicklungsabhängigkeiten eingerichtet. |
| Tests | Vitest-Tests liegen in JavaScript/JSX und können migrierte TypeScript-Module weiterhin importieren. |

Der bestehende Typecheck ist ein gültiges Baseline-Gate, aber noch kein Nachweis
für eine typisierte Anwendung.

## 3. Leitprinzipien

1. **Grenzen vor Oberfläche:** Zuerst reine Domain- und Mapping-Module
   typisieren, React-Komponenten später.
2. **Ein Verantwortungsbereich pro Pull Request:** Keine breit gestreuten
   Umbenennungen oder Misch-Refactorings.
3. **Verhalten bleibt unverändert:** Eine Migration ändert keine Fachregeln,
   API-Payloads, Persistenz oder Benutzeroberfläche.
4. **Typen an Schichtgrenzen:** Datenbankzeilen, Domain-Objekte und UI-Props
   erhalten getrennte, eindeutige Typen.
5. **Unsichere Eingaben beginnen als `unknown`:** Externe Daten werden
   validiert beziehungsweise eingegrenzt, nicht vorschnell mit `any` bestätigt.
6. **Compiler statt Emission:** Vite baut die Anwendung; TypeScript bleibt mit
   `noEmit` ein Prüfwerkzeug.
7. **Jira steuert jeden Schritt:** Jede konkrete Dateimigration benötigt einen
   eigenen Jira-Scope, ein GitHub Issue, Tests und den vollständigen
   Review-/Merge-Prozess.

## 4. Verbindliche Migrationsreihenfolge

### Phase 0 – Baseline erhalten

Bis zur ersten konkreten Migration bleiben `allowJs: true` und
`checkJs: false` bestehen. `npx tsc --noEmit`, Tests, Coverage und Build bleiben
Pflichtprüfungen. KAN-15 verändert noch keine Compileroptionen.

### Phase 1 – Kleine, reine Blattmodule

Erste Kandidaten sind Module ohne React-, UI- oder Supabase-Abhängigkeit:

1. `src/domain/study/integer.js`
2. `src/domain/study/activity.js`
3. `src/domain/academics/topic.js`
4. `src/domain/deadlines/deadline.js`
5. `src/domain/tasks/task.js`
6. `src/domain/projects/project.js` nach den Task-Typen

`integer.js` ist der bevorzugte erste Pilot: klein, seiteneffektfrei und durch
Repository-Tests direkt abgedeckt. Die Reihenfolge darf nur mit dokumentierter
Begründung geändert werden.

Mit dem ersten `.ts`-Modul wird in demselben Ticket geprüft:

- `src/**/*.ts` und später `src/**/*.tsx` explizit in `tsconfig.json`
  aufzunehmen,
- `strict: true` für TypeScript-Code zu aktivieren,
- endungslose Imports beizubehalten,
- die vorhandenen JavaScript-Aufrufer unverändert weiterarbeiten zu lassen.

### Phase 2 – Fachliche Modelle und Mapper

Nach stabilen Domain-Typen folgen reine Zustands- und Mapping-Grenzen, zum
Beispiel:

- `src/app/state/plannerSnapshot.js`,
- `src/infrastructure/supabase/dateMapping.js`,
- `src/infrastructure/supabase/plannerSnapshotMapper.js`.

Für Supabase werden Datenbankzeilen im `snake_case`-Format und Domain-Objekte im
`camelCase`-Format getrennt typisiert. Mapper bleiben die einzige Stelle, an der
zwischen beiden Formen übersetzt wird.

### Phase 3 – Repositories und Infrastruktur

Repositories werden einzeln migriert, sobald ihre Domain- und Row-Typen stabil
sind. Öffentliche Rückgabewerte, Nullable-Felder, Fehlerpfade und User-Scope
müssen explizit sein. Authentifizierungs-, RLS- oder Datenbankänderungen sind
keine TypeScript-Migration und benötigen getrennten Scope und Freigabe.

### Phase 4 – Feature-Konfiguration und React-Komponenten

Vor dem ersten `.tsx`-Modul werden kompatible React-Typabhängigkeiten in einem
eigenen Umsetzungsticket geprüft. Danach werden kleine Blattkomponenten mit
stabilen Props migriert; zustandsreiche Dialoge, Timer- und Formularabläufe
folgen erst nach ausreichender Testabdeckung.

### Phase 5 – App-Shell und Tests

`src/App.jsx` wird zuletzt und nur in kleinen, fachlich getrennten Schritten
migriert. Tests dürfen parallel in JavaScript bleiben. Eine Umstellung von
Tests auf TypeScript erfolgt nur, wenn sie einen konkreten Typnutzen bringt und
nicht die Produktmigration verdeckt.

## 5. Regeln für gemischten JavaScript-/TypeScript-Betrieb

- `.js`/`.jsx` und `.ts`/`.tsx` dürfen während der Migration koexistieren.
- Quelldateien importieren interne Module weiterhin ohne Dateiendung.
- Reine Typimporte verwenden `import type`.
- Neue TypeScript-Module laufen unter `strict`; `any` ist nur an einer
  nachweislich unvermeidbaren Fremdgrenze und mit Begründung zulässig.
- `@ts-nocheck`, das Abschwächen von Compilerregeln und unkontrollierte
  Type-Assertions sind keine Migrationsstrategie.
- Wegen `erasableSyntaxOnly` werden löschbare Typkonstrukte, String-Unions und
  `as const` gegenüber Laufzeit-Enums, Namespaces oder Parameter-Properties
  bevorzugt.
- `checkJs` wird nicht global aktiviert. Eine spätere Aktivierung wird separat
  bewertet, nachdem wesentliche Grenzmodule migriert sind.
- `skipLibCheck` bleibt zunächst bestehen und wird erst in einem eigenen
  Qualitätsvorgang neu bewertet.
- Ein Dateiname wird nur geändert, wenn alle direkten Importe, Tests und der
  Produktions-Build im selben Ticket geprüft werden.

## 6. Typgrenzen

Typen liegen möglichst nahe bei ihrer fachlichen Verantwortung:

- Domain-Typen bei `src/domain/<bereich>/`,
- Supabase-Row- und Write-Payload-Typen bei der jeweiligen
  Infrastrukturgrenze,
- Feature-Props und Feature-State im jeweiligen Feature,
- wirklich gemeinsam genutzte primitive Typen in einem klar benannten
  `src/shared`-Modul.

Ein allgemeines `types.ts`-Sammelmodul ist zu vermeiden. Typen dürfen nicht zu
Rückabhängigkeiten von Domain nach React, UI oder Supabase führen.

## 7. Qualitäts-Gates pro Migrationsschritt

Jede konkrete Migration benötigt mindestens:

1. gezielte Tests des migrierten Moduls und seiner öffentlichen Verträge,
2. Tests für Nullable-, ungültige und externe Eingaben, soweit betroffen,
3. `npm test`,
4. `npm run test:coverage`,
5. `npx tsc --noEmit`,
6. `npm run build`,
7. Browser-/Preview-Prüfung nur bei sichtbarem oder interaktivem Verhalten,
8. finalen Diff- und Importpfad-Check.

Ein eigenständiges npm-Typecheck-Skript und seine CI-Einbindung gehören zu
KAN-20 beziehungsweise KAN-19. Bis dahin bleibt `npx tsc --noEmit` der
verbindliche Befehl.

## 8. Definition of Ready für ein Migrationsmodul

Ein Modul ist für die Migration geeignet, wenn:

- seine Verantwortung und öffentlichen Exporte bekannt sind,
- relevante Aufrufer und Importpfade inventarisiert sind,
- sein Verhalten durch aussagekräftige Tests abgesichert ist,
- externe Datenformen und Nullable-Felder bekannt sind,
- keine fachliche Neugestaltung notwendig ist,
- der Ticket-Scope klein genug für unabhängiges Review und Rollback ist.

Fehlt eine dieser Voraussetzungen, wird zuerst ein separates Test-, Analyse-
oder Refactoring-Ticket bearbeitet.

## 9. Fortschrittsnachweis

Der Fortschritt wird nicht an der Anzahl umbenannter Dateien gemessen, sondern
an stabil typisierten Grenzen. Pro abgeschlossenem Ticket werden dokumentiert:

- migrierte Module und Exporte,
- neu definierte Domain-, Row- und Payload-Typen,
- verbleibende JavaScript-Grenzen,
- Test- und Typecheck-Nachweise,
- bewusst aufgeschobene Unsicherheiten.

Eine höhere TypeScript-Dateiquote allein ist kein Erfolg, wenn dafür Typregeln
abgeschwächt oder Fachgrenzen vermischt werden.

## 10. Empfohlener erster Umsetzungsvorgang

Der erste Umsetzungs-Task sollte `src/domain/study/integer.js` nach TypeScript
migrieren und dabei die TypeScript-Includes sowie `strict` kontrolliert
aktivieren. Danach folgen `activity.js` und `academics/topic.js` als weitere
seiteneffektfreie Blattmodule. Dieser Schritt ist nicht Bestandteil von KAN-15
und wird erst nach eigener Jira-/GitHub-Planung begonnen.
