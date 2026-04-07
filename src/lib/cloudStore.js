/**
 * Cloud Storage Module for Supabase Authentication and Data Sync
 * Handles user registration, login, logout, and planner data persistence
 */

// Supabase URL and Key from environment variables
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

function hasPlaceholderConfig() {
  const url = String(SUPABASE_URL || "").trim();
  const key = String(SUPABASE_ANON_KEY || "").trim();
  return (
    !url ||
    !key ||
    url.includes("your-project") ||
    key.includes("your-anon-key") ||
    key.endsWith("...")
  );
}

function ensureSupabaseConfig() {
  if (hasPlaceholderConfig()) {
    throw new Error("Supabase nicht konfiguriert: Bitte echte VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY in Vercel Project Settings -> Environment Variables setzen.");
  }
}

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    "⚠️ Supabase credentials missing. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env"
  );
}

// Helper: Make authenticated requests to Supabase
async function supabaseRequest(endpoint, options = {}) {
  const session = await getActiveSession();
  const token = session?.access_token;

  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const url = `${SUPABASE_URL}/rest/v1${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMessage = `Request failed: ${response.status}`;
    try {
      const error = await response.json();
      errorMessage = error.message || error.error_description || errorMessage;
    } catch {
      // Ignore non-JSON error bodies and use the fallback message.
    }
    throw new Error(errorMessage);
  }

  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return null;
  }

  const text = await response.text();
  if (!text.trim()) {
    return null;
  }

  return JSON.parse(text);
}

/**
 * Sign up a new user with email and password
 */
export async function signUpWithEmail(email, password) {
  ensureSupabaseConfig();

  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data?.message ||
        data?.error_description ||
        data?.msg ||
        data?.error ||
        `Signup failed (${response.status})`
      );
    }

    return { user: data.user, session: data.session };
  } catch (error) {
    console.error("Sign up error:", error);
    throw error;
  }
}

/**
 * Sign in with email and password
 */
export async function signInWithEmail(email, password) {
  ensureSupabaseConfig();

  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data?.error_description ||
        data?.message ||
        data?.msg ||
        data?.error ||
        `Login failed (${response.status})`
      );
    }

    // Save session to localStorage
    if (data.session) {
      localStorage.setItem("sb-auth-session", JSON.stringify(data.session));
    }

    return { user: data.user, session: data.session };
  } catch (error) {
    console.error("Sign in error:", error);
    throw error;
  }
}

/**
 * Send password reset email
 */
export async function requestPasswordReset(email) {
  ensureSupabaseConfig();

  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ email }),
    });

    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      throw new Error(
        data?.message ||
        data?.error_description ||
        data?.msg ||
        data?.error ||
        `Password reset failed (${response.status})`
      );
    }

    return true;
  } catch (error) {
    console.error("Password reset error:", error);
    throw error;
  }
}

/**
 * Get active session from localStorage
 */
export async function getActiveSession() {
  try {
    const sessionStr = localStorage.getItem("sb-auth-session");
    if (!sessionStr) return null;

    const session = JSON.parse(sessionStr);

    // Check if token is expired
    if (session.expires_at && session.expires_at * 1000 < Date.now()) {
      // Token expired, try to refresh
      try {
        const refreshed = await refreshSession(session);
        if (refreshed) {
          localStorage.setItem("sb-auth-session", JSON.stringify(refreshed));
          return refreshed;
        }
      } catch (err) {
        console.warn("Token refresh failed:", err);
        localStorage.removeItem("sb-auth-session");
        return null;
      }
    }

    return session;
  } catch (error) {
    console.error("Error getting active session:", error);
    return null;
  }
}

/**
 * Refresh authentication token
 */
async function refreshSession(session) {
  ensureSupabaseConfig();

  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error("Token refresh failed");
    }

    return data.session;
  } catch (error) {
    console.error("Refresh token error:", error);
    return null;
  }
}

/**
 * Sign out current session
 */
export async function signOutCurrentSession() {
  try {
    const session = await getActiveSession();
    if (session && SUPABASE_URL && SUPABASE_ANON_KEY) {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${session.access_token}`,
        },
      });
    }
  } catch (error) {
    console.error("Sign out error:", error);
  } finally {
    // Clear session from localStorage regardless of API response
    localStorage.removeItem("sb-auth-session");
  }
}

/**
 * Load user planner data from cloud
 */
export async function loadUserPlannerData(userId) {
  try {
    const session = await getActiveSession();
    if (!session) throw new Error("No active session");

    const data = await supabaseRequest(
      `/user_plans?user_id=eq.${userId}&select=data`,
      {
        method: "GET",
        headers: {
          apikey: SUPABASE_ANON_KEY,
        },
      }
    );

    if (data.length > 0) {
      const rawData = data[0].data || {};
      const rawSettings = rawData.settings || {};
      const appearance = rawSettings.appearance || (typeof rawSettings.darkMode === "boolean" ? (rawSettings.darkMode ? "dark" : "light") : "light");

      return {
        ...normalizeDefaultData(),
        ...rawData,
        settings: {
          ...normalizeDefaultData().settings,
          ...rawSettings,
          appearance,
          sidebarCollapsed: Boolean(rawSettings.sidebarCollapsed),
        },
        seeds: {
          ...normalizeDefaultData().seeds,
          ...(rawData.seeds || {}),
        },
      };
    }

    // No data yet, return defaults
    return normalizeDefaultData();
  } catch (error) {
    console.error("Load planner data error:", error);
    throw error;
  }
}

/**
 * Save user planner data to cloud
 */
export async function saveUserPlannerData(userId, plannerData) {
  try {
    const session = await getActiveSession();
    if (!session) throw new Error("No active session");

    // First check if record exists
    const existing = await supabaseRequest(
      `/user_plans?user_id=eq.${userId}&select=id`,
      {
        method: "GET",
        headers: {
          apikey: SUPABASE_ANON_KEY,
        },
      }
    );

    if (existing.length > 0) {
      // Update existing
      await supabaseRequest(
        `/user_plans?user_id=eq.${userId}`,
        {
          method: "PATCH",
          headers: {
            apikey: SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ data: plannerData }),
        }
      );
    } else {
      // Create new
      await supabaseRequest(
        `/user_plans`,
        {
          method: "POST",
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Prefer: "return=minimal",
          },
          body: JSON.stringify({ user_id: userId, data: plannerData }),
        }
      );
    }

    return true;
  } catch (error) {
    console.error("Save planner data error:", error);
    throw error;
  }
}

/**
 * Normalize default planner data structure
 */
export function normalizeDefaultData() {
  return {
    subjects: [],
    tasks: [],
    studySessions: [],
    todayFocus: [],
    settings: { appearance: "light", sidebarCollapsed: false },
    seeds: { tasks: false, sessions: false },
  };
}

/**
 * Get user ID from active session
 */
export async function getCurrentUserId() {
  const session = await getActiveSession();
  return session?.user?.id || null;
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated() {
  const session = await getActiveSession();
  return !!session;
}
