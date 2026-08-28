# Loop Engineering – Studien-Lernplan-App

**Status:** verbindliche technische Leitlinie für KI-/Agenten-Workflows  
**Stand:** 07.08.2026  
**Verknüpfte Jira-Vorgänge:** KAN-30, KAN-72, KAN-73, KAN-74

## 1. Zweck

Diese Dokumentation beschreibt, wie Loop Engineering in der Studien-Lernplan-App eingesetzt wird. Sie verbindet den Entwicklungsprozess in Jira und Confluence mit den Regeln im GitHub-Repository und bildet zugleich die Grundlage für spätere KI-Funktionen innerhalb der App.

Der Begriff **Loop Engineering** wird hier für kontrollierte, wiederholbare Abläufe verwendet, in denen ein Agent nicht einfach eine Antwort erzeugt, sondern nach jedem Schritt prüft, ob das Ziel erreicht wurde, ob Fehler vorliegen und ob eine weitere Iteration zulässig ist.

Grundprinzip:

```text
Ziel
  ↓
Kontext laden
  ↓
Plan erstellen
  ↓
Aktion ausführen
  ↓
Ergebnis beobachten
  ↓
Unabhängig evaluieren
  ├─ PASS → Abschlussprüfung
  ├─ RETRY → gezielte Korrektur
  ├─ ASK_USER → menschliche Entscheidung
  └─ ABORT → sicher stoppen
```

Eine Schleife darf niemals unbegrenzt laufen. Sie braucht ein Ziel, messbare Kriterien, Budgets, Stop-Regeln und einen nachvollziehbaren Abschluss.

---

## 2. Verbindliche Verbindung der Systeme

Für dieses Projekt gilt folgende Verantwortungsverteilung:

```text
Jira
  │ Ticket, Scope, Akzeptanzkriterien, Status
  ▼
Confluence / Projekt-Hub
  │ Arbeitsprozess, Definition of Done, Architekturentscheidungen
  ▼
AGENTS.md
  │ verbindliche Arbeitsregeln für Codex und andere Agenten
  ▼
docs/LOOP_ENGINEERING.md
  │ Iterations-, Evaluations-, Retry-, Stop- und KI-Architekturregeln
  ▼
.github/copilot-instructions.md
  │ GitHub-Copilot-spezifische Repository-Anweisungen
  ▼
Aufgaben-Branch
  │ Implementierung + Tests + Nachweise
  ▼
GitHub Pull Request
  │ Diff, CI, Review, Copilot Review
  ▼
Test / Preview
  │ Browserprüfung und Regression
  ▼
Merge nach main
  ▼
Jira = Erledigt
```

### 2.1 Quellen der Wahrheit

- **Jira** ist die operative Quelle für Ticketstatus, Sprint, Priorität, Scope und Akzeptanzkriterien.
- **Confluence** ist die dauerhafte Quelle für Arbeitsprozess und Definition of Done.
- **`AGENTS.md`** übersetzt diese Regeln in verbindliche Anweisungen für Entwicklungs-Agenten.
- **`docs/LOOP_ENGINEERING.md`** definiert, wie Agenten iterieren, bewerten, stoppen und Risiken behandeln.
- **`.github/copilot-instructions.md`** macht die Regeln für GitHub Copilot direkt auffindbar.
- **GitHub** ist die technische Quelle für Branches, Commits, Pull Requests, Reviews und den tatsächlich gemergten Stand.

Die Repository-Dokumente ersetzen Jira oder Confluence nicht. Sie spiegeln die dort beschlossenen Regeln so, dass Agenten sie während der Codearbeit direkt berücksichtigen können.

---

## 3. Standard-Entwicklungs-Loop

Der Standard-Loop für jede Jira-Aufgabe ist:

### Phase A – PLAN

