import { TEST_USER_ID } from "@/test/fixtures/plannerData";
import { POSTGRES_INTEGER_MAX } from "@/domain/study/integer";
import { toIsoDateTimeOrNull } from "@/infrastructure/supabase/dateMapping";
import {
  calculateAccumulatedPauseSeconds,
  mapTimerSessionCreate,
  mapTimerSessionRow,
} from "@/infrastructure/supabase/timerSessionRepository";
import {
  mapStudyTimeEntryCreate,
  mapStudyTimeEntryPatch,
  mapStudyTimeEntryRow,
} from "@/infrastructure/supabase/studyTimeRepository";

const futureSession = {
  access_token: "kan71-repository-token",
  expires_at: 4102444800,
  user: { id: TEST_USER_ID, email: "kan71-repository@example.test" },
};

const timerRow = {
  id: "timer-1",
  user_id: TEST_USER_ID,
  semester_id: "semester-1",
  subject_id: "subject-1",
  mode: "pomodoro",
  preset_minutes: 25,
  started_at: "2026-08-14T10:00:00.000Z",
  paused_at: "2026-08-14T10:10:00.000Z",
  total_pause_seconds: 120,
  status: "paused",
  created_at: "2026-08-14T10:00:00.000Z",
  updated_at: "2026-08-14T10:10:00.000Z",
};

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "",
    headers: { get: (name) => name.toLowerCase() === "content-type" ? "application/json" : "" },
    text: async () => JSON.stringify(payload),
  };
}

function emptyResponse(status = 204) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "",
    headers: { get: () => "" },
    text: async () => "",
  };
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("VITE_SUPABASE_URL", "https://kan71.supabase.test");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "kan71-anon-key");
  vi.stubEnv("VITE_DEBUG_SYNC", "false");
  localStorage.setItem("sb-auth-session", JSON.stringify(futureSession));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Timer-Repository-Mappings und Pausengrenzen", () => {
  it("mappt Status-, Datums- und Fachwerte ohne Informationsverlust", () => {
    expect(mapTimerSessionRow(timerRow)).toEqual({
      id: "timer-1",
      userId: TEST_USER_ID,
      semesterId: "semester-1",
      subjectId: "subject-1",
      mode: "pomodoro",
      presetMinutes: 25,
      startedAt: "2026-08-14T10:00:00.000Z",
      pausedAt: "2026-08-14T10:10:00.000Z",
      totalPauseSeconds: 120,
      status: "paused",
      createdAt: "2026-08-14T10:00:00.000Z",
      updatedAt: "2026-08-14T10:10:00.000Z",
    });
  });

  it("bindet neue Timer-Sitzungen an Benutzer und Fach und begrenzt Presets", () => {
    expect(mapTimerSessionCreate(TEST_USER_ID, "subject-1", {
      semesterId: "semester-1",
      mode: "pomodoro",
      presetMinutes: POSTGRES_INTEGER_MAX + 10,
    }, "2026-08-14T12:00:00.000Z")).toEqual({
      user_id: TEST_USER_ID,
      semester_id: "semester-1",
      subject_id: "subject-1",
      mode: "pomodoro",
      preset_minutes: POSTGRES_INTEGER_MAX,
      started_at: "2026-08-14T12:00:00.000Z",
      paused_at: null,
      total_pause_seconds: 0,
      status: "running",
    });
  });

  it("verweigert neue Timer-Sitzungen ohne Semester-ID", () => {
    expect(() => mapTimerSessionCreate(TEST_USER_ID, "subject-1")).toThrow(
      "semesterId ist für Timer-Sitzungen erforderlich",
    );
  });

  it("addiert normale und wiederholte Pausen sekundengenau", () => {
    expect(calculateAccumulatedPauseSeconds({
      totalPauseSeconds: 90,
      pausedAt: "2026-08-14T10:00:00.000Z",
    }, Date.parse("2026-08-14T10:05:30.000Z"))).toBe(420);
  });

  it("verhindert einen PostgreSQL-Integer-Überlauf bei extrem langen Pausen", () => {
    expect(calculateAccumulatedPauseSeconds({
      totalPauseSeconds: POSTGRES_INTEGER_MAX - 5,
      pausedAt: "2026-08-14T10:00:00.000Z",
    }, Date.parse("2026-08-14T10:01:00.000Z"))).toBe(POSTGRES_INTEGER_MAX);
  });

  it("behält bei ungültigem Pause-Zeitstempel den sicheren bisherigen Wert", () => {
    expect(calculateAccumulatedPauseSeconds({
      totalPauseSeconds: 75,
      pausedAt: "kein-datum",
    }, Date.parse("2026-08-14T10:01:00.000Z"))).toBe(75);
  });
});

