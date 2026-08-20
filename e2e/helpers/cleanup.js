import { expect } from '@playwright/test';
import { clickAny, navigate, switchSemester } from './app.js';

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function confirmDeletion(page) {
  const dialog = page.getByRole('dialog').last();
  if (!(await dialog.isVisible().catch(() => false))) return;
  const confirm = dialog.getByRole('button', { name: /Löschen|Entfernen|Bestätigen/i }).first();
  if (await confirm.isVisible().catch(() => false)) await confirm.click();
}

async function deletePrefixedCards(page, pageName, prefix) {
  await navigate(page, pageName);
  const prefixed = new RegExp(`^${escapeRegExp(prefix)}`);
  for (let guard = 0; guard < 25; guard += 1) {
    const marker = page.getByText(prefixed).first();
    if (!(await marker.isVisible().catch(() => false))) break;
    const card = marker.locator('xpath=ancestor::*[@data-slot="card"][1]');
    const named = card.getByRole('button', { name: /Löschen|Entfernen/i }).first();
    if (await named.isVisible().catch(() => false)) await named.click();
    else {
      const titled = card.locator('button[title*="Lösch"], button[aria-label*="Lösch"], button[title*="Entfern"], button[aria-label*="Entfern"]').first();
      if (!(await titled.isVisible().catch(() => false))) break;
      await titled.click();
    }
    await confirmDeletion(page);
  }
}

async function deleteSemester(page, name) {
  await navigate(page, 'Semesterkonfiguration');
  const marker = page.getByText(name, { exact: true });
  if (!(await marker.isVisible().catch(() => false))) return;
  const card = marker.locator('xpath=ancestor::*[@data-slot="card"][1]');
  const named = card.getByRole('button', { name: /Löschen|Entfernen/i }).first();
  if (await named.isVisible().catch(() => false)) await named.click();
  else {
    const titled = card.locator('button[title*="Lösch"], button[aria-label*="Lösch"]').first();
    if (!(await titled.isVisible().catch(() => false))) return;
    await titled.click();
  }
  await confirmDeletion(page);
  await expect(page.getByText(name, { exact: true })).toHaveCount(0);
}

export async function cleanupE2EData(page, { prefix, semesters }) {
  if (page.isClosed()) return;
  for (const semester of semesters) {
    const exists = await page.getByText(semester, { exact: true }).isVisible().catch(() => false);
    if (!exists) {
      await navigate(page, 'Semesterkonfiguration').catch(() => {});
    }
    await switchSemester(page, semester).catch(() => {});
    await deletePrefixedCards(page, 'Projekte', prefix).catch(() => {});
    await deletePrefixedCards(page, 'Aufgaben', prefix).catch(() => {});
    await deletePrefixedCards(page, 'Fächer', prefix).catch(() => {});
  }

  for (const semester of [...semesters].reverse()) {
    await deleteSemester(page, semester).catch(() => {});
  }

  // Cleanup is mandatory: if prefixed data is still visible in any reachable core view, fail.
  for (const pageName of ['Dashboard', 'Aufgaben', 'Projekte', 'Fächer', 'Semesterkonfiguration']) {
    await navigate(page, pageName).catch(() => {});
    const residual = page.getByText(new RegExp(`^${escapeRegExp(prefix)}`));
    expect(await residual.count(), `E2E-Testdaten mit Präfix ${prefix} wurden nicht vollständig bereinigt (${pageName}).`).toBe(0);
  }
}