1. Jira-Ticket lesen.
2. Relevante Confluence-Seiten lesen.
3. `AGENTS.md`, `README.md`, `package.json` und diese Datei lesen.
4. Git-Status, aktuellen Branch, Remote und Ausgangs-HEAD prüfen.
5. `npm run integrity:start` ausführen; bei einem blockierten Ausgangszustand nicht implementieren.
6. Scope und Nicht-Ziele festhalten.
7. Ausgehend von Git-Diff, geänderten Dateien und der Kontextkarte in `docs/CONTEXT_EFFICIENCY.md` betroffene Dateien und Abhängigkeiten identifizieren.
8. Vorhandene, weiterhin gültige Kontext- und Prüfnachweise erfassen; fehlende Evidenz gezielt bestimmen.
9. Risiken bestimmen.
10. Benötigte gezielte Tests und vollständige Abschlussprüfungen festlegen.

Ein vollständiger Repository-Scan ist eine begründungspflichtige Ausnahme. Große Dateien werden über Symbole, Suchtreffer und relevante Zeilenbereiche erschlossen, sofern das Ticket nicht die gesamte Datei betrifft.

**Ausgabe:** überprüfbarer Umsetzungsplan.

### Phase B – IMPLEMENT

1. Eigenen Branch vom aktuellen `main` verwenden.
2. Kleinste sinnvolle Änderung umsetzen.
3. Keine fremden oder nicht ticketbezogenen Änderungen aufnehmen.
4. Bestehende Architektur und Modulgrenzen respektieren.
5. Bei Bugs nach Möglichkeit zuerst einen reproduzierenden Regressionstest erstellen.

### Phase C – VERIFY

Zuerst `npm run integrity:verify`, dann gezielt den betroffenen Bereich und anschließend die vollständigen Pflichtprüfungen ausführen. Das Integritäts-Gate erlaubt einen veränderten Worktree nur auf einem Aufgaben-Branch und blockiert ungelöste Indexkonflikte, Konfliktmarker sowie Fehler aus `git diff --check`.

Aktuelle Baseline:

```bash
npm test
npm run test:coverage
npx tsc --noEmit
npm run build
```

Die Baseline wird einmal für den finalen Kandidaten vollständig ausgeführt. Jeder Nachweis wird dem geprüften Commit beziehungsweise Arbeitsbaum und dem konkreten Befehl zugeordnet. Nach späteren Änderungen werden nur ungültig gewordene gezielte Nachweise sofort wiederholt; vor `PUBLISH` müssen sämtliche Pflichtprüfungen den finalen Stand abdecken.

Zusätzlich bei sichtbaren/interaktiven Änderungen:

- Preview-Deployment eindeutig anhand Branch und Commit bestimmen.
- betroffenen User Flow im Browser testen.
- zentrale abhängige Kernabläufe prüfen.
- Browser-Konsole auf neue Fehler prüfen.

### Phase D – EVALUATE

Der Agent bewertet die Änderung nicht nur anhand von „Tests grün“, sondern mindestens anhand von:

- `correctness`
- `acceptance_criteria`
- `scope`
- `regression_risk`
- `security`
- `data_integrity`
- `test_quality`
- `documentation`
- `reversibility`
- `evidence`

Entscheidung:

```text
PASS     = Kriterien erfüllt; Abschlussprüfung erlaubt
RETRY    = konkreter behebbarer Fehler; neue Strategie erforderlich
ASK_USER = relevante Entscheidung oder Risiko braucht Freigabe
ABORT    = sichere Fortsetzung nicht möglich
```

### Phase E – REPAIR

Bei `RETRY` gilt:

1. Fehlerursache aus Logs, Tests, Diff und Laufzeitverhalten ableiten.
2. Keine identische, bereits fehlgeschlagene Strategie wiederholen.
3. Nur die kleinste nötige Korrektur vornehmen.
4. Betroffene Prüfungen erneut ausführen.
5. Die vollständigen Pflichtprüfungen nach Abschluss der Reparaturserie für den finalen Kandidaten ausführen. Eine einzelne Pflichtprüfung schon vorher erneut ausführen, wenn die Reparatur genau deren bisherigen Nachweis ungültig macht und sie zur nächsten Entscheidung benötigt wird.

