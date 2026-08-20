import { expect } from '@playwright/test';

export const runId = `E2E-${process.env.GITHUB_RUN_ID || Date.now()}`;

export function requireE2EEnvironment() {
  const required = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'E2E_TEST_EMAIL',
    'E2E_TEST_PASSWORD',
  ];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`E2E-Testkonto nicht konfiguriert. Fehlend: ${missing.join(', ')}. Der Browser-Test darf nicht übersprungen werden.`);
  }
}

export function installBrowserGuards(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('requestfailed', (request) => {
    errors.push(`requestfailed: ${request.method()} ${request.url()} (${request.failure()?.errorText || 'unknown'})`);
  });
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console.error: ${message.text()}`);
  });
  page.on('response', (response) => {
    const isApiResponse = /\/auth\/v1\/|\/rest\/v1\//.test(response.url());
    if (response.status() >= 500 || (isApiResponse && response.status() >= 400)) {
      errors.push(`HTTP ${response.status()}: ${response.url()}`);
    }
  });
  return errors;
}

export async function login(page) {
  await page.goto('/');
  const loginHeading = page.getByRole('heading', { name: 'Anmelden' });
  if (await loginHeading.isVisible().catch(() => false)) {
    await page.getByLabel('E-Mail').fill(process.env.E2E_TEST_EMAIL);
    await page.getByLabel('Passwort').fill(process.env.E2E_TEST_PASSWORD);
    await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  }
  await expect(page.getByRole('button', { name: 'Aufgaben' }).first()).toBeVisible();
}

export async function navigate(page, name) {
  const sidebar = page.getByRole('complementary');
  await expect(sidebar).toBeVisible();
  await sidebar.getByRole('button', { name, exact: true }).click();
  await expect(page.getByRole('heading', { name, level: 2 }).first()).toBeVisible();
}

export async function clickAny(scope, patterns) {
  for (const pattern of patterns) {
    const button = scope.getByRole('button', { name: pattern }).first();
    if (await button.isVisible().catch(() => false)) {
      await button.click();
      return;
    }
  }
  throw new Error(`Erforderliche Aktion nicht gefunden: ${patterns.map(String).join(' | ')}`);
}

function fieldGroup(scope, label) {
  return scope.getByText(label, { exact: true }).locator('xpath=..');
}

async function selectField(page, scope, label, value) {
  const combo = fieldGroup(scope, label).getByRole('combobox');
  await expect(combo).toBeEnabled();
  await combo.click();
  await page.getByRole('option', { name: value, exact: true }).click();
}

export async function createSemester(page, name, start = '2026-10-01', end = '2027-03-31') {
  await navigate(page, 'Semesterkonfiguration');
  await clickAny(page, [/Semester anlegen/i, /Neues Semester/i, /Semester hinzufügen/i]);
  const dialog = page.getByRole('dialog').last();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('textbox').first().fill(name);
  const dates = dialog.locator('input[type="date"]');
  if (await dates.count() >= 2) {
    await dates.nth(0).fill(start);
    await dates.nth(1).fill(end);
  }
  await clickAny(dialog, [/Speichern/i, /Anlegen/i]);
  await expect(page.getByText(name, { exact: true })).toBeVisible();
}

export async function switchSemester(page, name) {
  await navigate(page, 'Semesterkonfiguration');
  const card = page.getByText(name, { exact: true }).locator('xpath=ancestor::*[@data-slot="card"][1]');
  await expect(card).toBeVisible();
  const named = card.getByRole('button').filter({ hasText: new RegExp(name, 'i') }).first();
  if (await named.isVisible().catch(() => false)) await named.click();
  else await clickAny(card, [/Semester auswählen/i, /Aktivieren/i]);
  await expect(card.getByText('Aktives Semester')).toBeVisible();
}

export async function createSubject(page, name) {
  await navigate(page, 'Fächer');
  await page.getByRole('button', { name: 'Fach anlegen' }).click();
  const dialog = page.getByRole('dialog', { name: 'Fach anlegen' });
  await dialog.getByRole('textbox').first().fill(name);
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
}

export async function createTask(page, name, subjectName) {
  await navigate(page, 'Aufgaben');
  await page.getByRole('button', { name: 'Eintrag anlegen', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Eintrag anlegen' });
  await expect(dialog).toBeVisible();
  await fieldGroup(dialog, 'Titel').getByRole('textbox').fill(name);
  await selectField(page, dialog, 'Typ', 'Aufgabe');
  await selectField(page, dialog, 'Fach', subjectName);
  await fieldGroup(dialog, 'Abgabe').locator('input[type="date"]').fill('2027-03-01');
  await dialog.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
}

export async function createProject(page, name, subjectName, subtaskName) {
  await navigate(page, 'Projekte');
  await page.getByRole('button', { name: 'Eintrag anlegen', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Eintrag anlegen' });
  await expect(dialog).toBeVisible();
  await fieldGroup(dialog, 'Titel').getByRole('textbox').fill(name);
  await selectField(page, dialog, 'Typ', 'Projekt');
  await selectField(page, dialog, 'Fach', subjectName);
  await dialog.getByRole('button', { name: 'Aufgabe', exact: true }).click();
  await dialog.getByPlaceholder('Aufgabentitel').fill(subtaskName);
  await dialog.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  await expect(page.getByText(subtaskName, { exact: true })).toBeVisible();
}

export async function startTimerFromTask(page, taskName, subjectName) {
  await navigate(page, 'Dashboard');
  await page.getByRole('button', { name: `Timer für ${taskName} starten`, exact: true }).click();
  await expect(page.getByText(subjectName, { exact: true }).first()).toBeVisible();
  await expect(page.getByText(taskName, { exact: true }).first()).toBeVisible();
}

export async function startGlobalTimer(page, subjectName) {
  await navigate(page, 'Dashboard');
  await page.getByRole('button', { name: 'Timer', exact: true }).click();
  const dialog = page.getByRole('dialog').last();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: subjectName, exact: true }).click();
  await dialog.getByRole('button', { name: 'Ohne Aufgabe starten', exact: true }).click();
  await expect(page.getByText(subjectName, { exact: true }).first()).toBeVisible();
}

export async function stopTimer(page) {
  await page.getByRole('button', { name: 'Beenden', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Timer beenden' });
  await dialog.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(dialog).toBeHidden();
}

export async function pauseAndResumeTimer(page) {
  await page.getByRole('button', { name: 'Timer pausieren', exact: true }).click();
  await expect(page.getByText('Pausiert', { exact: true })).toBeVisible();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Timer fortsetzen', exact: true }).click();
}

export async function assertRunningTimer(page) {
  const timerText = page.getByText(/\b\d{1,2}:\d{2}(?::\d{2})?\b/).first();
  await expect(timerText).toBeVisible();
  const before = (await timerText.textContent())?.trim();
  await page.waitForTimeout(1300);
  const after = (await timerText.textContent())?.trim();
  expect(after).not.toBe(before);
}

export async function assertTimerAcrossPages(page, pages) {
  for (const name of pages) {
    await navigate(page, name);
    await assertRunningTimer(page);
  }
}

export async function assertNoBrowserErrors(errors) {
  expect(errors, errors.join('\n')).toEqual([]);
}
