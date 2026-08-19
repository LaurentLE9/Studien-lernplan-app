export const ACTIVE_SEMESTER_STORAGE_KEY = "study_planner_active_semester";

export function getSemesterSubjectIds(subjects = [], semesterId) {
  if (!semesterId) return new Set();
  return new Set(
    subjects
      .filter((subject) => subject?.semesterId === semesterId || subject?.groupId === semesterId)
      .map((subject) => subject.id)
      .filter(Boolean),
  );
}

export function filterBySemester(items = [], subjectIds, subjectIdKey = "subjectId") {
  if (!(subjectIds instanceof Set)) return [];
  return items.filter((item) => subjectIds.has(item?.[subjectIdKey]));
}

export function resolveActiveSemesterId(semesters = [], storedId = "") {
  if (!Array.isArray(semesters) || semesters.length === 0) return "";
  return semesters.some((semester) => semester.id === storedId)
    ? storedId
    : semesters[0].id;
}

export function readPersistedActiveSemesterId(userId) {
  if (typeof window === "undefined" || !userId) return "";
  try {
    return window.localStorage.getItem(`${ACTIVE_SEMESTER_STORAGE_KEY}:${userId}`) || "";
  } catch {
    return "";
  }
}

export function persistActiveSemesterId(userId, semesterId) {
  if (typeof window === "undefined" || !userId || !semesterId) return;
  try {
    window.localStorage.setItem(`${ACTIVE_SEMESTER_STORAGE_KEY}:${userId}`, semesterId);
  } catch {
    // Local persistence is best effort; cloud settings remain authoritative.
  }
}