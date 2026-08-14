import { TEST_USER_ID } from "@/test/fixtures/plannerData";
import {
  buildPlannerSnapshotUpsert,
  readPlannerSnapshotRow,
} from "@/infrastructure/supabase/plannerSnapshotMapper";

const futureSession = {
  access_token: "cloud-test-token",
  expires_at: 4102444800,
  user: { id: TEST_USER_ID, email: "kan35@example.test" },
};

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "",
    headers: { get: () => "application/json" },
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  };
}

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

async function importCloudStore() {
  vi.resetModules();
  vi.stubEnv("VITE_SUPABASE_URL", "https://kan35.supabase.test");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "kan35-anon-key");
  vi.stubEnv("VITE_DEBUG_SYNC", "false");
  return import("@/lib/cloudStore");
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-07-22T12:00:00.000Z"));
  localStorage.setItem("sb-auth-session", JSON.stringify(futureSession));
});

describe("Fetch-Response-Mock", () => {
  it.each([200, 204, 299])("markiert den 2xx-Status %i als erfolgreich", (status) => {
    expect(emptyResponse(status).ok).toBe(true);
  });

  it.each([400, 404, 500])("markiert den Fehlerstatus %i als nicht erfolgreich", (status) => {
    expect(emptyResponse(status).ok).toBe(false);
  });
});

