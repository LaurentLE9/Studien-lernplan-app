# AGENTS.md — Agent Operating System

Diese Datei ist die verbindliche **Kernel-/Betriebssystem-Regelbasis** für Codex und andere Entwicklungs-Agenten in `LaurentLE9/Studien-lernplan-app`.

Sie beschreibt **was** ein Agent in welcher Reihenfolge tun muss. Detailregeln stehen in spezialisierten Router-/Policy-Dateien und werden nur geladen, wenn der aktuelle Scope sie benötigt.

## 1. Sources of Truth

Für Entwicklungsarbeit gelten diese Quellen in dieser Reihenfolge:

1. **Jira** – operativer Scope, Status, Sprint, Priorität, Akzeptanzkriterien und Abhängigkeiten.
2. **AGENTS.md** – verbindliche Agent-OS-/Kernel-Regeln.
3. **`docs/agent-context/README.md`** – zentraler Context Router für Progressive Context Loading.
4. **Spezialisierte Policies/Router** – nur laden, wenn der Scope sie benötigt.
5. **Confluence-Projekt-Hub** – dauerhafte Prozess-, Architektur- und Wissensdokumentation.
6. **Repository-Code und Tests** – technische Ist-Quelle für das tatsächlich implementierte Verhalten.

Die dauerhafte Definition of Done und der Arbeitsprozess liegen im Confluence-Projekt-Hub auf der Seite **„Arbeitsprozess und Definition of Done“**.

## 2. Boot Sequence

Vor jeder nicht-trivialen Entwicklungsaufgabe:

1. aktiven Jira-Vorgang vollständig lesen,
2. `AGENTS.md` lesen,
3. Branch, HEAD, Remote und `git status` prüfen,
4. `docs/agent-context/README.md` laden,
5. Scope, Nicht-Ziele, Risiken, betroffene Schichten und benötigte Nachweise bestimmen,
6. ausschließlich die dafür notwendigen Domänen-Router, Policies, Dateien und Tests laden,
7. erforderliche Modellstufe bestimmen,
8. `PLAN` starten.

Ein vollständiger Repository-, Jira- oder Confluence-Scan ist nur zulässig, wenn Ticket-Scope, Fehlerbild oder Architekturänderung ihn konkret erfordern. Der Grund muss im Abschlussnachweis genannt werden.

## 3. Context Routing

Progressive Context Loading ist verbindlich.

Der zentrale Router ist:

- `docs/agent-context/README.md`

Typische Detailquellen werden nur bei Bedarf geladen:

- Architektur/Refactoring → Domänen-Router + relevante Architekturquellen,
- Frontend/UI → relevante Feature-/UI-Dateien und Tests,
- Supabase/Auth/RLS → Backend-/Supabase-Router + Sicherheitsregeln,
- Tests/E2E/CI → `docs/BROWSER_E2E_POLICY.md` und Testing-Router,
- Prozess/Jira/GitHub/Confluence → Prozess-Router,
- n8n/Modelle/Provider → AI-/n8n-Router + `docs/MODEL_ROUTING.md`.

Große unveränderte Dateien nicht vollständig laden, wenn Suche, Symbole, relevante Zeilenbereiche, Git-Diff oder direkte Abhängigkeiten ausreichen.

## 4. Model Routing

Die Detailregeln in `docs/MODEL_ROUTING.md` sind verbindlich.

Es existieren **zwei strikt getrennte Betriebsmodi**:

### 4.1 `TEMPORARY_MANUAL_CODEX_ROUTING`

Dieser Modus ist ausschließlich eine **Übergangslösung**, solange das automatische n8n-Routing noch nicht produktiv und verbindlich für den direkten Entwicklungsworkflow aktiv ist.

- `requiredModel` wird aus Scope, Risiko, Komplexität und Unsicherheit bestimmt.
- `requiredModel` darf **nicht** davon abhängen, dass das aktive Modell bekannt ist.
- `activeModel` ist lediglich optionale Laufzeit-Metadaten und darf `unknown` sein.
- Ein Agent darf das aktive Modell niemals raten oder erfinden.
- Ist das aktive Modell zuverlässig bekannt und schwächer als `requiredModel`, muss der Agent **vor dem ersten Write des betreffenden Implementierungsblocks** stoppen.
- Bei notwendiger manueller Umschaltung darf die Benutzerhinweiszeile ausschließlich lauten:
  - `Jetzt brauchen wir Terra.`
  - `Jetzt brauchen wir Sol.`
- Nach dem manuellen Wechsel wird vorhandener gültiger Kontext weiterverwendet; kein unnötiger Vollscan.

### 4.2 `AUTOMATED_N8N_ROUTING`

Dieser Modus ist das **dauerhafte Zielsystem**.

- n8n bestimmt `requiredModel` bzw. die Ausführungsroute automatisch.
- Modell-/Providerwahl erfolgt ohne manuelle Benutzerentscheidung.
- Reiner Modellbedarf erzeugt weder `ASK_USER` noch `Jetzt brauchen wir <Modellname>.`.
- Der Benutzer muss nicht mitteilen, welches Modell verwendet werden soll.
- Das automatische System darf den manuellen Übergangsmodus nicht simulieren oder mit ihm vermischen.

