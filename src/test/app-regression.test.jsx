import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { vi } from "vitest";
import App from "@/App";
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

function setupCloudMocks(plannerData) {
  cloudMocks.getActiveSession.mockResolvedValue({
    access_token: "test-access-token",
    expires_at: 4102444800,
    user: { id: TEST_USER_ID, email: "kan35@example.test" },
  });
  cloudMocks.loadUserPlannerData.mockResolvedValue(plannerData);
  cloudMocks.saveUserPlannerData.mockResolvedValue(true);
  cloudMocks.loadSemesters.mockResolvedValue([]);
  cloudMocks.loadSubjects.mockResolvedValue([{ ...testSubjectRow }]);
  cloudMocks.loadTopics.mockResolvedValue([]);
  cloudMocks.loadExams.mockResolvedValue([]);
  cloudMocks.loadStudyTimeEntries.mockResolvedValue([]);
  cloudMocks.loadActiveTimerSession.mockResolvedValue(null);
}

async function renderPlannerApp() {
  const plannerData = createPlannerFixture();
  localStorage.setItem(PLANNER_STORAGE_KEY, JSON.stringify(plannerData));
  setupCloudMocks(plannerData);
  render(<App />);
  await screen.findAllByRole("button", { name: "Aufgaben" });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-07-22T12:00:00.000Z"));
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
