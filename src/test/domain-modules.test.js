import { describe, expect, it } from "vitest";
import {
  cleanTaskAfterTypeChange,
  isDeadlineListTask,
  normalizeTask,
  normalizeTaskTypeValue,
} from "@/domain/tasks/task";
import {
  getProjectProgress,
  getProjectSubTasks,
  getProjectWorkSummary,
} from "@/domain/projects/project";
import {
  compareDeadlineTasks,
  normalizeDeadlineWidgetSettings,
} from "@/domain/deadlines/deadline";
import {
  DASHBOARD_PRESET_DEFAULT_LAYOUTS,
  DEFAULT_DASHBOARD_LAYOUT,
  normalizeAppSettings,
  normalizeDashboardTileLayout,
} from "@/features/dashboard/config";

describe("Task-, Deadline- und Projektmodule", () => {
  it("normalisiert Formularwerte fÃ¼r alle unterstÃ¼tzten Aufgabentypen", () => {
    expect(normalizeTaskTypeValue("task")).toBe("task");
    expect(normalizeTaskTypeValue("deadline")).toBe("deadline");
    expect(normalizeTaskTypeValue("project")).toBe("project");
    expect(normalizeTaskTypeValue("unknown")).toBe("task");
  });

  it("normalisiert Legacy-Projektfelder und entfernt Projektfelder beim Typwechsel", () => {
    expect(normalizeTask({ type: "project", archivedAt: "2026-07-20", pinned: 1 })).toMatchObject({
      type: "project",
      deletedAt: "2026-07-20",
      isPinned: true,
    });

    expect(cleanTaskAfterTypeChange({ type: "task", projectMeta: {}, subTaskIds: ["task-1"] })).not.toHaveProperty("projectMeta");
  });

  it("verwendet kanonische Projektverknüpfungen für Fortschritt und Arbeitsstand", () => {
    const project = { id: "project-1", type: "project" };
    const tasks = [
      { id: "task-1", parentProjectId: "project-1", status: "erledigt" },
      { id: "task-2", parentProjectId: "project-1", status: "offen" },
      { id: "task-3", parentProjectId: "other-project", status: "offen" },
    ];

    expect(getProjectSubTasks(project, tasks)).toHaveLength(2);
    expect(getProjectProgress(project, tasks)).toBe(50);
    expect(getProjectWorkSummary(project, tasks)).toEqual({
      label: "1 Teilaufgaben offen",
      openCount: 1,
      totalCount: 2,
    });
  });

  it("erkennt Deadline-Aufgaben und erhält Legacy-Sortiereinstellungen", () => {
    expect(isDeadlineListTask({ id: "deadline-1", type: "deadline", dueDate: "2026-07-25", status: "offen" })).toBe(true);
    expect(normalizeDeadlineWidgetSettings({ activeFilter: "urgent" })).toEqual({ sortBy: "urgent" });

    const urgent = { title: "Später", dueDate: "2026-07-30", urgent: true };
    const regular = { title: "Früher", dueDate: "2026-07-24", urgent: false };
    expect(compareDeadlineTasks(urgent, regular, "urgent")).toBeLessThan(0);
  });
});

describe("Dashboard-Konfiguration", () => {
  it("ergänzt fehlende Widgets und behält die gespeicherte Reihenfolge", () => {
    const layout = normalizeDashboardTileLayout([
      { id: "projects", x: 0, y: 0, colSpan: 4, rowSpan: 2 },
    ]);

    expect(layout[0].id).toBe("projects");
    expect(layout.map((item) => item.id)).toEqual(expect.arrayContaining(DEFAULT_DASHBOARD_LAYOUT));
    expect(DASHBOARD_PRESET_DEFAULT_LAYOUTS.focus.find((item) => item.id === "done")).toMatchObject({ x: 6, y: 8 });
  });

  it("normalisiert App-Einstellungen ohne andere Einstellungsfelder zu verlieren", () => {
    const settings = normalizeAppSettings({ appearance: "dark", deadlineWidget: { activeFilter: "urgent" } });

    expect(settings.appearance).toBe("dark");
    expect(settings.deadlineWidget).toEqual({ sortBy: "urgent" });
    expect(settings.dashboardLayout).toEqual(DEFAULT_DASHBOARD_LAYOUT);
  });
});
