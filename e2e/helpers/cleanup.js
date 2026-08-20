import { expect } from '@playwright/test';
import { navigate, switchSemester } from './app.js';

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function prefixedText(page, prefix) {
  return page.getByText(new RegExp(`^${escapeRegExp(prefix)}`));
}

async function discardActiveTimer(page) {
  const stopButton = page.getByRole('button', { name: 'Beenden', exact: true });
  if (!(await stopButton.isVisible().catch(() => false))) return;
  await stopButton.click();
  const dialog = page.getByRole('dialog', { name: 'Timer beenden' });
  await dialog.getByRole('button', { name: 'Verwerfen', exact: true }).click();
  await expect(dialog).toBeHidden();
}

async function deleteStudySessions(page, prefix) {
  await navigate(page, 'Lernzeiterfassung');
  for (let guard = 0; guard < 25; guard += 1) {
    const marker = prefixedText(page, prefix).first();
    if (!(await marker.isVisible().catch(() => false))) return;
    const row = marker.locator('xpath=ancestor::div[.//button][1]');
    const deleteButton = row.locator('button:has(svg.lucide-trash-2)').last();
    await expect(deleteButton).toBeVisible();
    await deleteButton.click();
    await expect(marker).toBeHidden();
  }
  throw new Error(`Mehr als 25 E2E-Lernzeiteinträge mit Präfix ${prefix} gefunden.`);
}

async function deleteTasks(page, prefix) {
  await navigate(page, 'Aufgaben');
  for (let guard = 0; guard < 25; guard += 1) {
    const marker = prefixedText(page, prefix).first();
    if (!(await marker.isVisible().catch(() => false))) return;
    const card = marker.locator('xpath=ancestor::*[@data-slot="card"][1]');
    const deleteButton = card.locator('button:has(svg.lucide-trash-2)').last();
    await expect(deleteButton).toBeVisible();
    await deleteButton.click();
    await expect(marker).toBeHidden();
  }
  throw new Error(`Mehr als 25 E2E-Aufgaben mit Präfix ${prefix} gefunden.`);
}

async function archiveProjects(page, prefix) {
  await navigate(page, 'Projekte');
  for (let guard = 0; guard < 25; guard += 1) {
    const marker = prefixedText(page, prefix).first();
    if (!(await marker.isVisible().catch(() => false))) return;
    const row = marker.locator('xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " relative ")][1]');
    const deleteButton = row.locator('button:has(svg.lucide-trash-2)').last();
    if (!(await deleteButton.isVisible().catch(() => false))) return;
    await deleteButton.click();
    await expect(deleteButton).toBeHidden();
  }
  throw new Error(`Mehr als 25 E2E-Projekte mit Präfix ${prefix} gefunden.`);
}

async function permanentlyDeleteSubjects(page, prefix) {
  await navigate(page, 'Fächer');
  for (let guard = 0; guard < 25; guard += 1) {
    const marker = prefixedText(page, prefix).first();
    if (!(await marker.isVisible().catch(() => false))) break;
    const card = marker.locator('xpath=ancestor::*[@data-slot="card"][1]');
    const archiveButton = card.locator('button:has(svg.lucide-trash-2)').last();
    await expect(archiveButton).toBeVisible();
    await archiveButton.click();
    await expect(marker).toBeHidden();
  }

  const archiveToggle = page.getByRole('button', { name: /^Archiv/ });
  await archiveToggle.click();
  for (let guard = 0; guard < 25; guard += 1) {
    const marker = prefixedText(page, prefix).first();
    if (!(await marker.isVisible().catch(() => false))) return;
    const row = marker.locator('xpath=ancestor::div[.//button][1]');
    const deleteButton = row.locator('button:has(svg.lucide-trash-2)').last();
    await expect(deleteButton).toBeVisible();
    page.once('dialog', (dialog) => dialog.accept());
    await deleteButton.click();
    await expect(marker).toBeHidden();
  }
  throw new Error(`Mehr als 25 E2E-Fächer mit Präfix ${prefix} gefunden.`);
}

async function deleteSemester(page, name) {
  await navigate(page, 'Semesterkonfiguration');
  const marker = page.getByText(name, { exact: true });
  if (!(await marker.isVisible().catch(() => false))) return;
  const card = marker.locator('xpath=ancestor::*[@data-slot="card"][1]');
  await card.getByRole('button').last().click();
  await page.getByRole('menuitem', { name: 'Löschen', exact: true }).click();
  await expect(marker).toHaveCount(0);
}

