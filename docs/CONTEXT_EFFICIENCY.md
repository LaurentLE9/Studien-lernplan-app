# Kontext- und Nutzerlimit-Effizienz

**Stand:** KAN-157, 04.09.2026
**Zweck:** stabile Kontextkarte für Entwicklungs-Agenten; ersetzt weder Jira, `AGENTS.md` noch die vollständigen Pflichtprüfungen.

## 1. Analysebefund

Die KAN-107-Inventur erfasste alle 98 von Git verfolgten Dateien über Metadaten, Dateitypen, Größen, Zeilenzahlen und statische Suchtreffer. Relevante Prozess-, Architektur- und Testdateien wurden anschließend inhaltlich geprüft.

Hauptursachen des hohen Agentenverbrauchs:

1. `src/App.jsx` umfasst 6.910 von rund 22.028 verfolgten Zeilen und bündelt viele unabhängige UI- und Zustandsbereiche. Ein ungezieltes vollständiges Einlesen verbraucht deshalb unverhältnismäßig viel Kontext.
2. Die verbindlichen Regeln sind bewusst in Jira, Confluence, `AGENTS.md`, `README.md`, `docs/LOOP_ENGINEERING.md` und den Copilot-Anweisungen gespiegelt. Ohne Wiederverwendung innerhalb eines Arbeitslaufs entstehen redundante Lese- und Übertragungsschritte.
3. `npm test` und `npm run test:coverage` führen beide die vollständige Vitest-Suite aus. Beide bleiben als getrennte Qualitätsnachweise erforderlich, dürfen aber nicht mehrfach pro unverändertem finalen Kandidaten gestartet werden.
4. Der bisherige Repair-Text verlangte nach jeder kleinen Reparatur erneut vollständige Pflichtprüfungen. Das erzeugte Wiederholungen, obwohl zunächst ein gezielter Test zur Fehlerursache genügt und die vollständige Baseline erst für den finalen Kandidaten benötigt wird.
5. Es gab keine zentrale Kontextkarte, keine explizite Gültigkeitsregel für Prüfnachweise und keine Pflicht, Vollscans oder Wiederholungen zu begründen.

Das Repository enthält aktuell keine produktive KI-/Agenten-Laufzeit und keine Modellprovider-Abhängigkeit. KAN-107 und KAN-157 optimieren daher den Entwicklungsprozess; die spätere App-KI bleibt im Scope der dafür vorgesehenen Jira-Vorgänge.

## 2. Repository-Kontextkarte

| Aufgabenbereich | Primäre Dateien | Ergänzende Nachweise |
| --- | --- | --- |
| Agentenprozess, DoD, Git/Jira | `AGENTS.md`, `docs/agent-context/process-jira.md`, bei Bedarf `docs/LOOP_ENGINEERING.md`, `.github/copilot-instructions.md`, `README.md` | Jira-Ticket, GitHub Issue, betroffene Confluence-Seite |
| App-Shell oder übergreifender Zustand | `docs/agent-context/architecture.md`, relevante Symbole/Zeilen in `src/App.jsx` | `src/test/app-regression.test.jsx`, `src/test/smoke.test.jsx` |
| Dashboard / sichtbare Feature-UI | `docs/agent-context/frontend.md`, betroffene Feature-/UI-Dateien, relevante App-Aufrufer | passende Dashboard-/App-Regressionstests |
| Aufgaben und Projekte | `docs/agent-context/frontend.md`, `src/domain/tasks/task.js`, `src/domain/projects/project.js`, relevante App-Aufrufer | `src/test/domain-modules.test.js`, betroffene Regressionstests |
| Fächer, Semester, Themen, Prüfungen | `docs/agent-context/backend-supabase.md`, `src/domain/academics/`, passende Dateien in `src/infrastructure/supabase/` | `src/test/academic-repositories.test.js` |
| Timer und Lernzeit | `docs/agent-context/backend-supabase.md` oder `frontend.md` je nach Scope, `src/domain/study/`, passende Supabase-Repositories und Komponenten | `src/test/timer-study-repositories.test.js` |
| Authentifizierung und Cloud-Sync | `docs/agent-context/backend-supabase.md`, `src/lib/cloudStore.js`, `src/infrastructure/supabase/authRepository.js`, `restRepository.js` | Auth- und Cloud-Store-Regressionstests; Stop-Regeln beachten |
| Datenbank | `docs/agent-context/backend-supabase.md`, betroffene Datei unter `supabase/migrations/`, bei Bedarf `supabase/schema.sql` | migrationsbezogene Tests/Review; RLS- und Datenrisiken prüfen |
| Styling oder UI-Grundbausteine | `docs/agent-context/frontend.md`, betroffene Datei unter `src/components/ui/`, `src/index.css` | gezielte Komponententests und bei sichtbaren Änderungen Browserprüfung |
| AI/n8n/Modellrouting | `docs/agent-context/ai-n8n.md`, `docs/MODEL_ROUTING.md`, betroffene Bridge-/Workflow-Dateien | KAN-110/KAN-127/KAN-147 sowie passende Workflow-Tests |

