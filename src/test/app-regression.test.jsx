import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { vi } from "vitest";
import App from "@/App";
import { ACTIVE_SEMESTER_STORAGE_KEY } from "@/domain/academics/semesterScope";
import {
  createPlannerFixture,
  TEST_USER_ID,
  testSubjectRow,
} from "@/test/fixtures/plannerData";
import {
  expectStoredTask,
  openEntryEditor,
  openNavigationPage,
  PLANNER_STORAGE_KEY,
  readStoredPlannerData,
} from "@/test/helpers/plannerApp";

vi.hoisted(() => {
  vi.stubEnv("VITE_SUPABASE_URL", "https://kan35.supabase.test");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "kan35-anon-key");
  vi.stubEnv("VITE_DEBUG_SYNC", "false");
});

const cloudMocks = vi.hoisted(() => ({
  getActiveSession: vi.fn(),
  loadUserPlannerData: vi.fn(),
  saveUserPlannerData: vi.fn(),
  loadSemesters: vi.fn(),
  loadSubjects: vi.fn(),
  loadTopics: vi.fn(),
  loadExams: vi.fn(),
  loadStudyTimeEntries: vi.fn(),
  loadActiveTimerSession: vi.fn(),
}));

vi.mock("@/lib/cloudStore", async (importOriginal) => ({
  ...(await importOriginal()),
  ...cloudMocks,
}));

vi.mock("@/components/DashboardQuickActions", () => ({
  default: () => null,
}));

function setupCloudMocks(plannerData, options = {}) {
  cloudMocks.getActiveSession.mockResolvedValue({
    access_token: "test-access-token",
    expires_at: 4102444800,
    user: { id: TEST_USER_ID, email: "kan35@example.test" },
  });
  cloudMocks.loadUserPlannerData.mockResolvedValue(plannerData);
  cloudMocks.saveUserPlannerData.mockResolvedValue(true);
  cloudMocks.loadSemesters.mockResolvedValue(options.semesters || [
    { id: "semester-default", name: "Standardsemester", start_date: "2026-04-01", end_date: "2026-09-30" },
  ]);
  cloudMocks.loadSubjects.mockResolvedValue(options.subjects || [
    { ...testSubjectRow, semester_id: "semester-default" },
  ]);
  cloudMocks.loadTopics.mockResolvedValue([]);
  cloudMocks.loadExams.mockResolvedValue([]);
  cloudMocks.loadStudyTimeEntries.mockResolvedValue([]);
  cloudMocks.loadActiveTimerSession.mockResolvedValue(null);
}

async function renderPlannerApp(options = {}) {
  const plannerData = createPlannerFixture();
  localStorage.setItem(PLANNER_STORAGE_KEY, JSON.stringify(plannerData));
  setupCloudMocks(plannerData, options);
  render(<App />);
  await screen.findAllByRole("button", { name: "Aufgaben" });
}

function createDeferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("Semesterwechsel", () => {
  const semesterOptions = {
    semesters: [
      { id: "semester-a", name: "Semester A", start_date: "2026-04-01", end_date: "2026-09-30" },
      { id: "semester-b", name: "Semester B", start_date: "2026-10-01", end_date: "2027-03-31" },
    ],
    subjects: [
      { ...testSubjectRow, semester_id: "semester-a" },
      { ...testSubjectRow, id: "subject-b", name: "Datenbanken", semester_id: "semester-b" },
    ],
  };

  it("behält das aktive Semester bei, solange ein Timer läuft", async () => {
    await renderPlannerApp(semesterOptions);
    cloudMocks.loadActiveTimerSession.mockResolvedValue({
      id: "timer-a",
      semesterId: "semester-a",
      subjectId: testSubjectRow.id,
      status: "running",
    });

    await openNavigationPage("Semesterkonfiguration");
    fireEvent.click(screen.getByRole("button", { name: /Semester B/ }));

    expect(await screen.findByText("Semesterwechsel nicht möglich: Bitte den laufenden Timer zuerst beenden oder abbrechen.")).toBeInTheDocument();
    expect(within(screen.getByText("Semester A").closest('[data-slot="card"]')).getByText("Aktives Semester")).toBeInTheDocument();
    expect(within(screen.getByText("Semester B").closest('[data-slot="card"]')).getByText("Semester auswählen")).toBeInTheDocument();
  });

  it("wechselt A nach B und zurück und persistiert erst nach erfolgreicher Vorprüfung", async () => {
    await renderPlannerApp(semesterOptions);
    await openNavigationPage("Semesterkonfiguration");

    fireEvent.click(screen.getByRole("button", { name: /Semester B/ }));
    await waitFor(() => {
      expect(within(screen.getByText("Semester B").closest('[data-slot="card"]')).getByText("Aktives Semester")).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(cloudMocks.loadTopics.mock.calls.some(([, options]) => options?.semesterId === "semester-b")).toBe(true);
    });
    expect(localStorage.getItem(`${ACTIVE_SEMESTER_STORAGE_KEY}:${TEST_USER_ID}`)).toBe("semester-b");

    fireEvent.click(screen.getByRole("button", { name: /Semester A/ }));
    await waitFor(() => {
      expect(within(screen.getByText("Semester A").closest('[data-slot="card"]')).getByText("Aktives Semester")).toBeInTheDocument();
    });
    expect(localStorage.getItem(`${ACTIVE_SEMESTER_STORAGE_KEY}:${TEST_USER_ID}`)).toBe("semester-a");
  });

  it("persistiert bei fehlgeschlagener Vorprüfung keinen teilweise gewechselten Zustand", async () => {
    await renderPlannerApp(semesterOptions);
    cloudMocks.loadActiveTimerSession.mockRejectedValue(new Error("Timerstatus nicht erreichbar"));
    await openNavigationPage("Semesterkonfiguration");

    fireEvent.click(screen.getByRole("button", { name: /Semester B/ }));

    expect(await screen.findByText("Timerstatus nicht erreichbar")).toBeInTheDocument();
    expect(within(screen.getByText("Semester A").closest('[data-slot="card"]')).getByText("Aktives Semester")).toBeInTheDocument();
    expect(localStorage.getItem(`${ACTIVE_SEMESTER_STORAGE_KEY}:${TEST_USER_ID}`)).toBe("semester-a");
  });

  it("lädt und zeigt aktive sowie archivierte Fächer nur für das ausgewählte Semester", async () => {
    localStorage.setItem(`${ACTIVE_SEMESTER_STORAGE_KEY}:${TEST_USER_ID}`, "semester-a");
    await renderPlannerApp({
      semesters: semesterOptions.semesters,
      subjects: [
        { ...testSubjectRow, semester_id: "semester-a" },
        { ...testSubjectRow, id: "archived-a", name: "Archiv A", semester_id: "semester-a", is_archived: true },
        { ...testSubjectRow, id: "subject-b", name: "Datenbanken", semester_id: "semester-b" },
        { ...testSubjectRow, id: "archived-b", name: "Archiv B", semester_id: "semester-b", is_archived: true },
      ],
    });

    await openNavigationPage("Fächer");
    expect(await screen.findByText("Archiv A")).toBeInTheDocument();
    expect(screen.queryByText("Archiv B")).not.toBeInTheDocument();
    expect(cloudMocks.loadSubjects).toHaveBeenCalledWith(TEST_USER_ID, { semesterId: "semester-a" });

    await openNavigationPage("Semesterkonfiguration");
    fireEvent.click(screen.getByRole("button", { name: /Semester B/ }));
    await waitFor(() => {
      expect(cloudMocks.loadSubjects).toHaveBeenCalledWith(TEST_USER_ID, { semesterId: "semester-b" });
    });

    await openNavigationPage("Fächer");
    expect(await screen.findByText("Archiv B")).toBeInTheDocument();
    expect(screen.queryByText("Archiv A")).not.toBeInTheDocument();
  });

  it("berücksichtigt archivierte Fächer bei historischen Semesterabfragen", async () => {
    localStorage.setItem(`${ACTIVE_SEMESTER_STORAGE_KEY}:${TEST_USER_ID}`, "semester-a");
    await renderPlannerApp({
      semesters: semesterOptions.semesters,
      subjects: [
        { ...testSubjectRow, semester_id: "semester-a" },
        { ...testSubjectRow, id: "archived-a", name: "Archiv A", semester_id: "semester-a", is_archived: true },
      ],
    });

    await waitFor(() => {
      expect(cloudMocks.loadExams).toHaveBeenCalledWith(TEST_USER_ID, {
        semesterId: "semester-a",
        subjectIds: expect.arrayContaining([testSubjectRow.id, "archived-a"]),
      });
      expect(cloudMocks.loadStudyTimeEntries).toHaveBeenCalledWith(TEST_USER_ID, {
        semesterId: "semester-a",
        subjectIds: expect.arrayContaining([testSubjectRow.id, "archived-a"]),
      });
    });
  });

  it("blendet offene Aufgaben archivierter Fächer aus aktiven Ansichten aus", async () => {
    localStorage.setItem(`${ACTIVE_SEMESTER_STORAGE_KEY}:${TEST_USER_ID}`, "semester-a");
    await renderPlannerApp({
      semesters: semesterOptions.semesters,
      subjects: [
        { ...testSubjectRow, semester_id: "semester-a", is_archived: true },
      ],
    });

    await openNavigationPage("Aufgaben");
    expect(screen.queryByText("Refactoring vorbereiten")).not.toBeInTheDocument();
  });

  it("ignoriert verspätete Fachantworten eines zuvor ausgewählten Semesters", async () => {
    localStorage.setItem(`${ACTIVE_SEMESTER_STORAGE_KEY}:${TEST_USER_ID}`, "semester-a");
    await renderPlannerApp(semesterOptions);
    await waitFor(() => {
      expect(cloudMocks.loadSubjects).toHaveBeenCalledWith(TEST_USER_ID, { semesterId: "semester-a" });
    });

    const delayedSemesterB = createDeferred();
    cloudMocks.loadSubjects.mockImplementation((userId, options) => {
      if (options?.semesterId === "semester-b") return delayedSemesterB.promise;
      return Promise.resolve([{ ...testSubjectRow, semester_id: "semester-a" }]);
    });

    await openNavigationPage("Semesterkonfiguration");
    fireEvent.click(screen.getByRole("button", { name: /Semester B/ }));
    await waitFor(() => {
      expect(cloudMocks.loadSubjects).toHaveBeenCalledWith(TEST_USER_ID, { semesterId: "semester-b" });
    });

    fireEvent.click(screen.getByRole("button", { name: /Semester A/ }));
    await waitFor(() => {
      expect(within(screen.getByText("Semester A").closest('[data-slot="card"]')).getByText("Aktives Semester")).toBeInTheDocument();
    });

    delayedSemesterB.resolve([
      { ...testSubjectRow, id: "subject-b", name: "Datenbanken", semester_id: "semester-b" },
    ]);
    await Promise.resolve();

    await openNavigationPage("Fächer");
    expect(await screen.findByText("Softwaretechnik")).toBeInTheDocument();
    expect(screen.queryByText("Datenbanken")).not.toBeInTheDocument();
  });

  it("bindet den Fachdialog fest an das aktive Semester", async () => {
    localStorage.setItem(`${ACTIVE_SEMESTER_STORAGE_KEY}:${TEST_USER_ID}`, "semester-b");
    await renderPlannerApp(semesterOptions);
    await openNavigationPage("Fächer");

    fireEvent.click(screen.getByRole("button", { name: "Fach anlegen" }));

    const dialog = await screen.findByRole("dialog", { name: "Fach anlegen" });
    const semesterSelect = within(dialog).getByRole("combobox");
    expect(semesterSelect).toHaveTextContent("Semester B");
    expect(semesterSelect).toBeDisabled();
  });
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-07-22T12:00:00.000Z"));
  localStorage.removeItem(`${ACTIVE_SEMESTER_STORAGE_KEY}:${TEST_USER_ID}`);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
  Object.values(cloudMocks).forEach((mock) => mock.mockReset());
});

