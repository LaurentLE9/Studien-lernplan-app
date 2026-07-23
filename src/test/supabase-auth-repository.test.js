const TEST_URL = "https://kan68.supabase.test";
const TEST_ANON_KEY = "kan68-anon-key";
const TEST_APP_URL = "https://study-app.example.test";
const SESSION_KEY = "sb-auth-session";

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => "application/json" },
    text: async () => JSON.stringify(payload),
  };
}

function emptyResponse(status = 204) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => "" },
    text: async () => "",
  };
}

async function importAuthRepository() {
  vi.resetModules();
  vi.stubEnv("VITE_SUPABASE_URL", TEST_URL);
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", TEST_ANON_KEY);
  vi.stubEnv("VITE_PUBLIC_APP_URL", TEST_APP_URL);
  return import("@/infrastructure/supabase/authRepository");
}

async function importSupabaseClient() {
  vi.resetModules();
  vi.stubEnv("VITE_SUPABASE_URL", TEST_URL);
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", TEST_ANON_KEY);
  vi.stubEnv("VITE_PUBLIC_APP_URL", TEST_APP_URL);
  return import("@/infrastructure/supabase/client");
}

describe("Supabase Auth Repository", () => {
  it("meldet Benutzer an und persistiert die normalisierte Session", async () => {
    const payload = {
      access_token: "access-token",
      refresh_token: "refresh-token",
      expires_in: 3600,
      token_type: "bearer",
      user: { id: "user-1", email: "user@example.test" },
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(payload));
    vi.stubGlobal("fetch", fetchMock);
    const { signInWithEmail } = await importAuthRepository();

    const result = await signInWithEmail("user@example.test", "secret-password");

    expect(fetchMock).toHaveBeenCalledWith(
      `${TEST_URL}/auth/v1/token?grant_type=password`,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          apikey: TEST_ANON_KEY,
        }),
      }),
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      email: "user@example.test",
      password: "secret-password",
    });
    expect(result.user).toEqual(payload.user);
    expect(JSON.parse(localStorage.getItem(SESSION_KEY))).toEqual(expect.objectContaining({
      access_token: "access-token",
      refresh_token: "refresh-token",
      user: payload.user,
      expires_at: expect.any(Number),
    }));
  });

  it("verwendet für Registrierung, Reset und Bestätigung die konfigurierte Redirect-URL", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ user: { id: "pending-user" } }))
      .mockResolvedValueOnce(emptyResponse())
      .mockResolvedValueOnce(emptyResponse());
    vi.stubGlobal("fetch", fetchMock);
    const {
      requestPasswordReset,
      resendSignupConfirmation,
      signUpWithEmail,
    } = await importAuthRepository();

    await signUpWithEmail("new@example.test", "secret-password");
    await requestPasswordReset("new@example.test");
    await resendSignupConfirmation("new@example.test");

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      email: "new@example.test",
      password: "secret-password",
      options: { emailRedirectTo: TEST_APP_URL },
    });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      email: "new@example.test",
      redirect_to: TEST_APP_URL,
    });
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({
      type: "signup",
      email: "new@example.test",
      options: { emailRedirectTo: TEST_APP_URL },
    });
  });

  it("aktualisiert eine abgelaufene Session über den Refresh-Token", async () => {
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      access_token: "expired-access-token",
      refresh_token: "refresh-token",
      expires_at: 1,
      user: { id: "user-1" },
    }));
    const refreshedPayload = {
      access_token: "new-access-token",
      refresh_token: "new-refresh-token",
      expires_at: 4102444800,
      user: { id: "user-1" },
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(refreshedPayload));
    vi.stubGlobal("fetch", fetchMock);
    const { getActiveSession } = await importAuthRepository();

    await expect(getActiveSession()).resolves.toEqual(expect.objectContaining({
      access_token: "new-access-token",
    }));
    expect(fetchMock).toHaveBeenCalledWith(
      `${TEST_URL}/auth/v1/token?grant_type=refresh_token`,
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      refresh_token: "refresh-token",
    });
  });

  it("normalisiert Auth-Fehler, ohne Konfiguration oder Zugangsdaten zu protokollieren", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      error_description: "Invalid login credentials",
    }, 400)));
    const { signInWithEmail } = await importAuthRepository();

    await expect(signInWithEmail("user@example.test", "secret-password"))
      .rejects.toThrow("Invalid login credentials");

    const loggedText = consoleError.mock.calls.flat().map(String).join(" ");
    expect(loggedText).not.toContain(TEST_ANON_KEY);
    expect(loggedText).not.toContain("secret-password");
    expect(loggedText).not.toContain("access-token");
    consoleError.mockRestore();
  });

  it("schützt API-Key und Session-Token vor überschreibenden Caller-Headern", async () => {
    const fetchMock = vi.fn().mockResolvedValue(emptyResponse());
    vi.stubGlobal("fetch", fetchMock);
    const { fetchSupabase } = await importSupabaseClient();

    await fetchSupabase("/rest/v1/user_plans", {
      accessToken: "trusted-access-token",
      headers: {
        apikey: "caller-api-key",
        Authorization: "Bearer caller-token",
        "X-Request-Source": "kan-68-test",
      },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      `${TEST_URL}/rest/v1/user_plans`,
      expect.objectContaining({
        headers: expect.objectContaining({
          apikey: TEST_ANON_KEY,
          Authorization: "Bearer trusted-access-token",
          "X-Request-Source": "kan-68-test",
        }),
      }),
    );
  });

  it("gibt typisierte Fehler ohne rohes Response-Payload weiter", async () => {
    const {
      readSupabaseResponse,
      SupabaseRequestError,
    } = await importSupabaseClient();
    const response = jsonResponse({
      message: "Request rejected",
      email: "private@example.test",
      access_token: "private-access-token",
    }, 400);

    const error = await readSupabaseResponse(response).catch((caughtError) => caughtError);

    expect(error).toBeInstanceOf(SupabaseRequestError);
    expect(error).toMatchObject({
      message: "Request rejected",
      status: 400,
    });
    expect(error).not.toHaveProperty("payload");
    expect(JSON.stringify(error)).not.toContain("private@example.test");
    expect(JSON.stringify(error)).not.toContain("private-access-token");
  });

  it("entfernt die lokale Session auch dann, wenn der Logout-Request fehlschlägt", async () => {
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      access_token: "access-token",
      expires_at: 4102444800,
      user: { id: "user-1" },
    }));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network unavailable")));
    const { signOutCurrentSession } = await importAuthRepository();

    await expect(signOutCurrentSession()).resolves.toBeUndefined();

    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
    expect(consoleError).toHaveBeenCalledWith("Sign out error:", expect.any(Error));
    consoleError.mockRestore();
  });
});
