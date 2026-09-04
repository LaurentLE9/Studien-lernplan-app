# Router: Frontend

Nutzen bei React-, UI-, Dashboard-, Seiten-, Komponenten-, Styling- und Interaktionsänderungen.

## Primär laden

- betroffene Feature-/Page-/UI-Datei
- direkte Aufrufer und relevante Selektoren/Hooks
- kleinster passender Unit-/Regressionstest

## Große Dateien

`src/App.jsx` nicht vollständig laden, außer der Ticket-Scope ist dateiweit. Zuerst Symbole, relevante Zeilenbereiche und direkte Imports/Aufrufer verwenden.

## Browser

Bei sichtbarem oder interaktivem Verhalten zusätzlich `docs/BROWSER_E2E_POLICY.md` und nur die betroffenen Kernabläufe laden. Der vollständige Kern-Regressionslauf bleibt für den finalen Kandidaten gemäß `AGENTS.md` verbindlich, wenn er durch den Scope ausgelöst wird.
