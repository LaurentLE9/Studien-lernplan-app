# Kontext- und Nutzerlimit-Effizienz

**Stand:** KAN-107, 20.08.2026
**Zweck:** stabile Kontextkarte für Entwicklungs-Agenten; ersetzt weder Jira, `AGENTS.md` noch die vollständigen Pflichtprüfungen.

## 1. Analysebefund

Die KAN-107-Inventur erfasste alle 98 von Git verfolgten Dateien über Metadaten, Dateitypen, Größen, Zeilenzahlen und statische Suchtreffer. Relevante Prozess-, Architektur- und Testdateien wurden anschließend inhaltlich geprüft.

Hauptursachen des hohen Agentenverbrauchs:

1. `src/App.jsx` umfasst 6.910 von rund 22.028 verfolgten Zeilen und bündelt viele unabhängige UI- und Zustandsbereiche. Ein ungezieltes vollständiges Einlesen verbraucht deshalb unverhältnismäßig viel Kontext.
2. Die verbindlichen Regeln sind bewusst in Jira, Confluence, `AGENTS.md`, `README.md`, `docs/LOOP_ENGINEERING.md` und den Copilot-Anweisungen gespiegelt. Ohne Wiederverwendung innerhalb eines Arbeitslaufs entstehen redundante Lese- und Übertragungsschritte.
3. `npm test` und `npm run test:coverage` führen beide die vollständige Vitest-Suite aus. Beide bleiben als getrennte Qualitätsnachweise erforderlich, dürfen aber nicht mehrfach pro unverändertem finalen Kandidaten gestartet werden.
4. Der bisherige Repair-Text verlangte nach jeder kleinen Reparatur erneut vollständige Pflichtprüfungen. Das erzeugte Wiederholungen, obwohl zunächst ein gezielter Test zur Fehlerursache genügt und die vollständige Baseline erst für den finalen Kandidaten benötigt wird.
5. Es gab keine zentrale Kontextkarte, keine explizite Gültigkeitsregel für Prüfnachweise und keine Pflicht, Vollscans oder Wiederholungen zu begründen.

Das Repository enthält aktuell keine produktive KI-/Agenten-Laufzeit und keine Modellprovider-Abhängigkeit. KAN-107 optimiert daher den Entwicklungsprozess; die spätere App-KI bleibt im Scope der dafür vorgesehenen Jira-Vorgänge.

## 2. Repository-Kontextkarte

| Aufgabenbereich | Primäre Dateien | Ergänzende Nachweise |
| --- | --- | --- |
| Agentenprozess, DoD, Git/Jira | `AGENTS.md`, `docs/LOOP_ENGINEERING.md`, `.github/copilot-instructions.md`, `README.md` | Jira-Ticket, GitHub Issue, betroffene Confluence-Seite |
| App-Shell oder übergreifender Zustand | relevante Symbole/Zeilen in `src/App.jsx` | `src/test/app-regression.test.jsx`, `src/test/smoke.test.jsx` |
| Dashboard | `src/features/dashboard/config.js`, betroffene Dashboard-Komponente, relevante Aufrufer in `src/App.jsx` | Dashboard-/App-Regressionstests |
| Aufgaben und Projekte | `src/domain/tasks/task.js`, `src/domain/projects/project.js`, relevante App-Aufrufer | `src/test/domain-modules.test.js`, betroffene Regressionstests |
| Fächer, Semester, Themen, Prüfungen | `src/domain/academics/`, passende Dateien in `src/infrastructure/supabase/` und betroffene Seite | `src/test/academic-repositories.test.js` |
| Timer und Lernzeit | `src/domain/study/`, passende Supabase-Repositories und betroffene Komponenten | `src/test/timer-study-repositories.test.js` |
| Authentifizierung und Cloud-Sync | `src/lib/cloudStore.js`, `src/infrastructure/supabase/authRepository.js`, `restRepository.js` | Auth- und Cloud-Store-Regressionstests; Stop-Regeln beachten |
| Datenbank | betroffene Datei unter `supabase/migrations/`, bei Bedarf `supabase/schema.sql` | migrationsbezogene Tests/Review; RLS- und Datenrisiken prüfen |
| Styling oder UI-Grundbausteine | betroffene Datei unter `src/components/ui/`, `src/index.css` | gezielte Komponententests und bei sichtbaren Änderungen Browserprüfung |

Die Tabelle ist ein Einstiegspunkt, keine Positivliste. Direkte Imports, Aufrufer und Tests der tatsächlichen Änderung müssen zusätzlich geprüft werden.

## 3. Minimaler Analyseablauf

1. Ticket, Akzeptanzkriterien, Nicht-Ziele und Stop-Risiken feststellen.
2. `git status`, Ausgangs-HEAD und Diff bestimmen.
3. Geänderte Dateien und direkte Abhängigkeiten über `rg` beziehungsweise Imports eingrenzen.
4. Große Dateien über Symbole und relevante Zeilenbereiche lesen; vollständige Datei nur mit dokumentierter Begründung.
5. Vorhandene Dokumentation und gültige Nachweise aus demselben Lauf verwenden.
6. Zuerst den kleinsten aussagekräftigen Test oder statischen Check ausführen.
7. Alle vollständigen Pflichtprüfungen einmal für den finalen Kandidaten ausführen.
8. Im Abschlussbericht untersuchte Bereiche, Prüfungen, wiederverwendete Nachweise und begründete Vollscans festhalten.

## 4. Gültigkeit von Prüfnachweisen

Ein Ergebnis darf nur wiederverwendet werden, wenn alle Punkte erfüllt sind:

- geprüfter Commit oder Arbeitsbaum ist eindeutig dokumentiert,
- der genaue Befehl und sein Ergebnis sind bekannt,
- seitdem wurden keine von der Prüfung erfassten Quellen, Tests, Konfigurationen, Abhängigkeiten oder Umgebungsbedingungen geändert,
- der Nachweis gehört zum aktuellen Jira-Scope und ist für das aktuelle Qualitäts-Gate ausreichend.

Änderungen an `package.json`, Lockfile, Vite/Vitest/TypeScript-Konfiguration oder gemeinsam genutzten Test-Setups machen die entsprechenden vollständigen Nachweise ungültig. Eine reine Dokumentationsänderung macht einen bereits abgeschlossenen Code-Test nicht automatisch ungültig; die verbindlichen Abschlussprüfungen aus `AGENTS.md` bleiben dennoch für den finalen Aufgabenstand erforderlich.

## 5. Grenzen

- Kein Cache darf Sicherheits-, Berechtigungs-, Datenintegritäts- oder Browsernachweise überdecken.
- Fehlende oder zweifelhafte Evidenz wird neu erzeugt, nicht angenommen.
- Eine auffällige Zunahme von Kontext, Testdauer oder Wiederholungen wird im Jira-Nachweis als Ursache und Folgeoptimierung dokumentiert.
- Strukturänderungen am Repository müssen diese Kontextkarte im selben Ticket aktualisieren, sofern ihr Routing dadurch veraltet.
