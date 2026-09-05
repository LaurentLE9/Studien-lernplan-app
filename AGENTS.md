# AGENTS.md — Agent Operating System

Diese Datei ist die verbindliche **Kernel-Regelbasis** für Codex, Claude und andere Entwicklungs-Agenten in `LaurentLE9/Studien-lernplan-app`.

Sie enthält nur Regeln, die für fast jede Entwicklungsaufgabe gelten. Wiederkehrende Verfahren liegen in `.agents/skills/`; fachliche Details in Routern/Policies. Diese Ebenen werden nur bei passendem Scope geladen.

## 1. Sources of Truth

Reihenfolge für Entwicklungsarbeit:

1. **Jira** – Scope, Status, Sprint, Priorität, Akzeptanzkriterien, Abhängigkeiten.
2. **`AGENTS.md`** – verbindlicher Agent-OS-Kernel.
3. **`docs/agent-context/README.md`** – Progressive Context Router.
4. **Passende `.agents/skills/*/SKILL.md`** – nur für den aktuellen Workflow.
5. **Passende Domänen-Router/Policies** – nur für den aktuellen fachlichen Scope.
6. **Confluence-Projekt-Hub** – dauerhafte Prozess-, Architektur- und Wissensdokumentation.
7. **Repository-Code und Tests** – technische Ist-Quelle.

Die vollständige Definition of Done liegt im Confluence-Projekt-Hub auf **„Arbeitsprozess und Definition of Done“**.

## 2. Boot Sequence

Vor jeder nicht-trivialen Entwicklungsaufgabe:

1. aktiven Jira-Vorgang vollständig lesen,
2. `AGENTS.md` lesen,
3. Branch, HEAD, Remote und Working Tree prüfen,
4. `docs/agent-context/README.md` laden,
5. Scope, Nicht-Ziele, Risiken und betroffene Domänen bestimmen,
6. anhand von `name`/`description` nur passende Skills auswählen,
7. nur benötigte Skill-Bodies, Router, Policies, Dateien und Tests nachladen,
8. `requiredCapability=low|medium|high` bestimmen,
9. `PLAN → IMPLEMENT → VERIFY → EVALUATE` ausführen.

Vollscans von Repository, Jira oder Confluence sind nur bei konkreter Notwendigkeit zulässig; Grund im Abschlussnachweis nennen.

## 3. Progressive Context & Skills

Zentraler Router: `docs/agent-context/README.md`.

Skill-Konvention: `.agents/skills/README.md`.

Kanonische Workflow-Skills:

- `task-bootstrap` – Jira-Arbeit starten/fortsetzen,
- `repository-analysis` – gezielte Read-only-Analyse,
- `ticket-implementation` – bestätigten Scope umsetzen,
- `change-verification` – Prüfungen und Evaluation,
- `handover-completion` – Review-Readiness/Handover/Post-Merge,
- `n8n-delegation` – n8n-Delegation/Ergebnisvalidierung.

Regeln:

- nicht alle Skill-Bodies vorladen; Discovery-Metadaten genügen bis zur Auswahl,
- Skills dürfen Jira, Kernel, Safety-/Verification-/Publishing-Gates oder DoD nicht überschreiben,
- große unveränderte Dateien nur ausschnittsweise laden, wenn Suche/Symbole/Diff genügen,
- fehlenden Kontext gezielt nachladen statt raten,
- für Code Review keinen zweiten allgemeinen Skill anlegen; **KAN-83** bleibt die projektspezifische Review-Skill-Quelle,
- `.claude/skills/` enthält nur Adapter auf die kanonischen `.agents/skills/` und keine abweichende Workflow-Logik.

## 4. Model Routing

Detailregeln: `docs/MODEL_ROUTING.md`. Provider-Mapping: `config/manual-model-routing.json`.

Es gibt zwei strikt getrennte Modi:

### `TEMPORARY_MANUAL_MODEL_ROUTING`

- reine Übergangslösung bis zum produktiven automatischen n8n-Routing,
- `requiredCapability` ausschließlich aus Scope, Risiko, Komplexität und Unsicherheit bestimmen,
- zuerst Capability bestimmen, erst danach über das zentrale Mapping einen Provider/Modellnamen auflösen,
- aktiven Provider, Modellnamen oder Capability niemals raten; unbekannte Laufzeit-Metadaten bleiben `unknown`,
- wenn die zuverlässig bekannte aktive Capability zu schwach ist: vor dem nächsten Write stoppen und den in `docs/MODEL_ROUTING.md` definierten Wechselhinweis verwenden,
- nach einem Wechsel gültigen Kontext wiederverwenden; kein unnötiger Vollscan.

### `AUTOMATED_N8N_ROUTING`

- dauerhaftes Zielsystem,
- n8n bestimmt Route, Provider und Modell automatisch,
- keine manuelle Modellwahl und kein Modellwechsel-Hinweis an den Benutzer,
- nicht mit dem manuellen Übergangsmodus vermischen.

Sobald die in `docs/MODEL_ROUTING.md` dokumentierte Abschaltbedingung erfüllt ist, wird der manuelle Übergangsmodus deaktiviert.

## 5. Execution Loop

Für nicht-triviale Änderungen gilt:

```text
PLAN → IMPLEMENT → VERIFY → EVALUATE
                         ├─ PASS → PUBLISH/REVIEW
                         ├─ RETRY → REPAIR → VERIFY
                         ├─ ASK_USER → menschliche Entscheidung/Freigabe
                         └─ ABORT → sicher stoppen und dokumentieren
```

Detailprozess: `docs/LOOP_ENGINEERING.md`.