describe("bestehende Aufgabenabläufe", () => {
  it("lädt Aufgabeneigenschaften und speichert eine Bearbeitung lokal sowie über die Cloud-Grenze", async () => {
    await renderPlannerApp();
    await openNavigationPage("Aufgaben");

    const taskTitle = await screen.findByRole("heading", { name: "Refactoring vorbereiten", level: 3 });
    const taskCard = taskTitle.closest('[data-slot="card"]');
    expect(taskCard).not.toBeNull();
    expect(within(taskCard).getByText("Tests zuerst schreiben")).toBeInTheDocument();
    expect(within(taskCard).getByText("Softwaretechnik")).toBeInTheDocument();
    expect(within(taskCard).getByText("hoch")).toBeInTheDocument();
    expect(within(taskCard).getByText("Dringend")).toBeInTheDocument();
    expect(within(taskCard).getByText("Heute lernen")).toBeInTheDocument();
    expect(within(taskCard).getByText("Abgabe: 15.08.26")).toBeInTheDocument();
    expect(within(taskCard).getByText("Abnahme: 20.08.26")).toBeInTheDocument();

    openEntryEditor("Refactoring vorbereiten", 1);
    const editor = await screen.findByRole("dialog", { name: "Eintrag bearbeiten" });
    const [titleInput, descriptionInput] = within(editor).getAllByRole("textbox");
    fireEvent.change(titleInput, { target: { value: "Refactoring abgesichert" } });
    fireEvent.change(descriptionInput, { target: { value: "Regressionstests vorhanden" } });
    fireEvent.click(within(editor).getByRole("button", { name: "Speichern" }));

    expect(await screen.findByRole("heading", { name: "Refactoring abgesichert", level: 3 })).toBeInTheDocument();
    await expectStoredTask("task-regression", {
      title: "Refactoring abgesichert",
      description: "Regressionstests vorhanden",
      type: "task",
      priority: "hoch",
      dueDate: "2026-08-15",
      acceptanceDate: "2026-08-20",
      customMarker: "task-fields-stay-intact",
    });

    await waitFor(() => {
      expect(cloudMocks.saveUserPlannerData.mock.calls.some(([userId, snapshot]) => (
        userId === TEST_USER_ID
        && snapshot.tasks.some((task) => task.id === "task-regression" && task.title === "Refactoring abgesichert")
      ))).toBe(true);
    });
  });
});

