import { expect } from '@playwright/test';

export const runId = `E2E-${process.env.GITHUB_RUN_ID || Date.now()}`;

export function requireE2EEnvironment() {
  const required = ['E2E_TEST_EMAIL', 'E2E_TEST_PASSWORD'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`E2E-Testkonto nicht konfiguriert. Fehlend: ${missing.join(', ')}. Der Browser-Test darf nicht übersprungen werden.`);
  }
}

export function installBrowserGuards(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console.error: ${message.text()}`);
  });
  page.on('response', (response) => {
    if (response.status() >= 500) errors.push(`HTTP ${response.status()}: ${response.url()}`);
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

async function chooseOption(page, dialog, value) {
  const combos = dialog.getByRole('combobox');
  for (let i = 0; i < await combos.count(); i += 1) {
    const combo = combos.nth(i);
    if (!(await combo.isEnabled().catch(() => false))) continue;
    await combo.click();
    const option = page.getByRole('option', { name: value, exact: true });
    if (await option.isVisible().catch(() => false)) {
      await option.click();
      return true;
    }
    await page.keyboard.press('Escape');
  }
  return false;
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
  await clickAny(page, [/Neue Aufgabe/i, /Aufgabe anlegen/i, /Aufgabe erstellen/i]);
  const dialog = page.getByRole('dialog').last();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('textbox').first().fill(name);
  if (!(await chooseOption(page, dialog, subjectName))) throw new Error(`Fach ${subjectName} konnte der Aufgabe nicht zugeordnet werden.`);
  await clickAny(dialog, [/Speichern/i, /Anlegen/i, /Erstellen/i]);
  await expect(page.getByText(name, { exact: true })).toBeVisible();
}

export async function createProject(page, name, subjectName) {
  await navigate(page, 'Projekte');
  await clickAny(page, [/Neues Projekt/i, /Projekt anlegen/i, /Projekt erstellen/i]);
  const dialog = page.getByRole('dialog').last();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('textbox').first().fill(name);
  await chooseOption(page, dialog, subjectName);
  await clickAny(dialog, [/Speichern/i, /Anlegen/i, /Erstellen/i]);
  await expect(page.getByText(name, { exact: true })).toBeVisible();
}

export async function createSubtask(page, projectName, subtaskName) {
  await navigate(page, 'Projekte');
  const card = page.getByText(projectName, { exact: true }).locator('xpath=ancestor::*[@data-slot="card"][1]');
  await expect(card).toBeVisible();
  await clickAny(card, [/Unteraufgabe/i, /Subtask/i, /Aufgabe hinzufügen/i]);
  const dialog = page.getByRole('dialog').last();
  await dialog.getByRole('textbox').first().fill(subtaskName);
  await clickAny(dialog, [/Speichern/i, /Anlegen/i, /Erstellen/i]);
  await expect(page.getByText(subtaskName, { exact: true })).toBeVisible();
}

export async function startTimerFromTask(page, taskName) {
  await navigate(page, 'Aufgaben');
  const card = page.getByText(taskName, { exact: true }).locator('xpath=ancestor::*[@data-slot="card"][1]');
  await expect(card).toBeVisible();
  const named = card.getByRole('button', { name: /Timer|Start/i }).first();
  if (await named.isVisible().catch(() => false)) await named.click();
  else {
    const titled = card.locator('button[title*="Timer"], button[aria-label*="Timer"]').first();
    if (!(await titled.isVisible().catch(() => false))) throw new Error('Timer-Aktion an der Aufgabe nicht gefunden.');
    await titled.click();
  }
  const dialog = page.getByRole('dialog').last();
  if (await dialog.isVisible().catch(() => false)) await clickAny(dialog, [/Timer starten/i, /^Starten$/i, /^Start$/i]);
}

export async function startGlobalTimer(page, subjectName) {
  await navigate(page, 'Dashboard');
  await clickAny(page, [/Timer starten/i, /Timer/i]);
  const dialog = page.getByRole('dialog').last();
  if (await dialog.isVisible().catch(() => false)) {
    await chooseOption(page, dialog, subjectName);
    await clickAny(dialog, [/Timer starten/i, /^Starten$/i, /^Start$/i]);
  }
}

export async function stopTimer(page) {
  await clickAny(page, [/Timer stoppen/i, /Timer beenden/i, /^Stoppen$/i, /^Beenden$/i]);
  const dialog = page.getByRole('dialog').last();
  if (await dialog.isVisible().catch(() => false)) {
    const confirm = dialog.getByRole('button', { name: /Speichern|Beenden|Abschließen|Stoppen/i }).first();
    if (await confirm.isVisible().catch(() => false)) await confirm.click();
  }
}

export async function pauseAndResumeTimer(page) {
  await clickAny(page, [/Pausieren/i, /^Pause$/i]);
  await page.waitForTimeout(500);
  await clickAny(page, [/Fortsetzen/i, /Weiter/i, /^Start$/i]);
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