- vor nicht-trivialer Implementierung `npm run integrity:start`,
- kleinste sinnvolle ticketbezogene Änderung umsetzen,
- zuerst gezielte, danach alle laut Scope/DoD erforderlichen Prüfungen,
- `ASK_USER` nur für echte menschliche Entscheidungen/Freigaben,
- maximal drei Reparaturversuche pro zusammenhängender Fehlerursache; fehlgeschlagene Strategie nicht unverändert wiederholen.

Die Workflow-Details stehen in `ticket-implementation` und `change-verification`.

## 6. Git & Publishing

- niemals direkt auf `main` entwickeln oder pushen,
- Aufgaben-Branch vom aktuellen `main`; Branch-Name enthält Jira-Key,
- fremde/unklare Änderungen niemals überschreiben, löschen, resetten, stashen oder mitcommitten, um ein Gate zu umgehen,
- vor eigenständig bearbeitbarer Repository-Arbeit passendes GitHub Issue sicherstellen, sofern keine dokumentierte Ausnahme gilt,
- Jira ↔ GitHub Issue ↔ Branch ↔ Commit ↔ PR eindeutig verknüpfen,
- PR referenziert das GitHub Issue mit `Refs #<Nummer>`,
- vor Push/PR `npm run integrity:finish`.

Branch-Schema:

- `feature/KAN-XX-kurzer-name`
- `fix/KAN-XX-kurzer-name`
- `refactor/KAN-XX-kurzer-name`
- `test/KAN-XX-kurzer-name`
- `docs/KAN-XX-kurzer-name`

## 7. Safety / Stop Conditions

Sofort stoppen bzw. menschliche Freigabe verlangen bei:

- Auth-/Session-Sicherheitsänderungen,
- Supabase-RLS-/Berechtigungsänderungen,
- destruktiven/riskanten Migrationen oder möglichem Datenverlust,
- Secrets, API-Keys, Tokens oder produktiven Zugangsdaten,
- wesentlich erweitertem Scope,
- untrennbaren fremden Änderungen,
- drei erfolglosen Reparaturversuchen,
- fachlichen Entscheidungen/Freigaben, die nicht sicher aus Jira/DoD/Repository ableitbar sind.

Secrets niemals in Code, Logs, Tests, Commits, Jira, GitHub, Confluence oder Handover aufnehmen.

Bei irregulärer Beendigung `npm run integrity:abort` und Zustandsnachweis im Jira-Vorgang.

## 8. Verification

Verwende `change-verification` plus die zum Scope passenden Policies.

Mindestens gilt:

- erforderliche Tests/Build/Typecheck/Lint/Integrity-Prüfungen tatsächlich ausführen,
- `git diff --check` und finalen Diff prüfen,
- bei sichtbarem/interaktivem Verhalten `docs/BROWSER_E2E_POLICY.md` anwenden,
- Security und Datenintegrität im betroffenen Scope prüfen,
- Tests/Gates niemals abschwächen, überspringen oder löschen, nur damit der Stand grün erscheint,
- Nachweise nur wiederverwenden, wenn relevanter Commit/Arbeitsbaum und Quellen unverändert sind,
- fehlende erforderliche Test-Secrets sind Blocker, kein PASS.

## 9. Completion / Definition of Done

`technisch reviewbereit` ist nicht Jira `Erledigt`.

Verwende `handover-completion` und `docs/agent-context/process-jira.md`.

Vor Review-Readiness müssen Akzeptanzkriterien, Scope, Pflichtprüfungen, Security/Datenintegrität, finaler Diff und Verknüpfungen stimmen.

Jira darf erst nach bestätigtem Merge, erforderlicher Nachprüfung, geklärtem maßgeblichem PR-/Copilot-Review und Confluence-Abgleich auf `Erledigt` gesetzt werden. Danach das GitHub Issue schließen.

## 10. Browser / E2E

Bei UI-, Interaktions-, Timer-, Semester-, Aufgaben-, Projekt-, Statistik-, Dashboard-, Navigations-, Persistenz- oder Synchronisationsänderungen `docs/BROWSER_E2E_POLICY.md` laden.

Der isolierte Test-Account ist für erforderliche Browser-/E2E-/Smoke-/Regressionstests vorab freigegeben. Nicht erneut um Erlaubnis fragen.

## 11. Copilot Fallback

Nur aktiv, wenn der Benutzerauftrag mit `[COPILOT-FALLBACK]` beginnt. Ein erreichtes ChatGPT-/Codex-Nutzerlimit wird nicht automatisch erkannt.

Zentrale Anleitung: Confluence **„KI-Entwicklungsworkflow – Codex- und Copilot-Fallback“**.

## 12. Abschlussnachweis

Kurz dokumentieren:

- Jira-Key und GitHub Issue,
- verwendete Skills, Router und Policies,
- untersuchte Dateien/Bereiche,
- ausgeführte/wiederverwendete Prüfungen,
- Routing-Modus und `requiredCapability`,
- `activeProvider`, `activeModel`, `activeCapability` nur wenn zuverlässig bekannt, sonst `unknown`,
- Vollscan ja/nein und Grund,
- Commit/PR/Review-/Merge-Status,
- offene Risiken/Blocker.

## Verknüpfte Vorgänge

- KAN-30 – Entwicklungs- und Jira-Workflow
- KAN-72 / KAN-109 – isolierte Browser-/E2E-Tests
- KAN-73 / KAN-74 – kontrollierter Loop und AGENTS.md
- KAN-110 / KAN-127 / KAN-147 – n8n- und Modell-Routing
- KAN-157 – Progressive Context Loading
- KAN-158 – wiederverwendbare Agent Skills
- KAN-161 – Agent-OS-/providerneutrales Routing