**Maximal drei Reparaturversuche pro zusammenhängender Fehlerursache.**

Nach drei erfolglosen Versuchen: `ABORT` oder `ASK_USER`, Ursache und Belege dokumentieren.

Bei `ABORT` wird `npm run integrity:abort` ausgeführt. Der JSON-Bericht enthält Branch, HEAD, Zustandsmerkmale und SHA-256-Fingerprints, aber keine Diff-Inhalte. Er wird im Jira-Vorgang dokumentiert. Der Befehl ist read-only, verändert weder Worktree noch Index oder Stash und darf bei erkannten Integritätsverletzungen mit Exit-Code `1` enden.

### Phase F – PUBLISH

Wenn der Stand technisch prüfbar ist:

1. `git diff` und `git status` prüfen.
2. nur Ticket-Scope committen.
3. Commit-Nachricht mit Jira-Key verwenden.
4. `npm run integrity:finish` ausführen; nur ein sauberer Aufgaben-Branch darf `PASS` ergeben.
5. ausschließlich Aufgaben-Branch pushen.
6. nicht direkt nach `main` pushen.
7. Pull Request und Merge nach dem in Confluence definierten Freigabeprozess durchführen.

---

## 4. Stop-Regeln

Ein Agent muss stoppen und darf nicht selbstständig weiter iterieren, wenn mindestens einer der folgenden Fälle eintritt:

### 4.1 Authentifizierung und Autorisierung

- Änderung an Login-/Session-Sicherheitsmodell
- Änderung an Supabase Auth
- Änderung an Row Level Security Policies
- Aufweichen von Ownership- oder Berechtigungsprüfungen

### 4.2 Datenbank

- destruktive Migration
- Datenverlust möglich
- unklare Rückwärtskompatibilität
- großflächige produktive Datenmigration
- Änderung an Primär-/Fremdschlüsselstruktur mit ungeklärten Folgen

### 4.3 Secrets

- API-Key, Token, Passwort oder Secret im Repository gefunden
- Secret müsste clientseitig eingebettet werden
- produktive Zugangsdaten wären für einen Test nötig

### 4.4 Scope

- notwendige Änderung überschreitet den Jira-Scope wesentlich
- zusätzliche Abhängigkeit oder großes Paket-Upgrade erforderlich
- fremde/uncommittierte Änderungen im Arbeitsverzeichnis können nicht sicher getrennt werden

### 4.5 Loop-Sicherheit

- drei Reparaturversuche ohne Erfolg
- keine messbare Verbesserung über zwei Iterationen
- gleicher Fehler wiederholt sich unverändert
- Test muss abgeschwächt oder gelöscht werden, damit der Build grün wird
- Agent kann nicht nachweisen, welcher Stand tatsächlich getestet wurde

---

## 5. Definition of Done + Loop Engineering

Die zentrale Definition of Done bleibt in Confluence maßgeblich. Loop Engineering ergänzt sie um folgende technische Kontrollpunkte.

Eine Agenten-Änderung darf nur als für Review bereit gelten, wenn:

- [ ] Ziel und Akzeptanzkriterien des Jira-Tickets eindeutig geprüft wurden.
- [ ] Scope und Nicht-Ziele eingehalten wurden.
- [ ] betroffene Dateien und Datenflüsse bekannt sind.
- [ ] relevante Risiken vor der Änderung identifiziert wurden.
- [ ] gezielte Tests für die Änderung erfolgreich sind.
- [ ] Regressionstests erfolgreich sind.
- [ ] `npm test` erfolgreich ist.
- [ ] `npm run test:coverage` erfolgreich ist.
- [ ] `npx tsc --noEmit` erfolgreich ist.
- [ ] `npm run build` erfolgreich ist.
- [ ] erforderliche Browser-/Preview-Prüfung durchgeführt wurde.
- [ ] keine neuen Console Errors im geprüften Flow auftreten.
- [ ] keine Tests gelöscht, übersprungen oder abgeschwächt wurden, um Erfolg zu simulieren.
- [ ] keine Secrets oder produktiven Zugangsdaten enthalten sind.
- [ ] Supabase-/RLS-/Datenrisiken geprüft wurden, soweit betroffen.
- [ ] Evaluator-Ergebnis `PASS` lautet oder offene Punkte ausdrücklich dokumentiert sind.
- [ ] Anzahl und Ergebnis aller Repair-Loops nachvollziehbar sind.
- [ ] finaler Diff ausschließlich zum Ticket gehört.
- [ ] `integrity:verify` für den finalen Arbeitsstand und `integrity:finish` nach dem Commit erfolgreich sind.
- [ ] Commit und Pull Request den Jira-Key enthalten.
- [ ] Änderungen auf einem Aufgaben-Branch liegen, nicht direkt auf `main`.
- [ ] Review-Hinweise geklärt sind.
- [ ] Merge nach `main` bestätigt wurde, bevor Jira auf `Erledigt` gesetzt wird.
- [ ] nur die notwendigen Dateien und Bereiche analysiert und große Dateien gezielt erschlossen wurden.
- [ ] vorhandener gültiger Kontext und gültige Prüfnachweise wiederverwendet sowie identische Analysen vermieden wurden.
- [ ] Testauswahl und vollständige Abschlussprüfungen dem tatsächlichen Änderungsumfang entsprechen, ohne Qualität oder Sicherheit zu beeinträchtigen.
- [ ] untersuchte Bereiche, ausgeführte Prüfungen und auffälliger Ressourcenverbrauch im Abschlussnachweis dokumentiert sind.

Wichtig: **Loop-PASS ist nicht dasselbe wie Jira Done.** Ein Loop kann technisch erfolgreich beendet sein, während der Jira-Vorgang bis Review, Test und Merge weiterhin offen bleibt.

---

## 6. Verbindung zu KAN-72, KAN-73 und KAN-74

### KAN-72 – isolierter Testnutzer und Browser-E2E

KAN-72 liefert die kontrollierte Testumgebung. Loop Engineering verwendet diesen Testnutzer für Browser- und End-to-End-Prüfungen, sobald die technische Grundlage bereitsteht.

### KAN-73 – kontrollierter Entwicklungs-Loop

KAN-73 ist die konkrete Umsetzung des Entwicklungs-Loops. Seine Kernregeln sind:

- Ticket + Projektkontext laden
- Risiken erkennen
- Plan erzeugen
- kontrolliert implementieren
- Tests ausführen
- maximal drei Korrekturversuche
- Stop-Regeln einhalten
- Merge nur nach Freigabe

Dieses Dokument ist die technische Spezifikation und Erweiterung dieses Ansatzes.

### KAN-74 – AGENTS.md + Definition of Done

KAN-74 verbindet die Prozessregeln mit dem Repository. `AGENTS.md` referenziert dieses Dokument und die Definition of Done und ist die erste Datei, die ein Entwicklungs-Agent beachten muss.

### KAN-30 – Entwicklungs- und Jira-Workflow

KAN-30 bildet die organisatorische Grundlage für Statusübergänge, Review und Abschluss.

---

## 7. Anwendung für GitHub Copilot und Codex

Vor einer größeren Änderung müssen Copilot/Codex mindestens folgende Reihenfolge verwenden:

```text
1. Jira-Ticket
2. AGENTS.md
3. README.md
4. docs/LOOP_ENGINEERING.md
5. relevante Architektur-/Feature-Dateien
6. bestehende Tests
```

Für jede Änderung sollen sie intern mit vier Rollen arbeiten:

```text
Planner   → versteht Ticket, Scope und Risiken
Builder   → implementiert kleinsten sinnvollen Patch
Evaluator → prüft Kriterien unabhängig
Reporter  → dokumentiert Nachweise und offenen Stand
```