Die Tabelle ist ein Einstiegspunkt, keine Positivliste. Direkte Imports, Aufrufer und Tests der tatsächlichen Änderung müssen zusätzlich geprüft werden.

## 3. Progressive Context Loading

KAN-157 ergänzt die Kontextkarte um eine explizite Router-Schicht unter `docs/agent-context/`.

Der Standardfluss ist:

1. **Stufe 0 – Ticket:** Jira-Key, Ziel, Akzeptanzkriterien, Nicht-Ziele, Status und bekannte Risiken laden.
2. **Stufe 1 – Root-Regeln:** `AGENTS.md` und `docs/agent-context/README.md` lesen.
3. **Stufe 2 – Domäne:** genau den oder die für den Scope notwendigen Router laden, z. B. `frontend.md`, `testing.md` oder `ai-n8n.md`.
4. **Stufe 3 – Evidenz:** nur die dort referenzierten Dateien, relevanten Zeilenbereiche, Diffs, Tests und bei Bedarf Confluence-Seiten nachladen.

Nicht jede Aufgabe benötigt `README.md`, `docs/LOOP_ENGINEERING.md`, `docs/MODEL_ROUTING.md` oder vollständige Confluence-Seiten im Voraus. Diese Quellen werden nur geladen, wenn der Root-/Domänen-Router oder das Ticket sie für den aktuellen Schritt verlangt. Sicherheits-, Git-, Test- und DoD-Gates bleiben unabhängig davon verbindlich.

Fehlt erforderlicher Kontext, wird gezielt nachgeladen. Kann nicht bestimmt werden, welche Quelle erforderlich ist, gilt `ESCALATE` beziehungsweise der bestehende Stop-/ASK_USER-Prozess statt einer Annahme.

## 4. Minimaler Analyseablauf

1. Ticket, Akzeptanzkriterien, Nicht-Ziele und Stop-Risiken feststellen.
2. `AGENTS.md` und `docs/agent-context/README.md` lesen und die betroffene Domäne klassifizieren.
3. Nur die passenden Domänen-Router laden.
4. `git status`, Ausgangs-HEAD und Diff bestimmen.
5. Geänderte Dateien und direkte Abhängigkeiten über `rg` beziehungsweise Imports eingrenzen.
6. Große Dateien über Symbole und relevante Zeilenbereiche lesen; vollständige Datei nur mit dokumentierter Begründung.
7. Vorhandene Dokumentation und gültige Nachweise aus demselben Lauf verwenden.
8. Zuerst den kleinsten aussagekräftigen Test oder statischen Check ausführen.
9. Alle vollständigen Pflichtprüfungen einmal für den finalen Kandidaten ausführen.
10. Im Abschlussbericht untersuchte Bereiche, geladene Router, Prüfungen, wiederverwendete Nachweise und begründete Vollscans festhalten.

## 5. Task-State und Fortsetzung

Für längere oder unterbrochene Vorgänge soll ein schlanker Task-State beziehungsweise Handover genügen, um ohne alten Chatverlauf fortzusetzen. Er enthält mindestens:

