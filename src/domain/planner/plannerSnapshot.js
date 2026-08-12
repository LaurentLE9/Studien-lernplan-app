import { normalizeTasks } from "@/domain/tasks/task";
import {
  normalizeAppSettings,
} from "@/features/dashboard/config";

export function normalizePlannerSettings(rawSettings = {}) {
  const safeSettings = rawSettings && typeof rawSettings === "object" ? rawSettings : {};
  const appearance = safeSettings.appearance
    || (typeof safeSettings.darkMode === "boolean"
      ? (safeSettings.darkMode ? "dark" : "light")
      : "light");

  return {
    ...safeSettings,
    ...normalizeAppSettings({ ...safeSettings, appearance }),
  };
}

export function normalizeDefaultData() {
  return {
    subjects: [],
    topics: [],
    tasks: [],
    studySessions: [],
    exams: [],
    todayFocus: [],
    settings: normalizePlannerSettings(),
    seeds: { tasks: false, sessions: false },
  };
}

export function normalizePlannerSnapshot(rawSnapshot = {}) {
  const safeSnapshot = rawSnapshot && typeof rawSnapshot === "object" ? rawSnapshot : {};
  const defaults = normalizeDefaultData();

  return {
    ...defaults,
    ...safeSnapshot,
    tasks: normalizeTasks(safeSnapshot.tasks),
    settings: normalizePlannerSettings(safeSnapshot.settings),
    seeds: {
      ...defaults.seeds,
      ...(safeSnapshot.seeds && typeof safeSnapshot.seeds === "object" ? safeSnapshot.seeds : {}),
    },
  };
}
