import {
  fetchSupabase,
  getAuthRedirectUrl,
  hasSupabaseConfig,
  readSupabaseResponse,
} from "./client";

const AUTH_SESSION_STORAGE_KEY = "sb-auth-session";

function storeAuthSession(session) {
  if (session?.access_token && session?.user) {
    localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
  }
}

function clearAuthSession() {
  localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
}

function normalizeAuthSession(data) {
  const session = data?.session || (data?.access_token ? {
    access_token: data.access_token,
    token_type: data.token_type,
    expires_in: data.expires_in,
    refresh_token: data.refresh_token,
    user: data.user,
    expires_at: data.expires_at || (data.expires_in
      ? Math.floor(Date.now() / 1000) + Number(data.expires_in)
      : undefined),
  } : null);

  storeAuthSession(session);
  return session;
}

async function requestAuth(endpoint, options, fallbackMessage) {
  const response = await fetchSupabase(`/auth/v1${endpoint}`, options);
  return readSupabaseResponse(response, fallbackMessage);
}

export async function signUpWithEmail(email, password) {
  try {
    const data = await requestAuth("/signup", {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
        options: { emailRedirectTo: getAuthRedirectUrl() },
      }),
    }, "Signup failed");
    const session = normalizeAuthSession(data);
    return { user: session?.user || data?.user, session };
  } catch (error) {
    console.error("Sign up error:", error);
    throw error;
  }
}

export async function signInWithEmail(email, password) {
  try {
    const data = await requestAuth("/token?grant_type=password", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }, "Login failed");
    const session = normalizeAuthSession(data);
    return { user: session?.user || data?.user, session };
  } catch (error) {
    console.error("Sign in error:", error);
    throw error;
  }
}

export async function requestPasswordReset(email) {
  try {
    await requestAuth("/recover", {
      method: "POST",
      body: JSON.stringify({
        email,
        redirect_to: getAuthRedirectUrl(),
      }),
    }, "Password reset failed");
    return true;
  } catch (error) {
    console.error("Password reset error:", error);
    throw error;
  }
}

export async function resendSignupConfirmation(email) {
  try {
    await requestAuth("/resend", {
      method: "POST",
      body: JSON.stringify({
        type: "signup",
        email,
        options: { emailRedirectTo: getAuthRedirectUrl() },
      }),
    }, "Resend confirmation failed");
    return true;
  } catch (error) {
    console.error("Resend confirmation error:", error);
    throw error;
  }
}

export async function refreshAuthSession(session) {
  try {
    const data = await requestAuth("/token?grant_type=refresh_token", {
      method: "POST",
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    }, "Token refresh failed");
    const refreshedSession = normalizeAuthSession(data);
    if (!refreshedSession) throw new Error("Invalid token response structure");
    return refreshedSession;
  } catch (error) {
    console.error("Refresh token error:", error);
    return null;
  }
}

export async function getActiveSession() {
  try {
    const sessionStr = localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    if (!sessionStr) return null;

    const session = JSON.parse(sessionStr);
    if (!session?.access_token || !session?.user) {
      clearAuthSession();
      return null;
    }

    if (session.expires_at && session.expires_at * 1000 < Date.now()) {
      if (!session.refresh_token) {
        console.warn("Token expired but no refresh token available");
        clearAuthSession();
        return null;
      }

      const refreshed = await refreshAuthSession(session);
      if (!refreshed) clearAuthSession();
      return refreshed;
    }

    return session;
  } catch (error) {
    console.error("Error getting active session:", error);
    clearAuthSession();
    return null;
  }
}

export async function signOutCurrentSession() {
  try {
    const session = await getActiveSession();
    if (session && hasSupabaseConfig()) {
      await fetchSupabase("/auth/v1/logout", {
        method: "POST",
        accessToken: session.access_token,
      });
    }
  } catch (error) {
    console.error("Sign out error:", error);
  } finally {
    clearAuthSession();
  }
}
