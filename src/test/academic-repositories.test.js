import { TEST_USER_ID } from "@/test/fixtures/plannerData";
import { mapSemesterRow, mapSemesterWrite } from "@/infrastructure/supabase/semesterRepository";
import {
  mapSubjectCreate,
  mapSubjectPatch,
  mapSubjectRow,
} from "@/infrastructure/supabase/subjectRepository";
import {
  mapTopicCreate,
  mapTopicPatch,
  mapTopicRow,
} from "@/infrastructure/supabase/topicRepository";
import {
  mapExamCreate,
  mapExamPatch,
  mapExamRow,
} from "@/infrastructure/supabase/examRepository";

const futureSession = {
  access_token: "academic-repository-token",
  expires_at: 4102444800,
  user: { id: TEST_USER_ID, email: "academic-repository@example.test" },
};

function emptyResponse(status = 204) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "",
    headers: { get: () => "" },
    json: async () => null,
    text: async () => "",
  };
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("VITE_SUPABASE_URL", "https://kan70.supabase.test");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "kan70-anon-key");
  vi.stubEnv("VITE_DEBUG_SYNC", "false");
  localStorage.setItem("sb-auth-session", JSON.stringify(futureSession));
});

describe("Akademische Repository-Mappings", () => {
  it("mappt Semester in beide Richtungen ohne Benutzergrenze zu verlieren", () => {
    expect(mapSemesterWrite({
      name: "Wintersemester",
      startDate: "2026-10-01",
      endDate: "2027-03-31",
    })).toEqual({
      name: "Wintersemester",
      start_date: "2026-10-01",
      end_date: "2027-03-31",
    });
    expect(mapSemesterRow({
      id: "semester-1",
      name: "Wintersemester",
      start_date: "2026-10-01",
      end_date: "2027-03-31",
      user_id: TEST_USER_ID,
      created_at: "2026-08-14T10:00:00.000Z",
      ignored: "not-selected",
    })).toEqual({
      id: "semester-1",
      name: "Wintersemester",
      start_date: "2026-10-01",
      end_date: "2027-03-31",
      user_id: TEST_USER_ID,
      created_at: "2026-08-14T10:00:00.000Z",
    });
  });

  it("bindet ein Fach beim Erstellen explizit an Benutzer und Semester", () => {
    const row = mapSubjectCreate(TEST_USER_ID, {
      id: "subject-1",
      semesterId: "semester-1",
      name: "Softwaretechnik",
      color: "#123456",
      targetHours: 42,
    });

    expect(row).toEqual(expect.objectContaining({
      id: "subject-1",
      user_id: TEST_USER_ID,
      semester_id: "semester-1",
      target_hours: 42,
      is_archived: false,
    }));
    expect(mapSubjectPatch({ semesterId: "semester-2", name: "Architektur" })).toEqual({
      semester_id: "semester-2",
      name: "Architektur",
    });
    expect(mapSubjectPatch({ name: "Nur Name" })).not.toHaveProperty("user_id");
    expect(mapSubjectRow({ ...row, created_at: "now", updated_at: "now" })).toEqual(expect.objectContaining({
      user_id: TEST_USER_ID,
      semester_id: "semester-1",
    }));
  });

  it("bindet Themen explizit an Benutzer und Fach und normalisiert Fortschritt", () => {
    const row = mapTopicCreate(TEST_USER_ID, {
      id: "topic-1",
      semesterId: "semester-1",
      subjectId: "subject-1",
      title: "Repository Pattern",
      status: "lernen",
      confidence: "sicher",
      reviewCount: 2,
    });

    expect(row).toEqual(expect.objectContaining({
      user_id: TEST_USER_ID,
      semester_id: "semester-1",
      subject_id: "subject-1",
      status: "active",
      confidence: "confident",
      review_count: 2,
    }));
    expect(mapTopicPatch({ status: "archiviert", completed: true })).toEqual({
      status: "archived",
      completed: true,
    });
    expect(mapTopicPatch({ title: "Nur Titel" })).not.toHaveProperty("user_id");
    expect(mapTopicRow({ ...row, created_at: "now", updated_at: "now" })).toEqual(expect.objectContaining({
      user_id: TEST_USER_ID,
      semester_id: "semester-1",
      subject_id: "subject-1",
    }));
  });

  it("mappt Prüfungen verlustfrei zwischen Domain- und Datenbankformat", () => {
    const row = mapExamCreate(TEST_USER_ID, {
      id: "exam-1",
      semesterId: "semester-1",
      subjectId: "subject-1",
      title: "Klausur",
      examDate: "2026-09-01",
      examTime: "10:00",
      location: "A101",
      notes: "Taschenrechner",
      status: "written",
      isArchived: true,
    });

    expect(row).toEqual({
      id: "exam-1",
      user_id: TEST_USER_ID,
      semester_id: "semester-1",
      subject_id: "subject-1",
      title: "Klausur",
      exam_date: "2026-09-01",
      exam_time: "10:00",
      location: "A101",
      notes: "Taschenrechner",
      status: "written",
      is_archived: true,
    });
    expect(mapExamRow({ ...row, created_at: "created", updated_at: "updated" })).toEqual({
      id: "exam-1",
      userId: TEST_USER_ID,
      semesterId: "semester-1",
      subjectId: "subject-1",
      title: "Klausur",
      examDate: "2026-09-01",
      examTime: "10:00",
      location: "A101",
      notes: "Taschenrechner",
      status: "written",
      isArchived: true,
      createdAt: "created",
      updatedAt: "updated",
    });
    expect(mapExamPatch({ status: "open", isArchived: false })).toEqual({
      status: "open",
      is_archived: false,
    });
  });
});

