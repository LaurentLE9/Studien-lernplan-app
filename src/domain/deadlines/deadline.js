export const DEADLINE_SORT_OPTIONS = [
  { id: "due", label: "Fälligkeit" },
  { id: "acceptance", label: "Abnahme" },
  { id: "urgent", label: "Dringend" },
  { id: "priority", label: "Priorität" },
];

const DEADLINE_DEFAULT_SORT = "due";
const PRIORITY_SORT_RANK = { hoch: 0, mittel: 1, niedrig: 2 };

export function normalizeDeadlineWidgetSettings(value) {
  const legacyFilterToSort = {
    all: "due",
    open: "due",
    today: "due",
    next3: "due",
    urgent: "urgent",
  };
  const isValid = (sortId) => DEADLINE_SORT_OPTIONS.some((option) => option.id === sortId);
  const legacySort = legacyFilterToSort[value?.activeFilter] || legacyFilterToSort[value?.defaultFilter];
  const candidate = value?.sortBy || value?.activeSort || legacySort;
  return {
    sortBy: isValid(candidate) ? candidate : DEADLINE_DEFAULT_SORT,
  };
}

export function getDeadlineDateTimestamp(task) {
  return new Date(task.nextRelevantDate || task.dueDate || task.acceptanceDate || "2999-12-31").getTime();
}

function getDeadlineAcceptanceTimestamp(task) {
  return new Date(task.acceptanceDate || task.nextRelevantDate || task.dueDate || "2999-12-31").getTime();
}

export function compareDeadlineTasks(a, b, sortBy) {
  if (sortBy === "acceptance") {
    const aHasAcceptance = Boolean(a.acceptanceDate);
    const bHasAcceptance = Boolean(b.acceptanceDate);
    if (aHasAcceptance !== bHasAcceptance) return aHasAcceptance ? -1 : 1;
    const acceptanceDiff = getDeadlineAcceptanceTimestamp(a) - getDeadlineAcceptanceTimestamp(b);
    if (acceptanceDiff !== 0) return acceptanceDiff;
  }

  if (sortBy === "urgent") {
    const urgentDiff = Number(Boolean(b.urgent)) - Number(Boolean(a.urgent));
    if (urgentDiff !== 0) return urgentDiff;
  }

  if (sortBy === "priority") {
    const priorityDiff = (PRIORITY_SORT_RANK[a.priority] ?? 99) - (PRIORITY_SORT_RANK[b.priority] ?? 99);
    if (priorityDiff !== 0) return priorityDiff;
  }

  const deadlineDiff = getDeadlineDateTimestamp(a) - getDeadlineDateTimestamp(b);
  if (deadlineDiff !== 0) return deadlineDiff;

  return (a.title || "").localeCompare(b.title || "", "de");
}
