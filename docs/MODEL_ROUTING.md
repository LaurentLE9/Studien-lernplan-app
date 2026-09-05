# Verbindliche Modell-Routing-Regel

Diese Policy gilt für Entwicklungs-Agenten im normalen Entwicklungsworkflow. `AGENTS.md` ist das Agent Operating System und legt fest, **wann** diese Policy geladen wird. Diese Datei beschreibt **wie** Routing entschieden wird.

Wichtig: Es existieren zwei strikt getrennte Betriebsmodi. Die Provider-Verallgemeinerung in KAN-161 betrifft **nur den manuellen Übergangsmodus**. Der n8n-Runtime-Router bleibt vollautomatisch und wird durch diese Änderung nicht in einen manuellen Workflow umgebaut.

## 1. Betriebsmodi

### `TEMPORARY_MANUAL_MODEL_ROUTING`

Providerunabhängige Übergangslösung für direkte Entwicklungsclients wie Codex, Claude Code oder weitere Agenten, solange n8n den direkten Entwicklungsworkflow noch nicht vollständig automatisch routet.

Der Benutzer kann bei Bedarf manuell auf ein stärkeres Modell umschalten. Der Agent darf keine automatische Umschaltung vortäuschen.

Historischer Kompatibilitätsname: `TEMPORARY_MANUAL_CODEX_ROUTING`. Neue Regeln und neue Dokumentation verwenden ausschließlich `TEMPORARY_MANUAL_MODEL_ROUTING`.

### `AUTOMATED_N8N_ROUTING`

Dauerhaftes Zielsystem für KAN-110/KAN-127/KAN-147. n8n entscheidet intern und automatisch über Route, Provider und Modell. Reiner Modellbedarf erzeugt keine Benutzer-Modellwahl und keinen manuellen Wechselhinweis.

Die beiden Modi dürfen nicht vermischt werden.

---

## 2. Providerneutrale Begriffe des manuellen Modus

### `requiredCapability`

Die für den nächsten Implementierungsblock erforderliche Mindest-Fähigkeitsstufe.

Werte:

- `low`
- `medium`
- `high`

`requiredCapability` wird ausschließlich aus **Scope, Risiko, Komplexität und Unsicherheit** bestimmt. Die Entscheidung kennt zunächst weder Provider noch konkreten Modellnamen.

### Laufzeit-Metadaten

Optional und nur verwenden, wenn zuverlässig bekannt:

- `activeCapability`: `low|medium|high|unknown`
- `activeProvider`: z. B. `openai|anthropic|unknown`
- `activeModel`: konkreter Modellname oder `unknown`

Ein Agent darf Provider, Modell oder Capability niemals raten oder erfinden.

### `routingAction`

Mögliche Zustände des manuellen Gates:

- `CONTINUE`
- `MODEL_SWITCH_REQUIRED`
- `ACTIVE_CAPABILITY_UNKNOWN`

Diese Zustände gehören ausschließlich zum manuellen Übergangsmodus.

---

## 3. Capability-Klassifikation

### LOW

Typische Fälle:

- Jira-/GitHub-/Confluence-Kontext zusammenfassen,
- Scope und relevante Dateien bestimmen,
- einfache Repository-Recherche,
- eine klar abgegrenzte risikoarme Änderung,
- einfache Test-/Log-Auswertung,
- Dokumentations-/Statusaufgaben,
- klar strukturierte Klassifizierung.

### MEDIUM

Typische Fälle:

- mehrere zusammenhängende Dateien,
- Integrationslogik zwischen überschaubaren Systemen/Verträgen,
- mittleres Refactoring,
- nichttriviale Fehleranalyse,
- komplexere Testauswertung,
- fachliche Logik mit mehreren Randfällen,
- erhöhte Unsicherheit oder erster fehlgeschlagener Reparaturversuch.

### HIGH

Typische Fälle:

- Architektur- und Modulgrenzen,
- große oder stark gekoppelte Refactorings,
- schwierige oder wiederholt nicht gelöste Bugs,
- Authentifizierung, Sessions, RLS, Secrets, Berechtigungen und Security,
- Datenbankmigrationen oder Datenverlustrisiko,
- komplexe Repository-Änderungen mit vielen Abhängigkeiten,
- Fälle, in denen die mittlere Stufe nachweislich nicht ausreicht.

Die Capability wird neu bewertet, wenn Scope, Dateianzahl, Abhängigkeiten, Komplexität, Risiko oder Unsicherheit deutlich steigen.