async function purgePlannerSnapshot(page, prefix) {
  await page.waitForTimeout(1500);
  const session = await page.evaluate(() => JSON.parse(localStorage.getItem('sb-auth-session') || 'null'));
  if (!session?.access_token || !session?.user?.id) {
    throw new Error('Aktive E2E-Session fehlt beim Snapshot-Cleanup.');
  }

  // Close first so pagehide/visibility handlers have flushed their final snapshot.
  await page.close();

  const headers = {
    apikey: process.env.VITE_SUPABASE_ANON_KEY,
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
  const endpoint = `${process.env.VITE_SUPABASE_URL.replace(/\/$/, '')}/rest/v1/user_plans?user_id=eq.${encodeURIComponent(session.user.id)}`;
  const loadResponse = await fetch(`${endpoint}&select=data`, { headers });
  if (!loadResponse.ok) throw new Error(`Snapshot-Cleanup konnte Daten nicht laden: HTTP ${loadResponse.status}`);
  const rows = await loadResponse.json();
  const snapshot = rows?.[0]?.data;
  if (!snapshot || typeof snapshot !== 'object') return { removed: 0 };

  const arrays = Object.entries(snapshot).filter(([, value]) => Array.isArray(value));
  const removedIds = new Set();
  const hasPrefix = (record) => record && typeof record === 'object' && Object.values(record)
    .some((value) => typeof value === 'string' && value.startsWith(prefix));

  for (const [, records] of arrays) {
    for (const record of records) {
      if (hasPrefix(record) && record.id) removedIds.add(record.id);
    }
  }

  const referencesRemovedData = (record) => [
    record?.subjectId,
    record?.taskId,
    record?.topicId,
    record?.projectId,
    record?.parentProjectId,
    record?.semesterId,
  ].some((value) => value && removedIds.has(value));

  let removed = 0;
  const cleanSnapshot = { ...snapshot };
  for (const [key, records] of arrays) {
    cleanSnapshot[key] = records.filter((record) => {
      const shouldRemove = hasPrefix(record) || referencesRemovedData(record);
      if (shouldRemove) removed += 1;
      return !shouldRemove;
    });
  }

  const saveResponse = await fetch(endpoint, {
    method: 'PATCH',
    headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify({ data: cleanSnapshot }),
  });
  if (!saveResponse.ok) throw new Error(`Snapshot-Cleanup konnte Daten nicht speichern: HTTP ${saveResponse.status}`);

  const verifyResponse = await fetch(`${endpoint}&select=data`, { headers });
  if (!verifyResponse.ok) throw new Error(`Snapshot-Cleanup konnte Read-back nicht laden: HTTP ${verifyResponse.status}`);
  const verifyRows = await verifyResponse.json();
  const verifySnapshot = verifyRows?.[0]?.data || {};
  const residual = Object.values(verifySnapshot)
    .filter(Array.isArray)
    .flat()
    .filter((record) => hasPrefix(record) || referencesRemovedData(record));
  expect(residual, `E2E-Testdaten mit Präfix ${prefix} blieben im Planner-Snapshot zurück.`).toEqual([]);
  return { removed };
}

export async function cleanupE2EData(page, { prefix, semesters }) {
  if (page.isClosed()) return;
  const sidebar = page.getByRole('complementary');
  const canUseUi = await sidebar.isVisible().catch(() => false);

  // UI cleanup exercises the normal deletion paths. The authenticated,
  // user-scoped snapshot purge below remains authoritative so a failed
  // assertion cannot leave data behind or poison a Playwright retry.
  if (canUseUi) {
    try {
      await discardActiveTimer(page);

      for (const semester of semesters) {
        await switchSemester(page, semester).catch(() => false);
        await deleteStudySessions(page, prefix);
        await archiveProjects(page, prefix);
        await deleteTasks(page, prefix);
        await permanentlyDeleteSubjects(page, prefix);
      }

      for (const semester of [...semesters].reverse()) {
        await deleteSemester(page, semester);
      }
    } catch {
      // The verified snapshot purge is the deterministic cleanup fallback.
    }
  }

  await purgePlannerSnapshot(page, prefix);
}
