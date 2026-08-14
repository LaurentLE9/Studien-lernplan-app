import {
  fetchSupabase,
  readSupabaseResponse,
  SupabaseRequestError,
} from "./client";
import {
  getActiveSession,
  refreshAuthSession,
} from "./authRepository";

const DEBUG_SYNC = String(import.meta.env.VITE_DEBUG_SYNC || "true").toLowerCase() !== "false";

export function logSyncDebug(event, payload) {
  if (!DEBUG_SYNC) return;
  try {
    console.info(`[cloud-sync] ${event}`, payload || "");
  } catch {
    console.info(`[cloud-sync] ${event}`);
  }
}

export async function supabaseRequest(endpoint, options = {}) {
  const session = await getActiveSession();
  const token = session?.access_token;
  const method = options.method || "GET";
  logSyncDebug("request:start", {
    method,
    endpoint,
    userId: session?.user?.id || null,
  });

  let response = await fetchSupabase(`/rest/v1${endpoint}`, {
    ...options,
    accessToken: token,
  });

  logSyncDebug("request:response", {
    method,
    endpoint,
    status: response.status,
    ok: response.ok,
    userId: session?.user?.id || null,
  });

  if (response.status === 401 && session?.refresh_token) {
    try {
      const refreshed = await refreshAuthSession(session);
      if (refreshed) {
        logSyncDebug("request:retry", {
          method,
          endpoint,
          reason: "token_refreshed",
        });

        response = await fetchSupabase(`/rest/v1${endpoint}`, {
          ...options,
          accessToken: refreshed.access_token,
        });

        logSyncDebug("request:response:retry", {
          method,
          endpoint,
          status: response.status,
          ok: response.ok,
          userId: refreshed.user?.id || null,
        });
      }
    } catch (error) {
      console.warn("Failed to refresh token on 401:", error);
      localStorage.removeItem("sb-auth-session");
    }
  }

  try {
    return await readSupabaseResponse(response, "Request failed");
  } catch (error) {
    if (
      error instanceof SupabaseRequestError
      && error.status === 404
      && (endpoint.includes("/user_plans")
        || error.message.toLowerCase().includes("schema cache")
        || error.message.toLowerCase().includes("public.user_plans"))
    ) {
      throw new Error("Supabase-Tabelle public.user_plans fehlt oder der Schema-Cache ist veraltet. Bitte supabase/schema.sql oder die neue Migration ausführen und danach den Supabase Schema-Cache neu laden (NOTIFY pgrst, 'reload schema').", {
        cause: error,
      });
    }
    throw error;
  }
}