---

## 4. Zentrales Provider-Mapping

Die providergebundene Übersetzung steht ausschließlich in:

- `config/manual-model-routing.json`

Die Kernlogik kennt nur `low|medium|high`. Konkrete Modelle werden erst danach aufgelöst.

### OpenAI / Codex

Rückwärtskompatibles Mapping:

| Capability | Modell |
| --- | --- |
| LOW | GPT-5.6 Luna |
| MEDIUM | GPT-5.6 Terra |
| HIGH | GPT-5.6 Sol |

Provider-Alias: `codex`.

### Anthropic / Claude Code

Aktuelles Mapping auf Basis der offiziellen Anthropic-Modellliste vom 05.09.2026:

| Capability | Modell | API-/Modell-ID |
| --- | --- | --- |
| LOW | Claude Haiku 4.5 | `claude-haiku-4-5-20251001` |
| MEDIUM | Claude Sonnet 5 | `claude-sonnet-5` |
| HIGH | Claude Opus 5 | `claude-opus-5` |

Provider-Aliase: `claude`, `claude-code`.

Begründung der Zuordnung:

- Haiku 4.5 ist die schnelle/leichte Claude-Stufe und eignet sich für klar abgegrenzte, kostensensitive Arbeit.
- Sonnet 5 ist Anthrops aktuelle starke Workhorse-/Agenten- und Coding-Stufe und damit die Standardstufe für mittlere Entwicklungsaufgaben.
- Opus 5 ist die stärkste reguläre Opus-Stufe für komplexe Coding-, Agenten- und Reasoning-Aufgaben.

Neue Anthropic-Generationen werden durch Aktualisierung dieses Mappings aufgenommen; `AGENTS.md` und die Capability-Logik werden dafür nicht umgebaut.

Weitere Provider werden genauso ergänzt.

---

## 5. Manuelles Pre-Write-Gate

Read-only-Arbeit ist vor dem Gate erlaubt: Jira-/GitHub-/Confluence-Kontext lesen, `git status`/Diff prüfen, Scope bestimmen und gezielt Dateien inspizieren.

**Vor dem ersten Edit/Patch/Write eines relevanten Implementierungsblocks muss das Gate abgeschlossen sein.**

Neutrale Verwendung:

```bash
npm run model:gate -- --files <anzahl> --complexity <low|medium|high> [Signale]
```

Mit bekanntem Provider und aktiver Capability:

```bash
npm run model:gate -- \
  --provider <openai|anthropic|weiterer-provider> \
  --active-capability <low|medium|high|unknown> \
  --files <anzahl> \
  --complexity <low|medium|high> \
  [Signale]
```

Mit bekanntem konkreten Modell:

```bash
npm run model:gate -- \
  --provider <provider> \
  --active-model <modell-id-oder-name> \
  --files <anzahl> \
  --complexity <low|medium|high>
```

Das Modell wird nur dann in eine Capability übersetzt, wenn das zentrale Mapping eindeutig passt.

### Rückwärtskompatibilität

Alte OpenAI-/Codex-Aufrufe bleiben vorerst gültig:

- `--active luna|terra|sol`
- `--current luna|terra|sol`
- `--terra-insufficient`
- `scripts/codex-prewrite-model-gate.mjs`

Neue Aufrufe verwenden:

- `--provider`
- `--active-capability`
- `--active-model`
- `--medium-insufficient`
- `scripts/manual-prewrite-model-gate.mjs`

### Signale

Insbesondere:

- `--integration`
- `--refactor`
- `--uncertainty`
- `--strong-coupling`
- `--difficult-bug`
- `--medium-insufficient`
- `--architecture`
- `--security`
- `--auth`
- `--rls`
- `--secrets`
- `--migration`
- `--data-loss`

---

## 6. Gate-Verhalten

### Fall A – aktive Capability bekannt und ausreichend

```text
routingAction=CONTINUE
requiredCapability=<low|medium|high>
activeCapability=<low|medium|high>
```

Der Implementierungsblock darf ausgeführt werden.

### Fall B – aktive Capability bekannt, aber zu schwach

```text
routingAction=MODEL_SWITCH_REQUIRED
requiredCapability=<medium|high>
activeCapability=<low|medium>
```

Der Agent stoppt vor dem Write.

Wenn ein konkretes Zielmodell für den Provider konfiguriert ist, lautet der Hinweis ausschließlich:

