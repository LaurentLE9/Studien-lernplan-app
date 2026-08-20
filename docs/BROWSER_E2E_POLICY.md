# Browser-/E2E-Testpolicy

Bezug: KAN-109, KAN-72 und GitHub Issue #39.

## Zweck

Der Browser-Test ist ein verbindlicher Regressionstest der Kernfunktionen. Ein erfolgreicher Build oder ein DOM-Smoke-Test reicht bei sichtbaren/interaktiven Änderungen nicht aus.

## Testkonto ohne Rückfrage

Der dafür vorgesehene isolierte Test-Account ist für Browser-, E2E-, Smoke-, Regression- und Funktionsprüfungen vorab freigegeben. Wenn ein solcher Test für Implementierung, Fehleranalyse oder Definition of Done erforderlich ist, wird er selbstständig ausgeführt. Es wird nicht gefragt, ob der Test gestartet, das Testkonto verwendet oder eindeutig markierte Testdaten erstellt bzw. wieder gelöscht werden dürfen.

Diese Freigabe gilt ausschließlich für den isolierten Test-Account und für Daten mit eindeutigem E2E-Präfix. Sie gilt nicht für echte Benutzerkonten oder fremde Produktivdaten. Zugangsdaten werden ausschließlich über Secrets/Umgebungsvariablen bereitgestellt und niemals committed, geloggt oder in Jira/Confluence dokumentiert.

## Pflichtablauf

Der Kernregressionstest muss mindestens prüfen:

1. Login mit Testkonto.
2. Dashboard lädt ohne ungefangene Browserfehler.
3. Zwei Semester anlegen.
4. Semester A → B → A wechseln und Datentrennung prüfen.
5. Fach anlegen und dem aktiven Semester zuordnen.
6. Aufgabe anlegen und dem Fach/Semester zuordnen.
7. Projekt und Unteraufgabe anlegen.
8. Timer direkt aus der Aufgabe starten.
9. Laufenden Timer auf Dashboard, Aufgaben, Projekte, Statistik, Lernplan, Fächer und Semesterkonfiguration prüfen.
10. Reload bei laufendem Timer prüfen.
11. Timer pausieren, fortsetzen und beenden.
12. Globalen Timer starten, pausieren, fortsetzen und beenden.
13. Lernzeit/Statistik auf plausible Werte, `NaN`/`undefined` und Semestertrennung prüfen.
14. Persistenz nach Reload prüfen.
15. `console.error`, ungefangene Exceptions und unerwartete HTTP-5xx erfassen.
16. Testdaten nach Erfolg oder Fehler bereinigen.

Die Testdaten verwenden das Präfix `E2E-<Run-ID>-...`, damit parallele Läufe eindeutig getrennt und nur eigene Daten gelöscht werden.

## Automatische Testauswahl

Agenten leiten aus dem Diff selbst ab, welche Browser-Szenarien erforderlich sind. Der Benutzer muss nicht auswählen, welcher Test laufen soll.

- Timer-Änderung: Start, Pause, Fortsetzen, Beenden, Aufgaben-/Fachbezug, Seitenwechsel, Dashboard, Reload, Statistik.
- Semester-Änderung: mindestens A → B → A, Datentrennung, Fach/Aufgabe/Projekt/Statistik und Persistenz.
- Aufgaben-Änderung: Erstellen/Bearbeiten soweit betroffen, Semester/Fach, Timer aus Aufgabe, Persistenz.
- Projekt-Änderung: Projekt, Subtask, Fortschritt/Zuordnung, Persistenz.
- Statistik-Änderung: echte Testsession erzeugen und angezeigte Daten gegen die erzeugten Daten prüfen.
- Navigation/Dashboard: laufenden Timer sowie zentrale Widgets/Verknüpfungen seitenübergreifend prüfen.

## CI-Ausführung

`.github/workflows/e2e-regression.yml` baut den aktuellen Branch, startet dessen Produktions-Build lokal und führt Playwright dagegen aus. Damit wird nicht erst ein bereits gemergter Stand getestet.

Benötigte GitHub Actions Secrets:

- `E2E_SUPABASE_URL`
- `E2E_SUPABASE_ANON_KEY`
- `E2E_TEST_EMAIL`
- `E2E_TEST_PASSWORD`

Fehlende Secrets führen zu einem fehlgeschlagenen Workflow. Der E2E-Test darf nicht still übersprungen werden.

Playwright wird im CI-Lauf temporär installiert, damit für KAN-109 kein unnötiges Paket-/Lockfile-Upgrade erzwungen wird.

## Fehlernachweise

Bei Fehlschlag werden soweit verfügbar Trace, Screenshot, Video, Playwright-Report und Preview-Log als Workflow-Artefakte gespeichert. Ein echter Produktfehler wird nicht durch schwächere Assertions oder Skip-Regeln umgangen.

## Definition of Done

Für Änderungen an Kernfunktionen ist `Done` erst zulässig, wenn:

- Unit-/Integrationstests erfolgreich sind,
- Coverage/Typecheck/Build gemäß Repository-Regeln erfolgreich sind,
- der relevante Browser-/E2E-Test tatsächlich erfolgreich gelaufen ist,
- Browserfehler ausgewertet sind,
- Testdaten bereinigt sind,
- gefundene Regressionen behoben oder als blockierende offene Befunde dokumentiert sind,
- Jira, GitHub und Confluence den tatsächlichen Stand widerspruchsfrei wiedergeben.

Ein nicht ausgeführter Browser-Test ist kein PASS. Ein fehlendes Testkonto-/Secret ist ein Blocker und kein Grund, die Prüfung zu überspringen.