Diese Rollen können vom gleichen Modell nacheinander ausgeführt werden. Entscheidend ist, dass die Evaluator-Phase nicht nur die vorherige Behauptung des Builders übernimmt.

---

## 8. Prompt-Schema für Entwicklungs-Loops

```text
AUFGABE
Bearbeite <JIRA-KEY> im Repository LaurentLE9/Studien-lernplan-app.

KONTEXT
Lies zuerst AGENTS.md, README.md, docs/LOOP_ENGINEERING.md und die relevanten Dateien.

PLAN
- führe npm run integrity:start aus
- formuliere Ziel und Akzeptanzkriterien
- identifiziere Scope/Nicht-Ziele
- identifiziere Risiken
- bestimme erforderliche Tests

IMPLEMENTIERUNG
- arbeite ausschließlich auf dem Aufgaben-Branch
- ändere nur ticketbezogene Dateien
- halte bestehende Architektur und Sicherheitsregeln ein

EVALUATION
Bewerte nach jeder Implementierungsrunde:
correctness, acceptance_criteria, scope, regression_risk, security,
data_integrity, test_quality, documentation, evidence.

Entscheide: PASS | RETRY | ASK_USER | ABORT.

RETRY
Maximal drei Korrekturversuche pro Fehlerursache. Wiederhole keine nachweislich
fehlgeschlagene Strategie unverändert.

PFLICHTPRÜFUNGEN
npm run integrity:verify
npm test
npm run test:coverage
npx tsc --noEmit
npm run build
+ Browser-/Preview-Test, falls betroffen

ABSCHLUSS
Berichte Branch, Commit, Dateien, Tests, Browserprüfung, Repair-Loops,
Risiken und offene Punkte.

Führe nach dem Commit und vor Push/PR npm run integrity:finish aus.
Bei ABORT erzeuge mit npm run integrity:abort einen read-only JSON-Nachweis.

Am Schluss musst du die fertigen Änderungen mit einer Commit-Nachricht mit
Jira-Key committen und ausschließlich den Aufgaben-Branch auf GitHub pushen.
Nicht direkt auf main pushen und keinen Merge durchführen.
```

---

# Teil II – Loop Engineering für die spätere KI-Funktion der App

## 9. Zielbild

Der geplante KI-Chat der Studien-Lernplan-App soll nicht bei jeder Nachricht den gesamten Datenbestand und kompletten Chatverlauf an ein Modell senden. Das wäre teuer, langsam und sicherheitstechnisch unnötig.

Stattdessen soll ein kontrollierter Agent nur die Daten laden, die für die aktuelle Aufgabe erforderlich sind.

```text
React Chat UI
   ↓
Server Agent Endpoint
   ↓
Intent + Policy
   ↓
Context Router
   ├─ strukturierte App-Daten
   ├─ pgvector/RAG
   └─ kurzzeitiger Run State
   ↓
Planner
   ↓
Tool Registry
   ↓
Evaluator
   ├─ PASS
   ├─ RETRY
   ├─ CONFIRM
   └─ ABORT
   ↓
Supabase + Audit Log
```

---

## 10. Kontext statt riesigem Kontextfenster

Der Agent sollte Kontext in Ebenen laden:

### Ebene 1 – Systemregeln

Kleine, stabile Regeln:

- Rolle
- Sicherheitsregeln
- Toolregeln
- Antwortschema
- Budget

### Ebene 2 – aktueller Run State

Nur Informationen der aktuellen Aufgabe:

- aktuelles Ziel
- letzte Tool-Ergebnisse
- offene Entscheidung
- Iterationsnummer

### Ebene 3 – strukturierte App-Daten

Nur per Tool laden:

- aktuelles Semester
- relevante Fächer
- relevante Aufgaben
- konkrete Prüfung
- konkrete Deadline
- konkrete Projekte

### Ebene 4 – semantisches Retrieval

pgvector nur verwenden, wenn semantische Suche tatsächlich hilft, z. B. für:

- Lernnotizen
- Dokumente
- frühere Zusammenfassungen
- größere Wissenssammlungen
- natürlichsprachliche Erinnerungen

**Nicht** für relationale Fakten verwenden, die direkt per SQL/Tool abgerufen werden können.

---

## 11. Supabase + pgvector

Empfehlung:

```text
Postgres relationale Tabellen
  → Quelle für exakte App-Daten

pgvector
  → semantischer Index für Textwissen

RLS
  → erzwingt User-Isolation
```

Jeder Retrieval-Datensatz muss mindestens besitzen:

```text
id
user_id
source_type
source_id
content
embedding
metadata
embedding_version
created_at
updated_at
```

Retrieval muss **vor** der Ähnlichkeitssuche auf `user_id` beziehungsweise serverseitige Ownership eingeschränkt werden.

Empfohlener Flow:

```text
Query
 ↓
Intent erkennen
 ↓
Metadata/User Scope setzen
 ↓
Vector Search Top-K
 ↓
Similarity Threshold
 ↓
Deduplicate
 ↓
maximales Kontextbudget anwenden
 ↓
LLM
```

---

## 12. Tool-Architektur

Das Modell darf Daten nicht direkt verändern. Es darf nur typisierte Tools anfordern.

Beispiele:

```text
get_current_semester()
list_subjects(semester_id)
create_subject(...)
create_task(...)
update_task(...)
create_exam(...)
get_learning_plan(...)
record_study_time(...)
search_user_knowledge(...)
```

Jedes Write-Tool braucht:

- Schema-Validierung
- Ownership-Prüfung
- Idempotency Key
- Audit Log
- eindeutiges Resultat
- Fehlerklasse
- optional Confirmation Gate

---

## 13. Risiko-Klassen für KI-Aktionen

### LOW

Nur lesen oder Vorschlag erzeugen.

Beispiele:
- „Welche Prüfungen stehen an?“
- „Fasse meine Woche zusammen.“

Kann automatisch ausgeführt werden.

### MEDIUM

Reversible Änderungen.

Beispiele:
- Aufgabe erstellen
- Lernplan-Eintrag erzeugen
- Fachbeschreibung ändern

Kann je nach Einstellung automatisch oder nach kurzer Bestätigung erfolgen.

### HIGH

Destruktive, schwer reversible oder sicherheitsrelevante Änderung.

Beispiele:
- viele Datensätze löschen
- Semester-Migration
- Kontodaten ändern
- RLS-/Auth-relevante Aktion

Immer menschliche Bestätigung beziehungsweise gar nicht über den normalen Chat-Agenten erlauben.

---

## 14. Laufzeit-Loop des App-Agenten

Empfohlener Zustand:

```text
run_id
user_id
goal
status
iteration
max_iterations
tool_calls
max_tool_calls
input_tokens
output_tokens
cost_budget
last_progress_hash
risk_level
created_at
finished_at
```

Pseudocode:

```text
while not done:
    enforceBudget()
    loadMinimalContext()
    decision = model.plan()

    if decision.final:
        result = evaluator.check(decision)
        if result == PASS:
            return decision
        if result == RETRY:
            continue
        stopSafely()

    if decision.tool_call:
        policy.check(decision.tool_call)
        result = tool.execute()
        audit(result)
        evaluator.checkToolResult(result)

    detectStagnation()
    iteration += 1
```

---

## 15. Budgets und Endlosschleifen verhindern

Jeder Run braucht harte Obergrenzen.

Startwerte für die erste Implementierung können konservativ gewählt und später über Evals angepasst werden:

```text
max_iterations: 6
max_tool_calls: 10
max_repairs_per_error: 3
context_budget: explizit begrenzen
cost_budget: pro Run definieren
```

Stoppen bei:

- Budget überschritten
- gleiche Tool-Anfrage mehrfach ohne neue Evidenz
- gleiche Fehlermeldung nach mehreren Repairs
- kein neuer Informationsgewinn
- User-Bestätigung erforderlich
- Security Policy blockiert Aktion