describe("Akademische Repository-Grenzen", () => {
  it("begrenzt Themen-Lesen und -Ändern auf das aktive Semester", async () => {
    const fetchMock = vi.fn().mockResolvedValue(emptyResponse());
    vi.stubGlobal("fetch", fetchMock);
    const repository = await import("@/infrastructure/supabase/topicRepository");

    await repository.loadTopics(TEST_USER_ID, { semesterId: "semester-1" });
    await repository.updateTopicRecord(TEST_USER_ID, "topic-1", { completed: true }, { semesterId: "semester-1" });

    expect(fetchMock.mock.calls[0][0]).toContain(`user_id=eq.${TEST_USER_ID}&semester_id=eq.semester-1`);
    expect(fetchMock.mock.calls[1][0]).toContain(`id=eq.topic-1&user_id=eq.${TEST_USER_ID}&semester_id=eq.semester-1`);
  });

  it.each([
    ["Semester", () => import("@/infrastructure/supabase/semesterRepository"), "deleteSemester", "semesters", "semester-1", false],
    ["Fach", () => import("@/infrastructure/supabase/subjectRepository"), "deleteSubjectRecord", "subjects", "subject-1", true],
    ["Thema", () => import("@/infrastructure/supabase/topicRepository"), "deleteTopicRecord", "topics", "topic-1", true],
    ["Prüfung", () => import("@/infrastructure/supabase/examRepository"), "deleteExamRecord", "exams", "exam-1", true],
  ])("begrenzt %s-Löschungen auf Datensatz, Benutzer und gegebenenfalls Semester", async (_label, loadRepository, exportName, table, recordId, semesterScoped) => {
    const fetchMock = vi.fn().mockResolvedValue(emptyResponse());
    vi.stubGlobal("fetch", fetchMock);
    const repository = await loadRepository();

    await repository[exportName](TEST_USER_ID, recordId, { semesterId: "semester-1" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      `https://kan70.supabase.test/rest/v1/${table}?id=eq.${recordId}&user_id=eq.${TEST_USER_ID}${semesterScoped ? "&semester_id=eq.semester-1" : ""}`,
    );
    expect(fetchMock.mock.calls[0][1]).toEqual(expect.objectContaining({ method: "DELETE" }));
  });
});
