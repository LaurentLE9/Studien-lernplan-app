import { test, expect } from '@playwright/test';
import {
  assertNoBrowserErrors,
  assertRunningTimer,
  assertTimerAcrossPages,
  createProject,
  createSemester,
  createSubject,
  createTask,
  installBrowserGuards,
  login,
  navigate,
  pauseAndResumeTimer,
  requireE2EEnvironment,
  runId,
  startGlobalTimer,
  startTimerFromTask,
  stopTimer,
  switchSemester,
} from './helpers/app.js';
import { cleanupE2EData } from './helpers/cleanup.js';

const semesterA = `${runId}-Semester-A`;
const semesterB = `${runId}-Semester-B`;
const subjectA = `${runId}-Fach-A`;
const subjectB = `${runId}-Fach-B`;
const taskA = `${runId}-Aufgabe-A`;
const projectA = `${runId}-Projekt-A`;
const subtaskA = `${runId}-Subtask-A`;

const timerPages = [
  'Dashboard',
  'Aufgaben',
  'Projekte',
  'Statistik',
  'Lernplan',
  'Fächer',
  'Semesterkonfiguration',
];

test.describe.serial('KAN-109 Kernregression im echten Browser', () => {
  test.beforeAll(() => requireE2EEnvironment());

  test.afterEach(async ({ page }) => {
    await cleanupE2EData(page, {
      prefix: runId,
      semesters: [semesterA, semesterB],
    });
  });

  test('vollständiger Kernablauf mit isoliertem Testkonto', async ({ page }, testInfo) => {
    testInfo.setTimeout(300_000);
    const staleDataPage = await page.context().newPage();
    await login(staleDataPage);
    await cleanupE2EData(staleDataPage, {
      prefix: 'E2E-',
      semesters: [],
      useUi: false,
    });

    const browserGuard = await installBrowserGuards(page);
    await login(page);

    await test.step('Semester A und B anlegen', async () => {
      await createSemester(page, semesterA, '2026-10-01', '2027-03-31');
      await createSemester(page, semesterB, '2027-04-01', '2027-09-30');
      await switchSemester(page, semesterA);
    });

    await test.step('Fach, Aufgabe, Projekt und Subtask in Semester A anlegen', async () => {
      await createSubject(page, subjectA);
      await createTask(page, taskA, subjectA);
      await createProject(page, projectA, subjectA, subtaskA);
    });

    await test.step('Semestertrennung A → B → A prüfen', async () => {
      await switchSemester(page, semesterB);
      await navigate(page, 'Fächer');
      await expect(page.getByText(subjectA, { exact: true })).toHaveCount(0);
      await navigate(page, 'Aufgaben');
      await expect(page.getByText(taskA, { exact: true })).toHaveCount(0);
      await navigate(page, 'Projekte');
      await expect(page.getByText(projectA, { exact: true })).toHaveCount(0);
      await createSubject(page, subjectB);

      await switchSemester(page, semesterA);
      await navigate(page, 'Fächer');
      await expect(page.getByText(subjectA, { exact: true })).toBeVisible();
      await expect(page.getByText(subjectB, { exact: true })).toHaveCount(0);
      await navigate(page, 'Aufgaben');
      await expect(page.getByText(taskA, { exact: true })).toBeVisible();
      await navigate(page, 'Projekte');
      await expect(page.getByText(projectA, { exact: true })).toBeVisible();
    });

    await test.step('Timer direkt aus Aufgabe starten', async () => {
      await startTimerFromTask(page, taskA, subjectA);
      await assertRunningTimer(page);
    });

    await test.step('laufenden Timer auf allen Kernseiten prüfen', async () => {
      await assertTimerAcrossPages(page, timerPages);
    });

    await test.step('Reload bei laufendem Timer prüfen', async () => {
      await browserGuard.reload();
      await expect(page.getByRole('button', { name: 'Aufgaben' }).first()).toBeVisible();
      await assertRunningTimer(page);
    });

    await test.step('Pause, Fortsetzen und Beenden prüfen', async () => {
      await pauseAndResumeTimer(page);
      await assertRunningTimer(page);
      await stopTimer(page);
    });

    await test.step('globalen Timer mit Fach starten und beenden', async () => {
      await startGlobalTimer(page, subjectA);
      await assertRunningTimer(page);
      await pauseAndResumeTimer(page);
      await stopTimer(page);
    });

    await test.step('Statistik nach erzeugter Lernzeit prüfen', async () => {
      await navigate(page, 'Statistik');
      const subjectRow = page.getByText(subjectA, { exact: true }).first().locator('xpath=../..');
      await expect(subjectRow.getByText('2min', { exact: true })).toBeVisible();
      const taskRow = page.getByText(taskA, { exact: true }).first().locator('xpath=ancestor::tr[1]');
      await expect(taskRow.getByText('1min', { exact: true }).first()).toBeVisible();
      const body = await page.locator('body').innerText();
      expect(body).not.toMatch(/NaN|undefined/);
    });

    await test.step('Statistik zwischen Semestern trennen', async () => {
      await switchSemester(page, semesterB);
      await navigate(page, 'Statistik');
      await expect(page.getByText(subjectA, { exact: true })).toHaveCount(0);
      await switchSemester(page, semesterA);
      await navigate(page, 'Statistik');
      await expect(page.getByText(subjectA, { exact: true }).first()).toBeVisible();
    });

    await test.step('Persistenz nach erneutem Reload prüfen', async () => {
      await browserGuard.reload();
      await navigate(page, 'Fächer');
      await expect(page.getByText(subjectA, { exact: true })).toBeVisible();
      await navigate(page, 'Aufgaben');
      await expect(page.getByText(taskA, { exact: true })).toBeVisible();
      await navigate(page, 'Projekte');
      await expect(page.getByText(projectA, { exact: true })).toBeVisible();
      await navigate(page, 'Aufgaben');
      await expect(page.getByText(subtaskA, { exact: true })).toBeVisible();
    });

    await test.step('Einstellungen & Backup ohne Renderingfehler öffnen', async () => {
      await navigate(page, 'Einstellungen & Backup', 'Datenverwaltung & Backup');
      await expect(page.getByRole('heading', { name: 'Deine Daten' })).toBeVisible();
      await expect(page.getByText('Fächer', { exact: true }).last()).toBeVisible();
      await expect(page.getByText('Aufgaben', { exact: true }).last()).toBeVisible();
      await expect(page.getByText('Lernzeiten', { exact: true })).toBeVisible();
    });

    await assertNoBrowserErrors(browserGuard.errors);

    await testInfo.attach('completed-request-anomalies', {
      body: Buffer.from(JSON.stringify(browserGuard.completedRequestAnomalies, null, 2)),
      contentType: 'application/json',
    });

    await testInfo.attach('e2e-run-id', {
      body: Buffer.from(runId),
      contentType: 'text/plain',
    });
  });
});