### 4.3 Abschaltbedingung der Übergangslösung

Sobald der produktive n8n-Router für den direkten Entwicklungsworkflow nachweislich:

1. Scope/Risiko/Komplexität bewertet,
2. `requiredModel`/Route zuverlässig bestimmt,
3. den ausführenden Modell-/Providerpfad automatisch auswählt,
4. die erforderlichen Qualitäts- und Sicherheits-Gates einhält,
5. und dieser Pfad als verbindlicher Standard freigegeben wurde,

wird `TEMPORARY_MANUAL_CODEX_ROUTING` deaktiviert. Danach ist für diesen Workflow ausschließlich `AUTOMATED_N8N_ROUTING` zulässig.

## 5. Execution Loop

Für nicht-triviale Änderungen gilt verbindlich:

```text
PLAN → IMPLEMENT → VERIFY → EVALUATE
                         ├─ PASS → PUBLISH/REVIEW
                         ├─ RETRY → REPAIR → VERIFY
                         ├─ ASK_USER → stoppen und Entscheidung einholen
                         └─ ABORT → sicher stoppen und dokumentieren
```

Detailregeln: `docs/LOOP_ENGINEERING.md`.

### PLAN

- `npm run integrity:start` ausführen und nur bei `PASS` fortfahren.
- Ticket, Scope, Akzeptanzkriterien und Nicht-Ziele erfassen.
- relevante Dateien, Abhängigkeiten, Risiken und Tests bestimmen.
- erforderliche Modellstufe bestimmen.
- für den späteren Abschlussabgleich betroffene Confluence-Seiten identifizieren.

### IMPLEMENT

- kleinste sinnvolle Änderung umsetzen.
- bei Bugs nach Möglichkeit zuerst Regression reproduzierbar machen.
- Architektur- und Modulgrenzen respektieren.
- keine zusätzlichen Features, Paket-Upgrades oder Nebenbaustellen ohne eigenen Jira-Vorgang.

### VERIFY

- vor fachlichen Prüfungen `npm run integrity:verify` ausführen,
- zuerst gezielte Tests,
- danach die laut DoD und Scope erforderlichen vollständigen Prüfungen,
- UI-/Interaktionsänderungen zusätzlich gemäß `docs/BROWSER_E2E_POLICY.md` prüfen.

### EVALUATE

Mindestens bewerten:

- correctness,
- acceptance criteria,
- scope,
- regression risk,
- security,
- data integrity,
- test quality,
- documentation,
- evidence.

Ergebnis: `PASS`, `RETRY`, `ASK_USER` oder `ABORT`.

Maximal drei Reparaturversuche pro zusammenhängender Fehlerursache. Eine nachweislich fehlgeschlagene Strategie nicht unverändert wiederholen.

## 6. Git- und Publishing-Regeln

- Niemals direkt auf `main` entwickeln oder pushen.
- Aufgaben-Branch vom aktuellen `main` erstellen.
- Branch-Namen enthalten den Jira-Key.
- Fremde oder unklare uncommittierte Änderungen niemals überschreiben, löschen, resetten, stashen oder mitcommitten, um ein Gate zu umgehen.
- Vor der Implementierung muss für eigenständig bearbeitbare Repository-Arbeit ein passendes GitHub Issue existieren, sofern keine dokumentierte Ausnahme gilt.
- Jira und GitHub Issue gegenseitig verknüpfen.
- Branch, Commits und Pull Request enthalten den Jira-Key.
- Pull Request referenziert das GitHub Issue mit `Refs #<Nummer>`; keine automatische Schließformel allein durch Merge.
- Vor Push/PR `npm run integrity:finish` ausführen.

Branch-Schema:

- Feature: `feature/KAN-XX-kurzer-name`
- Bugfix: `fix/KAN-XX-kurzer-name`
- Refactoring: `refactor/KAN-XX-kurzer-name`
- Tests: `test/KAN-XX-kurzer-name`
- Dokumentation: `docs/KAN-XX-kurzer-name`

## 7. Safety / Stop Conditions

Sofort stoppen bzw. menschliche Freigabe verlangen bei:

- Authentifizierungs-/Session-Sicherheitsänderungen,
- Änderungen an Supabase RLS oder Berechtigungsmodellen,
- destruktiven oder riskanten Datenbankmigrationen,
- möglichem Datenverlust,
- Secrets, API-Keys, Tokens oder produktiven Zugangsdaten,
- wesentlich erweitertem Scope,
- untrennbaren fremden Änderungen,
- drei erfolglosen Reparaturversuchen,
- fachlichen Entscheidungen oder Freigaben, die nicht sicher aus Jira/DoD/Repository ableitbar sind.

Secrets dürfen niemals in Code, Logs, Tests, Commits, Jira, GitHub oder Confluence aufgenommen werden.

Bei irregulärer Beendigung `npm run integrity:abort` ausführen und den unveränderten Zustandsnachweis im Jira-Vorgang dokumentieren.

## 8. Verification Policies

Die vollständigen Detailanforderungen stehen in den jeweiligen Policies und in der Definition of Done.