```text
Jetzt brauchen wir <Modellname>.
```

Beispiele:

```text
Jetzt brauchen wir Terra.
Jetzt brauchen wir Sol.
Jetzt brauchen wir Claude Sonnet 5.
Jetzt brauchen wir Claude Opus 5.
```

Wenn kein konkretes Zielmodell konfiguriert ist, lautet der Hinweis ausschließlich:

```text
Jetzt brauchen wir ein Modell der Stufe MEDIUM.
```

oder

```text
Jetzt brauchen wir ein Modell der Stufe HIGH.
```

Kein Modellname darf erfunden werden.

### Fall C – aktive Capability nicht zuverlässig bekannt

```text
routingAction=ACTIVE_CAPABILITY_UNKNOWN
requiredCapability=<low|medium|high>
activeCapability=unknown
```

Read-only-Planung darf fortgesetzt werden. Für `requiredCapability=medium|high` bleibt der Write blockiert, bis die passende Capability im direkten Client zuverlässig gewählt/angegeben wurde.

Für `requiredCapability=low` darf der risikoarme Block fortgesetzt werden, sofern keine Safety-/Stop-Regel greift.

---

## 7. Automated n8n Routing bleibt unverändert getrennt

KAN-161 generalisiert **nicht** den manuellen Mechanismus in n8n hinein.

Für `AUTOMATED_N8N_ROUTING` gilt weiterhin:

- n8n bewertet Scope, Risiko, Komplexität, Confidence und Budget intern,
- n8n wählt Route, Provider und Modell automatisch,
- deterministische Aufgaben bleiben ohne unnötigen LLM-Aufruf,
- Modellbedarf erzeugt weder `MODEL_SWITCH_REQUIRED` noch Benutzerhinweis noch `ASK_USER`,
- `ASK_USER` bleibt echten fachlichen Entscheidungen oder menschlichen Freigaben vorbehalten,
- `/controlled-execute` und `ops/n8n/model-router.mjs` gehören ausschließlich zum automatisierten Modus.

Die neutrale Capability-Klassifikation darf als gemeinsame semantische Grundlage dienen, aber das automatische n8n-System entscheidet weiterhin selbst über konkrete Ausführung und Provider.

---

## 8. Abschaltbedingung des manuellen Modus

`TEMPORARY_MANUAL_MODEL_ROUTING` wird deaktiviert, sobald der produktive n8n-Router für den direkten Entwicklungsworkflow nachweislich:

1. Scope, Risiko, Komplexität und Unsicherheit bewertet,
2. erforderliche Route/Fähigkeitsklasse zuverlässig bestimmt,
3. den ausführenden Modell-/Providerpfad automatisch auswählt,
4. Qualitäts-, Sicherheits- und Stop-Gates einhält,
5. und als verbindlicher Standard für diesen Workflow freigegeben wurde.

Ab dann darf der direkte Workflow wegen reinen Modellbedarfs keine manuelle Modellwahl mehr verlangen.

---

## 9. Technische Grenze und DoD

`scripts/manual-prewrite-model-gate.mjs` ist der deterministische Pre-Write-Guard für den manuellen Übergangsmodus. `scripts/codex-prewrite-model-gate.mjs` bleibt lediglich als Legacy-Wrapper bestehen.

Der Guard ersetzt keine Sandbox und kann einen Agenten, der Regeln absichtlich umgeht, nicht auf Betriebssystemebene am Schreiben hindern.

Vor `technisch reviewbereit` muss bei relevantem Modellrouting dokumentiert sein:

- [ ] Routing-Modus eindeutig bestimmt.
- [ ] Manueller und automatisierter Modus nicht vermischt.
- [ ] `requiredCapability` unabhängig vom aktiven Provider/Modell bestimmt.
- [ ] Provider-/Modell-Metadaten nur verwendet, wenn zuverlässig bekannt.
- [ ] Kein Modellname geraten oder erfunden.
- [ ] Manueller Pre-Write-Guard vor relevanten Writes ausgeführt.
- [ ] Bei notwendigem Wechsel vor dem Write gestoppt.
- [ ] Provider-Mapping korrekt angewendet.
- [ ] n8n hat im automatisierten Modus keine Benutzer-Modellwahl verlangt.
- [ ] Nutzerlimit-/Kostenoptimierung hat Qualität und Sicherheit nicht reduziert.