describe("Supabase-Planner-Transformationen", () => {
  it("lädt Planner-Daten über die authentifizierte Grenze und normalisiert bestehende Projektdaten", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([{
      data: {
        compatibleRootField: { futureVersion: 2 },
        subjects: [{ id: "subject-1", name: "Softwaretechnik" }],
        tasks: [{
          id: "legacy-project",
          type: "project",
          title: "Legacy-Projekt",
          archivedAt: "2026-07-01T00:00:00.000Z",
          pinned: 1,
          customMarker: "preserved",
        }],
        settings: {
          darkMode: true,
          sidebarCollapsed: true,
          compatibleSetting: "preserved",
        },
        seeds: { tasks: true, compatibleSeed: "preserved" },
      },
    }]));
    vi.stubGlobal("fetch", fetchMock);
    const { loadUserPlannerData } = await importCloudStore();

    const result = await loadUserPlannerData(TEST_USER_ID);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      `https://kan35.supabase.test/rest/v1/user_plans?user_id=eq.${TEST_USER_ID}&select=data`,
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          apikey: "kan35-anon-key",
          Authorization: "Bearer cloud-test-token",
        }),
      }),
    );
    expect(result.tasks).toEqual([expect.objectContaining({
      id: "legacy-project",
      type: "project",
      deletedAt: "2026-07-01T00:00:00.000Z",
      isPinned: true,
      customMarker: "preserved",
    })]);
    expect(result.tasks[0]).not.toHaveProperty("pinned");
    expect(result.settings).toEqual(expect.objectContaining({
      appearance: "dark",
      sidebarCollapsed: true,
      compatibleSetting: "preserved",
      dashboardTileLayout: expect.any(Array),
    }));
    expect(result.compatibleRootField).toEqual({ futureVersion: 2 });
    expect(result.seeds).toEqual({
      tasks: true,
      sessions: false,
      compatibleSeed: "preserved",
    });
    expect(result.studySessions).toEqual([]);
    expect(result.exams).toEqual([]);
  });

  it("speichert den Planner unverändert per authentifiziertem Supabase-Upsert", async () => {
    const fetchMock = vi.fn().mockResolvedValue(emptyResponse());
    vi.stubGlobal("fetch", fetchMock);
    const { saveUserPlannerData } = await importCloudStore();
    const plannerData = {
      subjects: [],
      tasks: [{ id: "task-1", type: "deadline", title: "Abgabe" }],
      studySessions: [],
      exams: [],
      todayFocus: [],
      settings: { appearance: "light" },
      compatibleRootField: { futureVersion: 3 },
    };

    await expect(saveUserPlannerData(TEST_USER_ID, plannerData)).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe("https://kan35.supabase.test/rest/v1/user_plans?on_conflict=user_id");
    expect(request).toEqual(expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        apikey: "kan35-anon-key",
        Authorization: "Bearer cloud-test-token",
        Prefer: "resolution=merge-duplicates,return=minimal",
      }),
    }));
    expect(JSON.parse(request.body)).toEqual({
      user_id: TEST_USER_ID,
      data: plannerData,
    });
  });

  it("reicht einen nicht erfolgreichen Supabase-Status als Fehler weiter", async () => {
    const originalConsoleError = console.error;
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ message: "Cloud nicht erreichbar" }, 500)));
      const {
        loadUserPlannerData,
        PLANNER_SNAPSHOT_ERROR_CODES,
        PlannerSnapshotError,
      } = await importCloudStore();

      const error = await loadUserPlannerData(TEST_USER_ID).catch((loadError) => loadError);
      expect(error).toBeInstanceOf(PlannerSnapshotError);
      expect(error).toEqual(expect.objectContaining({
        name: "PlannerSnapshotError",
        code: PLANNER_SNAPSHOT_ERROR_CODES.TRANSPORT_ERROR,
        operation: "load",
        message: "Cloud nicht erreichbar",
        cause: expect.any(Error),
      }));
      expect(consoleError).toHaveBeenCalledWith("Load planner data error:", expect.any(Error));
    } finally {
      consoleError.mockRestore();
    }

    expect(console.error).toBe(originalConsoleError);
  });

  it("kategorisiert eine fehlende Planner-Tabelle eindeutig als Schemafehler", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
        message: "Could not find the table 'public.user_plans' in the schema cache",
      }, 404)));
      const { loadUserPlannerData, PLANNER_SNAPSHOT_ERROR_CODES } = await importCloudStore();

      const error = await loadUserPlannerData(TEST_USER_ID).catch((loadError) => loadError);

      expect(error).toEqual(expect.objectContaining({
        code: PLANNER_SNAPSHOT_ERROR_CODES.SCHEMA_ERROR,
        operation: "load",
      }));
      expect(error.cause).toEqual(expect.objectContaining({
        message: expect.stringContaining("public.user_plans"),
        cause: expect.objectContaining({
          name: "SupabaseRequestError",
          status: 404,
          message: "Could not find the table 'public.user_plans' in the schema cache",
        }),
      }));
    } finally {
      consoleError.mockRestore();
    }
  });

  it("erneuert bei einem 401 die Session zentral und wiederholt auch CloudStore-Abfragen", async () => {
    localStorage.setItem("sb-auth-session", JSON.stringify({
      ...futureSession,
      access_token: "expired-cloud-test-token",
      refresh_token: "cloud-test-refresh-token",
    }));
    const refreshedSession = {
      access_token: "refreshed-cloud-test-token",
      refresh_token: "refreshed-cloud-test-refresh-token",
      expires_in: 3600,
      user: futureSession.user,
    };
    const subjectRows = [{ id: "subject-1", user_id: TEST_USER_ID, name: "Softwaretechnik" }];
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ message: "JWT expired" }, 401))
      .mockResolvedValueOnce(jsonResponse(refreshedSession))
      .mockResolvedValueOnce(jsonResponse(subjectRows));
    vi.stubGlobal("fetch", fetchMock);
    const { loadSubjects } = await importCloudStore();

    await expect(loadSubjects(TEST_USER_ID)).resolves.toEqual(subjectRows);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toContain("/rest/v1/subjects?");
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer expired-cloud-test-token");
    expect(fetchMock.mock.calls[1][0]).toBe("https://kan35.supabase.test/auth/v1/token?grant_type=refresh_token");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      refresh_token: "cloud-test-refresh-token",
    });
    expect(fetchMock.mock.calls[2][0]).toBe(fetchMock.mock.calls[0][0]);
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe("Bearer refreshed-cloud-test-token");
    expect(JSON.parse(localStorage.getItem("sb-auth-session"))).toEqual(expect.objectContaining({
      access_token: "refreshed-cloud-test-token",
      refresh_token: "refreshed-cloud-test-refresh-token",
      expires_at: 1784725200,
    }));
  });

  it("kategorisiert Speicherfehler mit der betroffenen Operation", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ message: "Upsert fehlgeschlagen" }, 500)));
      const { saveUserPlannerData, PLANNER_SNAPSHOT_ERROR_CODES } = await importCloudStore();

      await expect(saveUserPlannerData(TEST_USER_ID, { tasks: [] })).rejects.toEqual(expect.objectContaining({
        code: PLANNER_SNAPSHOT_ERROR_CODES.TRANSPORT_ERROR,
        operation: "save",
        message: "Upsert fehlgeschlagen",
      }));
    } finally {
      consoleError.mockRestore();
    }
  });

  it("bricht ohne aktive Session kategorisiert und ohne Cloud-Aufruf ab", async () => {
    localStorage.removeItem("sb-auth-session");
    const fetchMock = vi.fn();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", fetchMock);

    try {
      const { loadUserPlannerData, PLANNER_SNAPSHOT_ERROR_CODES } = await importCloudStore();

      await expect(loadUserPlannerData(TEST_USER_ID)).rejects.toEqual(expect.objectContaining({
        code: PLANNER_SNAPSHOT_ERROR_CODES.AUTH_REQUIRED,
        operation: "load",
      }));
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });
});

describe("Planner-Snapshot-Schema-Mapping", () => {
  it("trennt leere Abfragen von vorhandenen leeren Snapshots", () => {
    expect(readPlannerSnapshotRow([])).toEqual({ found: false, snapshot: null });
    expect(readPlannerSnapshotRow([{ data: null }])).toEqual({ found: true, snapshot: {} });
  });

  it("erstellt den Upsert-Payload ohne kompatible Felder zu entfernen", () => {
    const plannerData = {
      tasks: [],
      compatibleRootField: { futureVersion: 4 },
    };

    expect(buildPlannerSnapshotUpsert(TEST_USER_ID, plannerData)).toEqual({
      user_id: TEST_USER_ID,
      data: plannerData,
    });
  });
});
