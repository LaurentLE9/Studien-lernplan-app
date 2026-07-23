import {
  isProjectDeleted,
  isTaskArchived,
  isTaskDone,
  normalizeTaskType,
} from "@/domain/tasks/task";

export function isProjectTask(task) {
  return normalizeTaskType(task) === "project" && !isProjectDeleted(task) && !isTaskDone(task);
}

export function isCompletedProjectTask(task) {
  return normalizeTaskType(task) === "project" && !isProjectDeleted(task) && isTaskDone(task);
}

export function isDeletedProjectTask(task) {
  return normalizeTaskType(task) === "project" && isProjectDeleted(task);
}

export function getProjectSubTasks(projectTask, allTasks = []) {
  if (!projectTask?.id) return [];
  const isActiveSubTask = (task) => task?.id && normalizeTaskType(task) !== "project" && !isProjectDeleted(task) && !isTaskArchived(task);
  const canonicalTasks = allTasks.filter((task) => task.parentProjectId === projectTask.id && isActiveSubTask(task));
  if (canonicalTasks.length > 0) return canonicalTasks;
  if (Array.isArray(projectTask.subTaskIds)) {
    const legacyTasks = allTasks.filter((task) => projectTask.subTaskIds.includes(task.id) && isActiveSubTask(task));
    if (legacyTasks.length > 0) return legacyTasks;
  }
  if (Array.isArray(projectTask.subTasks)) return projectTask.subTasks.filter(isActiveSubTask);
  return [];
}

export function getProjectProgress(projectTask, allTasks = []) {
  if (!projectTask || normalizeTaskType(projectTask) !== "project") return 0;
  const subTasks = getProjectSubTasks(projectTask, allTasks);
  if (subTasks.length > 0) {
    return Math.round((subTasks.filter(isTaskDone).length / subTasks.length) * 100);
  }
  return 0;
}

export function getProjectWorkSummary(projectTask, allTasks = []) {
  const subTasks = getProjectSubTasks(projectTask, allTasks);
  if (subTasks.length > 0) {
    const open = subTasks.filter((task) => !isTaskDone(task)).length;
    return { label: `${open} Teilaufgaben offen`, openCount: open, totalCount: subTasks.length };
  }
  return { label: "Keine Teilaufgaben", openCount: 0, totalCount: 0 };
}