- Jira-Key und Status,
- Branch und relevanten Commit,
- zuletzt abgeschlossene Schritte,
- aktuell betroffene Domänen/Router,
- nächste Schritte,
- offene Risiken oder Blocker,
- letzten gültigen Test-/Review-Stand.

Der Task-State enthält keine Secrets und ersetzt weder Jira noch die verbindliche Definition of Done.

## 6. Vorher-/Nachher-Nachweis KAN-157

Als reale Referenz wurde der bereits dokumentierte Dashboard-Bug **KAN-108** verwendet, weil er einen klar abgegrenzten UI-/Timer-Scope besitzt.

### Vor KAN-157

Der bisherige verbindliche Einstieg verlangte mindestens:

- Jira-Ticket,
- `AGENTS.md`,
- `README.md`,
- `docs/LOOP_ENGINEERING.md`,
- `docs/MODEL_ROUTING.md`,
- relevante Quell- und Testdateien.

Damit wurden unabhängig vom eigentlichen Dashboard-Scope mehrere große allgemeine Prozessquellen bereits vor der fachlichen Eingrenzung geladen.

### Mit KAN-157

Für denselben KAN-108-Einstieg reicht zunächst:

- Jira-Ticket KAN-108,
- `AGENTS.md`,
- `docs/agent-context/README.md`,
- `docs/agent-context/frontend.md`,
- anschließend nur die dort für den Dashboard-/Timer-Scope identifizierten Quell- und Teststellen.

`docs/LOOP_ENGINEERING.md`, `docs/MODEL_ROUTING.md`, Backend-/Supabase-Router oder vollständige Confluence-Seiten werden erst nachgeladen, wenn der konkrete Schritt sie benötigt. Dadurch sinkt die Zahl der vorab verpflichtend geladenen allgemeinen Repository-Dokumente von vier (`README.md`, `LOOP_ENGINEERING.md`, `MODEL_ROUTING.md` plus allgemeine relevante Dateien-Suche) auf einen zentralen Router plus einen passenden Domänen-Router. Die vollständigen Qualitäts- und Sicherheitsprüfungen am Ende bleiben unverändert.

Dieser Vergleich misst bewusst die **Kontextquellen und Ladebreite**, nicht geschätzte Modell-Tokens, da Tokenisierung modellabhängig ist. Ziel ist reproduzierbar weniger unnötig vorab geladener Kontext ohne Informationsverlust.

## 7. Gültigkeit von Prüfnachweisen

Ein Ergebnis darf nur wiederverwendet werden, wenn alle Punkte erfüllt sind:

- geprüfter Commit oder Arbeitsbaum ist eindeutig dokumentiert,
- der genaue Befehl und sein Ergebnis sind bekannt,
- seitdem wurden keine von der Prüfung erfassten Quellen, Tests, Konfigurationen, Abhängigkeiten oder Umgebungsbedingungen geändert,
- der Nachweis gehört zum aktuellen Jira-Scope und ist für das aktuelle Qualitäts-Gate ausreichend.

Änderungen an `package.json`, Lockfile, Vite/Vitest/TypeScript-Konfiguration oder gemeinsam genutzten Test-Setups machen die entsprechenden vollständigen Nachweise ungültig. Eine reine Dokumentationsänderung macht einen bereits abgeschlossenen Code-Test nicht automatisch ungültig; die verbindlichen Abschlussprüfungen aus `AGENTS.md` bleiben dennoch für den finalen Aufgabenstand erforderlich.

## 8. Grenzen

- Kein Cache oder Router darf Sicherheits-, Berechtigungs-, Datenintegritäts- oder Browsernachweise überdecken.
- Fehlende oder zweifelhafte Evidenz wird neu erzeugt, nicht angenommen.
- Eine auffällige Zunahme von Kontext, Testdauer oder Wiederholungen wird im Jira-Nachweis als Ursache und Folgeoptimierung dokumentiert.
- Strukturänderungen am Repository müssen Kontextkarte und betroffene Router im selben Ticket aktualisieren, sofern ihr Routing dadurch veraltet.
- Router sind Navigationshilfen, keine zweite Quelle der Wahrheit für fachliche Regeln oder Jira-Status.
