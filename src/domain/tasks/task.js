const TASK_TYPES = ["task", "deadline", "project"];

export const TASK_TYPE_LABELS = {
  task: "Aufgabe",
  deadline: "Deadline",
  project: "Projekt",
};

export function normalizeTaskTypeValue(type) {
  return TASK_TYPES.includes(type) ? type : "task";
}

export function normalizeTaskType(task) {
  return normalizeTaskTypeValue(task?.type);
}

export function normalizeTask(rawTask) {
  const type = normalizeTaskType(rawTask);
  const normalized = { ...(rawTask || {}), type };
  if (type === "project") {
    normalized.deletedAt = normalized.deletedAt || normalized.archivedAt || null;
    normalized.isPinned = Boolean(normalized.isPinned ?? normalized.pinned);
    delete normalized.pinned;
  }
  return normalized;
}

export function normalizeTasks(tasks) {
  return Array.isArray(tasks) ? tasks.map(normalizeTask) : [];
}

export function cleanTaskAfterTypeChange(task) {
  const cleaned = normalizeTask(task);
  if (cleaned.type === "project") {
    delete cleaned.parentProjectId;
  }
  if (cleaned.type !== "project") {
    delete cleaned.projectMeta;
    delete cleaned.manualProgress;
    delete cleaned.subTasks;
    delete cleaned.subTaskIds;
    delete cleaned.projectStatus;
    delete cleaned.projectNotes;
    delete cleaned.deletedAt;
    delete cleaned.archivedAt;
  }
  return cleaned;
}

export function isProjectDeleted(project) {
  return Boolean(project?.deletedAt || project?.archivedAt);
}

export function getTaskMilestones(task) {
  return [
    task.dueDate ? { label: "Abgabe", date: task.dueDate } : null,
    task.acceptanceDate ? { label: "Abnahme", date: task.acceptanceDate } : null,
  ]
    .filter(Boolean)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

export function getNextTaskMilestone(task) {
  if (normalizeTaskType(task) === "project") return null;
  const milestones = getTaskMilestones(task);
  return milestones[0] || null;
}

export function getTaskDeadlineDate(task) {
  if (normalizeTaskType(task) === "project") return null;
  return task?.acceptanceDate || task?.dueDate || null;
}

export function getTaskSortTimestamp(task) {
  return new Date(task.acceptanceDate || task.nextRelevantDate || task.dueDate || task.createdAt || 0).getTime();
}

export function isTaskDone(task) {
  return task?.completed === true || task?.done === true || task?.status === "done" || task?.status === "erledigt";
}

export function isTaskArchived(task) {
  if (task.archived) return true;
  if (task.status !== "erledigt") return false;
  if (!task.acceptanceDate) return false;
  const acceptance = new Date(task.acceptanceDate);
  acceptance.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return acceptance.getTime() <= today.getTime();
}

export function isPlannerTask(task) {
  return normalizeTaskType(task) !== "project" && !isProjectDeleted(task) && !isTaskArchived(task);
}

export function isTimerResolvableTask(task) {
  return Boolean(task?.id) && !isProjectDeleted(task) && !isTaskArchived(task);
}

export function isDeadlineListTask(task) {
  return isPlannerTask(task) && Boolean(getTaskDeadlineDate(task));
}