describe("bestehende Deadline-Abläufe", () => {
  it("stellt Deadline-Daten dar und behält Typ sowie Metadaten beim Speichern bei", async () => {
    await renderPlannerApp();
    await openNavigationPage("Aufgaben");

    const deadlineTitle = await screen.findByRole("heading", { name: "Abgabe Testkonzept", level: 3 });
    const deadlineCard = deadlineTitle.closest('[data-slot="card"]');
    expect(deadlineCard).not.toBeNull();
    expect(within(deadlineCard).getByText("Deadline")).toBeInTheDocument();
    expect(within(deadlineCard).getByText("Abgabe: 30.07.26")).toBeInTheDocument();
    expect(within(deadlineCard).getByText("Abnahme: 01.08.26")).toBeInTheDocument();

    openEntryEditor("Abgabe Testkonzept", 1);
    const editor = await screen.findByRole("dialog", { name: "Eintrag bearbeiten" });
    const dateInputs = editor.querySelectorAll('input[type="date"]');
    expect(dateInputs).toHaveLength(3);
    fireEvent.change(dateInputs[1], { target: { value: "2026-08-05" } });
    fireEvent.click(within(editor).getByRole("button", { name: "Speichern" }));

    const updatedDeadline = await screen.findByRole("heading", { name: "Abgabe Testkonzept", level: 3 });
    expect(within(updatedDeadline.closest('[data-slot="card"]')).getByText("Abgabe: 05.08.26")).toBeInTheDocument();
    await expectStoredTask("deadline-testkonzept", {
      type: "deadline",
      dueDate: "2026-08-05",
      acceptanceDate: "2026-08-01",
      urgent: true,
      customMarker: "deadline-fields-stay-intact",
    });
  });
});

describe("bestehende Projektabläufe", () => {
  it("zeigt den berechneten Fortschritt und erhält Projekt- sowie Teilaufgabendaten beim Speichern", async () => {
    await renderPlannerApp();
    await openNavigationPage("Projekte");

    const projectsCard = screen.getByRole("heading", { name: "Offene Projekte" }).closest('[data-slot="card"]');
    expect(within(projectsCard).getByTitle("App modularisieren")).toBeInTheDocument();
    expect(within(projectsCard).getByText("50 %")).toBeInTheDocument();
    expect(within(projectsCard).getByText("1 Teilaufgaben offen")).toBeInTheDocument();
    expect(within(projectsCard).getByText("Softwaretechnik")).toBeInTheDocument();

    fireEvent.click(within(projectsCard).getAllByRole("button")[2]);
    const editor = await screen.findByRole("dialog", { name: "Eintrag bearbeiten" });
    const [titleInput, descriptionInput] = within(editor).getAllByRole("textbox");
    fireEvent.change(titleInput, { target: { value: "App modularisieren – abgesichert" } });
    fireEvent.change(descriptionInput, { target: { value: "Projektverhalten bleibt stabil" } });
    fireEvent.click(within(editor).getByRole("button", { name: "Speichern" }));

    expect(await screen.findByTitle("App modularisieren – abgesichert")).toBeInTheDocument();
    await expectStoredTask("project-modularisierung", {
      title: "App modularisieren – abgesichert",
      description: "Projektverhalten bleibt stabil",
      type: "project",
      isPinned: true,
      customMarker: "project-fields-stay-intact",
    });

    const storedTasks = readStoredPlannerData().tasks;
    expect(storedTasks.filter((task) => task.parentProjectId === "project-modularisierung")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "project-task-open", status: "offen" }),
        expect.objectContaining({ id: "project-task-done", status: "erledigt" }),
      ]),
    );
  });
});
