import {
  ACTIVE_SEMESTER_STORAGE_KEY,
  filterBySemester,
  getSemesterSubjectIds,
  persistActiveSemesterId,
  readPersistedActiveSemesterId,
  resolveActiveSemesterId,
} from "@/domain/academics/semesterScope";

describe("Semester-Scope", () => {
  const subjects = [
    { id: "subject-a", semesterId: "semester-a" },
    { id: "subject-b", semesterId: "semester-b" },
  ];

  it("filters relationale Daten ausschließlich über Fächer des aktiven Semesters", () => {
    const subjectIds = getSemesterSubjectIds(subjects, "semester-a");

    expect(filterBySemester([
      { id: "task-a", subjectId: "subject-a" },
      { id: "task-b", subjectId: "subject-b" },
    ], subjectIds)).toEqual([{ id: "task-a", subjectId: "subject-a" }]);
  });

  it("startet ein neues oder ungültig gespeichertes Semester mit dem ersten vorhandenen Semester", () => {
    const semesters = [{ id: "semester-a" }, { id: "semester-b" }];

    expect(resolveActiveSemesterId(semesters, "")).toBe("semester-a");
    expect(resolveActiveSemesterId(semesters, "missing")).toBe("semester-a");
    expect(resolveActiveSemesterId(semesters, "semester-b")).toBe("semester-b");
    expect(resolveActiveSemesterId([], "semester-a")).toBe("");
  });

  it("persistiert die Auswahl pro Benutzer und stellt den Rückwechsel verlustfrei dar", () => {
    const userId = "user-1";
    persistActiveSemesterId(userId, "semester-b");

    expect(localStorage.getItem(`${ACTIVE_SEMESTER_STORAGE_KEY}:${userId}`)).toBe("semester-b");
    expect(readPersistedActiveSemesterId(userId)).toBe("semester-b");
    expect(filterBySemester([
      { id: "task-a", subjectId: "subject-a" },
      { id: "task-b", subjectId: "subject-b" },
    ], getSemesterSubjectIds(subjects, resolveActiveSemesterId([
      { id: "semester-a" },
      { id: "semester-b" },
    ], readPersistedActiveSemesterId(userId))))).toEqual([{ id: "task-b", subjectId: "subject-b" }]);
  });
});