describe("Lernzeit-Repository-Mappings", () => {
  it("verwendet eine gemeinsame konsistente Datums-/Null-Normalisierung", () => {
    expect(toIsoDateTimeOrNull(null)).toBeNull();
    expect(toIsoDateTimeOrNull(0)).toBeNull();
    expect(toIsoDateTimeOrNull("ungültig")).toBeNull();
    expect(toIsoDateTimeOrNull("2026-08-14T11:00:00+02:00")).toBe("2026-08-14T09:00:00.000Z");
  });

  it("erhält Benutzer-, Fach-, Themen- und Aufgabenbezüge", () => {
    const row = {
      id: "entry-1",
      user_id: TEST_USER_ID,
      semester_id: "semester-1",
      subject_id: "subject-1",
      topic_id: "topic-1",
      task_id: "task-1",
      duration_minutes: 45,
      source: "stopwatch",
      notes: "Übung",
      activity_type: "aufgaben geübt",
      confidence: "sicher",
      review_updated: true,
      recorded_at: "2026-08-14T11:00:00.000Z",
      created_at: "2026-08-14T11:01:00.000Z",
      updated_at: "2026-08-14T11:02:00.000Z",
    };

    expect(mapStudyTimeEntryRow(row)).toEqual({
      id: "entry-1",
      userId: TEST_USER_ID,
      semesterId: "semester-1",
      subjectId: "subject-1",
      topicId: "topic-1",
      taskId: "task-1",
      durationMinutes: 45,
      source: "stopwatch",
      notes: "Übung",
      activityType: "exercises_practiced",
      confidence: "confident",
      reviewUpdated: true,
      recordedAt: "2026-08-14T11:00:00.000Z",
      createdAt: "2026-08-14T11:01:00.000Z",
      updatedAt: "2026-08-14T11:02:00.000Z",
    });
  });

  it("mappt Create und Patch explizit und begrenzt Integer-Minuten", () => {
    expect(mapStudyTimeEntryCreate(TEST_USER_ID, {
      id: "entry-1",
      semesterId: "semester-1",
      subjectId: "subject-1",
      topicId: "topic-1",
      taskId: "task-1",
      durationMinutes: POSTGRES_INTEGER_MAX + 1,
      source: "pomodoro",
      activityType: "wiederholung",
      confidence: "okay",
      reviewUpdated: true,
      recordedAt: "2026-08-14T11:00:00.000Z",
    })).toEqual(expect.objectContaining({
      user_id: TEST_USER_ID,
      semester_id: "semester-1",
      subject_id: "subject-1",
      topic_id: "topic-1",
      task_id: "task-1",
      duration_minutes: POSTGRES_INTEGER_MAX,
      source: "pomodoro",
      activity_type: "review_done",
      confidence: "okay",
      review_updated: true,
      recorded_at: "2026-08-14T11:00:00.000Z",
    }));

    expect(mapStudyTimeEntryPatch({
      topicId: null,
      taskId: "task-2",
      durationMinutes: 30.6,
      recordedAt: "ungültig",
    })).toEqual({
      duration_minutes: 31,
      task_id: "task-2",
      topic_id: null,
      recorded_at: null,
    });
  });

  it("weist ungültige Dauerwerte vor einem Datenbankaufruf zurück", () => {
    expect(() => mapStudyTimeEntryCreate(TEST_USER_ID, {
      semesterId: "semester-1",
      subjectId: "subject-1",
      durationMinutes: Number.NaN,
    })).toThrow("durationMinutes muss größer als 0 sein");

    for (const durationMinutes of [undefined, Number.NaN, Number.POSITIVE_INFINITY, 0, -1]) {
      expect(() => mapStudyTimeEntryPatch({ durationMinutes })).toThrow(
        "durationMinutes muss größer als 0 sein",
      );
    }
  });
});

