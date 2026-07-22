import { TEST_USER_ID } from "@/test/fixtures/plannerData";

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
        subjects: [{ id: "subject-1", name: "Softwaretechnik" }],
        tasks: [{
          id: "legacy-project",
          type: "project",
          title: "Legacy-Projekt",
          archivedAt: "2026-07-01T00:00:00.000Z",
          pinned: 1,
          customMarker: "preserved",
        }],
        settings: { darkMode: true, sidebarCollapsed: true },
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
      dashboardTileLayout: expect.any(Array),
    }));
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
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ message: "Cloud nicht erreichbar" }, 500)));
    const { loadUserPlannerData } = await importCloudStore();

    await expect(loadUserPlannerData(TEST_USER_ID)).rejects.toThrow("Cloud nicht erreichbar");
    expect(consoleError).toHaveBeenCalledWith("Load planner data error:", expect.any(Error));
  });
});
