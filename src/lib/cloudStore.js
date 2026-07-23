const SESSION_STORAGE_KEY = "study_planner_auth_session_v1";

function getConfig() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase ist nicht konfiguriert. Bitte .env Variablen setzen.");
  }

  return {
    supabaseUrl: supabaseUrl.replace(/\/+$/, ""),
    supabaseAnonKey,
  };
}

function parseJsonSafe(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function saveSession(session) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

function clearSession() {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

async function authRequest(path, { method = "GET", body, accessToken } = {}) {
  const { supabaseUrl, supabaseAnonKey } = getConfig();
  const response = await fetch(`${supabaseUrl}${path}`, {
    method,
    headers: {
      apikey: supabaseAnonKey,
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = parseJsonSafe(await response.text(), {});
  if (!response.ok) {
    throw new Error(payload?.msg || payload?.error_description || payload?.message || "Auth-Fehler");
  }
  return payload;
}

export async function signUpWithEmail(email, password) {
  const payload = await authRequest("/auth/v1/signup", {
    method: "POST",
    body: { email, password },
  });

  if (payload?.session) saveSession(payload.session);
  return payload;
}

export async function signInWithEmail(email, password) {
  const payload = await authRequest("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: { email, password },
  });
  saveSession(payload);
  return payload;
}

export async function signOutCurrentSession(accessToken) {
  if (accessToken) {
    try {
      await authRequest("/auth/v1/logout", {
        method: "POST",
        accessToken,
      });
    } catch {
      // local session will still be cleared below
    }
  }
  clearSession();
}

async function refreshSessionIfNeeded(session) {
  if (!session?.refresh_token) return session;
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!session.expires_at || session.expires_at > nowSeconds + 30) return session;

  const refreshed = await authRequest("/auth/v1/token?grant_type=refresh_token", {
    method: "POST",
    body: { refresh_token: session.refresh_token },
  });
  saveSession(refreshed);
  return refreshed;
}

export async function getActiveSession() {
  const stored = parseJsonSafe(localStorage.getItem(SESSION_STORAGE_KEY), null);
  if (!stored) return null;

  try {
    return await refreshSessionIfNeeded(stored);
  } catch {
    clearSession();
    return null;
  }
}

function restHeaders(accessToken) {
  const { supabaseAnonKey } = getConfig();
  return {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

export async function loadUserPlannerData(userId, accessToken) {
  const { supabaseUrl } = getConfig();
  const query = `${supabaseUrl}/rest/v1/user_plans?select=data&user_id=eq.${userId}`;
  const response = await fetch(query, { headers: restHeaders(accessToken) });
  const payload = parseJsonSafe(await response.text(), []);
  if (!response.ok) throw new Error(payload?.message || "Cloud-Daten konnten nicht geladen werden.");
  return payload?.[0]?.data || null;
}

export async function saveUserPlannerData(userId, data, accessToken) {
  const { supabaseUrl } = getConfig();
  const response = await fetch(`${supabaseUrl}/rest/v1/user_plans`, {
    method: "POST",
    headers: {
      ...restHeaders(accessToken),
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify([{ user_id: userId, data }]),
  });
  const payload = parseJsonSafe(await response.text(), {});
  if (!response.ok) throw new Error(payload?.message || "Cloud-Daten konnten nicht gespeichert werden.");
}