describe("Timer- und Lernzeit-Repository-Grenzen", () => {
  it("führt Start, Pause, Fortsetzen, Beenden und Abbrechen benutzerbegrenzt aus", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-14T10:15:00.000Z"));
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([{ ...timerRow, status: "running", paused_at: null }]))
      .mockResolvedValueOnce(jsonResponse([{ ...timerRow, status: "paused" }]))
      .mockResolvedValueOnce(jsonResponse([timerRow]))
      .mockResolvedValueOnce(jsonResponse([{ ...timerRow, status: "running", paused_at: null, total_pause_seconds: 420 }]))
      .mockResolvedValueOnce(jsonResponse([{ ...timerRow, status: "finished", paused_at: null }]))
      .mockResolvedValueOnce(jsonResponse([{ ...timerRow, status: "cancelled", paused_at: null }]));
    vi.stubGlobal("fetch", fetchMock);
    const repository = await import("@/infrastructure/supabase/timerSessionRepository");

    await repository.startTimerSession(TEST_USER_ID, "subject-1", { semesterId: "semester-1", mode: "stopwatch" });
    await repository.pauseTimerSession(TEST_USER_ID, "timer-1");
    await repository.resumeTimerSession(TEST_USER_ID, "timer-1");
    await repository.finishTimerSession(TEST_USER_ID, "timer-1");
    await repository.cancelTimerSession(TEST_USER_ID, "timer-1");

    expect(fetchMock).toHaveBeenCalledTimes(7);
    const calls = fetchMock.mock.calls.map(([url, options]) => ({ url, method: options.method, body: options.body }));
    expect(calls[0].url).toContain("semester_id=eq.semester-1");
    expect(calls[1]).toEqual(expect.objectContaining({ method: "POST" }));
    expect(calls[1].body).toContain('"semester_id":"semester-1"');
    expect(calls[2].url).toContain("id=eq.timer-1&user_id=eq.");
    expect(calls[2].body).toContain('"status":"paused"');
    expect(calls[4].body).toContain('"total_pause_seconds":420');
    expect(calls[5].body).toBe('{"status":"finished","paused_at":null}');
    expect(calls[6].body).toBe('{"status":"cancelled","paused_at":null}');
  });

  it("begrenzt Lernzeit-Löschungen auf Eintrag und Benutzer", async () => {
    const fetchMock = vi.fn().mockResolvedValue(emptyResponse());
    vi.stubGlobal("fetch", fetchMock);
    const repository = await import("@/infrastructure/supabase/studyTimeRepository");

    await repository.deleteStudyTimeEntry(TEST_USER_ID, "entry-1", { semesterId: "semester-1" });

    expect(fetchMock.mock.calls[0][0]).toBe(
      `https://kan71.supabase.test/rest/v1/study_time_entries?id=eq.entry-1&user_id=eq.${TEST_USER_ID}&semester_id=eq.semester-1`,
    );
    expect(fetchMock.mock.calls[0][1]).toEqual(expect.objectContaining({ method: "DELETE" }));
  });

  it("aggregiert Themen- und Fachzeiten weiterhin getrennt", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse([{ duration_minutes: 10 }, { duration_minutes: 25 }]))
      .mockResolvedValueOnce(jsonResponse([{ duration_minutes: 40 }]));
    vi.stubGlobal("fetch", fetchMock);
    const repository = await import("@/infrastructure/supabase/studyTimeRepository");

    await expect(repository.getTotalTimeForTopic(TEST_USER_ID, "topic-1")).resolves.toBe(35);
    await expect(repository.getTotalTimeForSubject(TEST_USER_ID, "subject-1")).resolves.toBe(40);
    expect(fetchMock.mock.calls[0][0]).toContain(`user_id=eq.${TEST_USER_ID}&topic_id=eq.topic-1`);
    expect(fetchMock.mock.calls[1][0]).toContain(`user_id=eq.${TEST_USER_ID}&subject_id=eq.subject-1`);
  });
});