Grundsätzlich für den finalen Kandidaten, soweit im Projekt verfügbar und laut Scope erforderlich:

```bash
npm test
npm run test:coverage
npx tsc --noEmit
npm run build
```

Zusätzlich:

- `git diff --check`,
- relevante Lint-/Integrity-Prüfungen,
- Browser-/E2E-Prüfung gemäß `docs/BROWSER_E2E_POLICY.md` bei sichtbarem/interaktivem Verhalten,
- Sicherheits-/Datenintegritätsprüfung im betroffenen Scope.

Prüfungen nicht abschwächen, überspringen oder löschen, nur damit der Stand grün erscheint. Weiterhin gültige Nachweise dürfen wiederverwendet werden, wenn Commit/Arbeitsbaum und relevante Quellen unverändert sind.

## 9. Completion / Definition of Done

`technisch reviewbereit` ist **nicht** gleich Jira `Erledigt`.

Vor `technisch reviewbereit` müssen mindestens erfüllt sein:

- Akzeptanzkriterien erfüllt,
- Scope eingehalten,
- erforderliche Tests/Build/Typecheck erfolgreich,
- erforderliche Browser-/E2E-Prüfung tatsächlich erfolgreich ausgeführt,
- Sicherheits- und Datenintegritätsregeln eingehalten,
- finaler Diff geprüft,
- GitHub Issue/Jira/Branch/Commit/PR korrekt verknüpft,
- Modell-Routing-Betriebsmodus korrekt angewendet,
- offene Risiken und Repair-Loops dokumentiert.

Vor Jira `Erledigt` zusätzlich:

1. Pull Request erfolgreich reviewt und nach `main` gemerged,
2. erforderliche Nachprüfung abgeschlossen,
3. Projekt-Hub und fachlich betroffene Confluence-Seiten geprüft/aktualisiert,
4. falls keine Confluence-Änderung nötig ist: `Confluence geprüft – keine Aktualisierung erforderlich` im Jira-Abschlussnachweis,
5. GitHub Issue mit Abschlussnachweis schließen.

Die vollständige Definition of Done im Confluence-Projekt-Hub bleibt verbindlich.

## 10. Browser-/E2E-Policy

Bei UI-, Interaktions-, Timer-, Semester-, Aufgaben-, Projekt-, Statistik-, Dashboard-, Navigations-, Persistenz- oder Synchronisationsänderungen die verbindliche Detailpolicy laden:

- `docs/BROWSER_E2E_POLICY.md`

Der isolierte Test-Account ist für erforderliche Browser-/E2E-/Smoke-/Regressionstests vorab freigegeben. Nicht erneut fragen, ob der Test oder das Testkonto verwendet werden soll. Fehlende erforderliche Test-Secrets sind ein Blocker und dürfen nicht als PASS behandelt werden.

## 11. Copilot Fallback

Der GitHub-Copilot-Fallback ist **kein normaler Routing-Modus** und wird nur aktiviert, wenn der Benutzerauftrag mit `[COPILOT-FALLBACK]` beginnt.

Ein erreichtes ChatGPT-/Codex-Nutzerlimit wird nicht automatisch erkannt. Ohne expliziten Marker bleibt der normale Codex-/n8n-Entwicklungsworkflow aktiv.

Zentrale Anleitung:

- Confluence: **„KI-Entwicklungsworkflow – Codex- und Copilot-Fallback“**
- `https://studien-lernplan-app.atlassian.net/wiki/spaces/PROJEKTHUB/pages/13697025`

## 12. Abschlussnachweis

Der Abschlussbericht nennt kurz:

- Jira-Key und GitHub Issue,
- verwendete Context Router/Policies,
- untersuchte Dateien/Bereiche,
- ausgeführte und wiederverwendete Prüfungen,
- verwendeten Routing-Modus,
- `requiredModel`; `activeModel` nur wenn zuverlässig bekannt, sonst `unknown`,
- Vollscan ja/nein und gegebenenfalls Begründung,
- Commit/PR/Review-/Merge-Status,
- offene Risiken oder Blocker.

## Verknüpfte Vorgänge

- KAN-30 – Entwicklungs- und Jira-Workflow dokumentieren
- KAN-72 – Isolierten Testnutzer und Browser-End-to-End-Tests einführen
- KAN-73 – Kontrollierten Entwicklungs-Loop für Codex einführen
- KAN-74 – AGENTS.md erstellen und mit Definition of Done verknüpfen
- KAN-109 – Browser-/E2E-Regressionstest erweitern und Test-Account ohne Rückfrage verbindlich machen
- KAN-110 – n8n-Automatisierungs- und KI-Routing-Schicht mit Codex-Orchestrierung einführen
- KAN-127 – KI-Router, Modellwahl, Eskalation und Kostenmetriken für n8n umsetzen
- KAN-147 – Modell-Routing-Betriebsmodi verbindlich trennen
- KAN-157 – Agenten-Memory mit Router-Dateien und Progressive Context Loading einführen
- KAN-161 – AGENTS.md als Agent Operating System refaktorieren und manuelles Modell-Routing klar vom n8n-Zielsystem trennen