---

## 16. Multimodale Eingaben

Beispiel: Nutzer lädt einen Stundenplan-Screenshot hoch.

Loop:

```text
Bild
 ↓
Extraktion
 ↓
Strukturiertes Schema
 ↓
Validator
 ↓
Duplikatprüfung gegen vorhandene Fächer
 ↓
Preview der geplanten Änderungen
 ↓
Bestätigung
 ↓
Write Tools
 ↓
Read-back
 ↓
Evaluator
```

Wichtig: Das Modell darf extrahierte Daten nicht sofort ungeprüft in die Datenbank schreiben.

---

## 17. Evaluator für App-Aktionen

Minimaler Evaluator:

```json
{
  "decision": "PASS | RETRY | ASK_USER | ABORT",
  "score": 0,
  "failed_criteria": [],
  "feedback": "",
  "evidence": []
}
```

Kriterien:

- intent_match
- correct_user_scope
- schema_valid
- no_duplicate
- security_policy
- requested_change_only
- readback_matches
- reversible_or_confirmed

Bei Writes gilt `PASS` erst nach Read-back beziehungsweise überprüfbarem Tool-Ergebnis.

---

## 18. Audit Logging

Für jeden Agenten-Run sollten mindestens protokolliert werden:

```text
run_id
user_id
prompt_version
policy_version
model
tool_name
tool_input_hash
tool_result_summary
evaluator_decision
iteration
cost/tokens
error_code
created_at
```

Keine Secrets oder unnötigen vollständigen Nutzerdaten in Logs speichern.

---

## 19. Teststrategie für die KI-Integration

### Unit Tests

- Policy Engine
- Tool-Schemas
- Budget Counter
- Stop Conditions
- Stagnation Detection
- Scope Filter

### Contract Tests

- Tool Input → erwarteter DB-Aufruf
- DB-Antwort → typisiertes Tool Result
- Fehler → definierte Fehlerklasse

### Golden Evals

Feste Eingaben mit erwarteten Ergebnissen, z. B.:

```text
„Erstelle morgen Mathe lernen um 17 Uhr.“
→ genau eine passende Aufgabe, keine zusätzlichen Änderungen
```

### Negative Evals

- Prompt Injection
- fremde `user_id`
- Löschaufforderung ohne Bestätigung
- widersprüchliche Screenshots
- doppeltes Fach
- nicht existierende Semester-ID
- absichtlich fehlerhaftes Tool Result

### Browser-E2E

Später KAN-72-Testkonto verwenden und komplette reale User Flows prüfen.

---

## 20. Kostenoptimierung

Prioritäten:

1. relationale Fakten per Tool statt LLM-Kontext laden
2. Retrieval nur bei Bedarf
3. Top-K und Kontextbudget begrenzen
4. Chatverlauf zusammenfassen statt unbegrenzt mitsenden
5. Tool Results kürzen und strukturieren
6. keine unveränderten großen Datenobjekte in jede Iteration kopieren
7. kleine Modelle für Klassifikation/Evaluation prüfen, wenn Qualität ausreichend
8. Ergebnisse cachen, wenn sicher und eindeutig invalidierbar
9. Loop nur bei nachweisbarer Verbesserung fortsetzen

---

## 21. Observability

Metriken:

```text
runs_total
runs_passed
runs_aborted
runs_requiring_user
avg_iterations
p95_iterations
avg_tool_calls
retry_rate
stagnation_rate
cost_per_run
retrieval_hit_rate
write_failure_rate
incorrect_write_rate
eval_pass_rate
```

Besonders wichtig ist nicht nur die Erfolgsquote, sondern die Rate **falscher Writes**. Ein Agent, der selten schreibt, aber zuverlässig, ist für die erste Version besser als ein aggressiver Agent mit höherer Fehlerrate.

---

## 22. Rollout

### Stufe 1 – Read only

- Chat beantwortet Fragen über vorhandene Daten.
- keine Schreibtools.

### Stufe 2 – Draft/Preview

- Agent schlägt Änderungen vor.
- Nutzer bestätigt.

### Stufe 3 – reversible Writes

- kleine Änderungen über typisierte Tools.
- Audit + Read-back.

### Stufe 4 – ausgewählte Automatisierung

- nur nach erfolgreichen Evals und mit klaren Grenzen.

Sicherheitskritische oder destruktive Aktionen bleiben bestätigt oder vollständig außerhalb des Agenten.

---

## 23. Repository-Regeln für neue KI-Komponenten

Neue AI-/Agentenlogik soll nicht weiter in `src/App.jsx` wachsen.

Bevorzugte Trennung:

```text
src/features/ai/
src/domain/ai/
src/infrastructure/ai/
```

Serverseitige Provider-Calls und Secrets dürfen nicht in clientseitigem React-Code landen.

Wenn Supabase Edge Functions oder ein anderer Server-Layer verwendet wird, soll die Zuständigkeit klar getrennt sein:

```text
Frontend
  → UI + Benutzerinteraktion
Server/Edge
  → Provider Call + Policy + Orchestrierung
Supabase
  → Daten + RLS + Retrieval + Audit
```

---

## 24. Review-Checkliste für Agentenänderungen

```text
[ ] Jira-Scope eingehalten
[ ] AGENTS.md beachtet
[ ] Loop-Regeln eingehalten
[ ] keine unerlaubte direkte main-Änderung
[ ] relevante Tests vorhanden
[ ] Pflichtprüfungen ausgeführt
[ ] Retry-Anzahl dokumentiert
[ ] Stop-Regeln nicht umgangen
[ ] Auth/RLS/Data-Risiken geprüft
[ ] kein Secret im Diff
[ ] Browserprüfung durchgeführt, falls erforderlich
[ ] Dokumentation aktualisiert
[ ] finaler Diff geprüft
[ ] Branch und Commit eindeutig
[ ] PR/Review vor Merge
[ ] Jira erst nach bestätigtem Merge Erledigt
```

---

## 25. Abschlusskriterium für Loop Engineering

Loop Engineering ist in diesem Projekt nicht „fertig“, nur weil dieses Dokument existiert.

Die erste organisatorische Stufe gilt als umgesetzt, wenn:

- `AGENTS.md` im Repository vorhanden und mit DoD/Loop Engineering verknüpft ist,
- Copilot-Instructions darauf verweisen,
- KAN-73 die kontrollierten Loop-Regeln technisch oder prozessual verwendet,
- KAN-72 einen isolierten Browser-Testweg bereitstellt,
- ein kleines Test-Ticket den kompletten Ablauf erfolgreich durchlaufen hat,
- GitHub Review/PR/Merge und Jira-Abschluss nachweislich zusammenpassen.

Die spätere produktive App-KI benötigt zusätzlich:

- serverseitige Agentenorchestrierung,
- typisierte Tools,
- Policy Layer,
- Supabase/RLS-konforme Datenzugriffe,
- pgvector nur für passende semantische Daten,
- Audit Logs,
- Evals,
- Kosten-/Turn-Budgets,
- Stagnation Detection,
- sichere Confirmation Gates.

---

## 26. Verweise

- Jira KAN-30 – Entwicklungs- und Jira-Workflow dokumentieren
- Jira KAN-72 – Isolierten Testnutzer und Browser-End-to-End-Tests einführen
- Jira KAN-73 – Kontrollierten Entwicklungs-Loop für Codex einführen
- Jira KAN-74 – AGENTS.md erstellen und mit Definition of Done verknüpfen
- Confluence: `Arbeitsprozess und Definition of Done`
- Repository: `AGENTS.md`
- Repository: `.github/copilot-instructions.md`
- Repository: `README.md`

Wenn Regeln voneinander abweichen, wird nicht stillschweigend eine Variante gewählt. Die Abweichung muss geklärt und anschließend an der dauerhaften Quelle korrigiert werden.
