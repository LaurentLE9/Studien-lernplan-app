/**
 * Cloud Storage Module for Supabase Authentication and Data Sync
 * Handles user registration, login, logout, and planner data persistence
 */

// Supabase URL and Key from environment variables
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const PUBLIC_APP_URL = import.meta.env.VITE_PUBLIC_APP_URL;
const DASHBOARD_WIDGET_IDS = ["stats", "deadlines", "hours", "today", "recent", "done"];
const DEADLINE_FILTER_OPTIONS = ["all", "open", "urgent", "today", "next3"];
const DEBUG_SYNC = String(import.meta.env.VITE_DEBUG_SYNC || "true").toLowerCase() !== "false";

export const REVIEW_INTERVAL_DAYS = [1, 3, 7];
export const MAX_REVIEW_GAP_DURING_SEMESTER = 7;

function toIsoDateTimeOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function addDays(dateLike, days) {
  const base = new Date(dateLike || Date.now());
  if (Number.isNaN(base.getTime())) return new Date();
  base.setDate(base.getDate() + Number(days || 0));
  return base;
}

export function calculateNextReviewAt(reviewStep = 0, now = new Date(), maxGapDuringSemester = MAX_REVIEW_GAP_DURING_SEMESTER) {
  const normalizedStep = Math.max(0, Number(reviewStep || 0));
  const interval = REVIEW_INTERVAL_DAYS[Math.min(normalizedStep, REVIEW_INTERVAL_DAYS.length - 1)] || REVIEW_INTERVAL_DAYS[REVIEW_INTERVAL_DAYS.length - 1];
  const boundedInterval = Math.min(interval, Math.max(1, Number(maxGapDuringSemester || MAX_REVIEW_GAP_DURING_SEMESTER)));
  return addDays(now, boundedInterval).toISOString();
}

function logSyncDebug(event, payload) {
  if (!DEBUG_SYNC) return;
  try {
    console.info(`[cloud-sync] ${event}`, payload || "");
  } catch {
    console.info(`[cloud-sync] ${event}`);
  }
}

function normalizeDashboardLayout(layout) {
  if (!Array.isArray(layout)) return [...DASHBOARD_WIDGET_IDS];
  const filtered = layout.filter((id) => DASHBOARD_WIDGET_IDS.includes(id));
  const missing = DASHBOARD_WIDGET_IDS.filter((id) => !filtered.includes(id));
  return [...filtered, ...missing];
}

function normalizeDeadlineWidgetSettings(value) {
  const activeFilter = DEADLINE_FILTER_OPTIONS.includes(value?.activeFilter) ? value.activeFilter : "all";
  const defaultFilter = DEADLINE_FILTER_OPTIONS.includes(value?.defaultFilter) ? value.defaultFilter : "all";
  return { activeFilter, defaultFilter };
}

function getAuthRedirectUrl() {
  const configured = String(PUBLIC_APP_URL || "").trim();
  if (configured) return configured;
  if (typeof window !== "undefined") return window.location.origin;
  return undefined;
}

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

function normalizeAuthSession(data) {
  const session = data?.session || (data?.access_token ? {
    access_token: data.access_token,
    token_type: data.token_type,
    expires_in: data.expires_in,
    refresh_token: data.refresh_token,
    user: data.user,
    expires_at: data.expires_at || (data.expires_in ? Math.floor(Date.now() / 1000) + Number(data.expires_in) : undefined),
  } : null);

  if (session?.access_token && session?.user) {
    localStorage.setItem("sb-auth-session", JSON.stringify(session));
  }

  return session;
}

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    "⚠️ Supabase credentials missing. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env"
  );
}

// Helper: Make authenticated requests to Supabase
async function supabaseRequest(endpoint, options = {}) {
  ensureSupabaseConfig();

  const session = await getActiveSession();
  const token = session?.access_token;
  const method = options.method || "GET";

  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const url = `${SUPABASE_URL}/rest/v1${endpoint}`;
  logSyncDebug("request:start", {
    method,
    endpoint,
    userId: session?.user?.id || null,
  });

  let response = await fetch(url, {
    ...options,
    headers,
  });

  logSyncDebug("request:response", {
    method,
    endpoint,
    status: response.status,
    ok: response.ok,
    userId: session?.user?.id || null,
  });

  // Handle 401 (Unauthorized) - token may have expired, try refresh and retry once
  if (response.status === 401 && session?.refresh_token) {
    try {
      const refreshed = await refreshSession(session);
      if (refreshed) {
        localStorage.setItem("sb-auth-session", JSON.stringify(refreshed));
        headers.Authorization = `Bearer ${refreshed.access_token}`;
        
        logSyncDebug("request:retry", {
          method,
          endpoint,
          reason: "token_refreshed",
        });

        // Retry the request with new token
        response = await fetch(url, {
          ...options,
          headers,
        });

        logSyncDebug("request:response:retry", {
          method,
          endpoint,
          status: response.status,
          ok: response.ok,
          userId: refreshed.user?.id || null,
        });
      }
    } catch (err) {
      console.warn("Failed to refresh token on 401:", err);
      localStorage.removeItem("sb-auth-session");
    }
  }

  if (!response.ok) {
    let errorMessage = `Request failed: ${response.status}`;
    try {
      const error = await response.json();
      errorMessage = error.message || error.error_description || errorMessage;
    } catch {
      // Ignore non-JSON error bodies and use the fallback message.
    }

    if (
      response.status === 404 &&
      (endpoint.includes("/user_plans") || errorMessage.toLowerCase().includes("schema cache") || errorMessage.toLowerCase().includes("public.user_plans"))
    ) {
      errorMessage = "Supabase-Tabelle public.user_plans fehlt oder der Schema-Cache ist veraltet. Bitte supabase/schema.sql oder die neue Migration ausführen und danach den Supabase Schema-Cache neu laden (NOTIFY pgrst, 'reload schema').";
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
      body: JSON.stringify({
        email,
        password,
        options: {
          emailRedirectTo: getAuthRedirectUrl(),
        },
      }),
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

    const session = normalizeAuthSession(data);
    return { user: session?.user || data.user, session };
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

    const session = normalizeAuthSession(data);

    return { user: session?.user || data.user, session };
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
      body: JSON.stringify({
        email,
        redirect_to: getAuthRedirectUrl(),
      }),
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
 * Resend signup confirmation email
 */
export async function resendSignupConfirmation(email) {
  ensureSupabaseConfig();

  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/resend`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        type: "signup",
        email,
        options: {
          emailRedirectTo: getAuthRedirectUrl(),
        },
      }),
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
        `Resend confirmation failed (${response.status})`
      );
    }

    return true;
  } catch (error) {
    console.error("Resend confirmation error:", error);
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
    
    // Validate session structure
    if (!session?.access_token || !session?.user) {
      localStorage.removeItem("sb-auth-session");
      return null;
    }

    // Check if token is expired
    if (session.expires_at && session.expires_at * 1000 < Date.now()) {
      // Token expired, try to refresh
      if (!session.refresh_token) {
        console.warn("Token expired but no refresh token available");
        localStorage.removeItem("sb-auth-session");
        return null;
      }

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
    localStorage.removeItem("sb-auth-session");
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
      throw new Error(
        data?.error_description ||
        data?.message ||
        data?.error ||
        "Token refresh failed"
      );
    }

    // Normalize the response - Supabase returns token data directly, not nested under .session
    const refreshedSession = normalizeAuthSession(data);
    if (!refreshedSession) {
      throw new Error("Invalid token response structure");
    }

    return refreshedSession;
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

    logSyncDebug("load:start", {
      userId,
      sessionUserId: session?.user?.id || null,
    });

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

      logSyncDebug("load:success", {
        userId,
        hasData: true,
        counts: {
          subjects: Array.isArray(rawData.subjects) ? rawData.subjects.length : 0,
          tasks: Array.isArray(rawData.tasks) ? rawData.tasks.length : 0,
          studySessions: Array.isArray(rawData.studySessions) ? rawData.studySessions.length : 0,
          exams: Array.isArray(rawData.exams) ? rawData.exams.length : 0,
          todayFocus: Array.isArray(rawData.todayFocus) ? rawData.todayFocus.length : 0,
        },
      });

      return {
        ...normalizeDefaultData(),
        ...rawData,
        settings: {
          ...normalizeDefaultData().settings,
          ...rawSettings,
          appearance,
          sidebarCollapsed: Boolean(rawSettings.sidebarCollapsed),
          dashboardLayout: normalizeDashboardLayout(rawSettings.dashboardLayout),
          deadlineWidget: normalizeDeadlineWidgetSettings(rawSettings.deadlineWidget),
        },
        seeds: {
          ...normalizeDefaultData().seeds,
          ...(rawData.seeds || {}),
        },
      };
    }

    // No data yet, return defaults
    logSyncDebug("load:success", { userId, hasData: false });
    return normalizeDefaultData();
  } catch (error) {
    console.error("Load planner data error:", error);
    logSyncDebug("load:error", {
      userId,
      message: error?.message || String(error),
    });
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

    logSyncDebug("save:start", {
      userId,
      sessionUserId: session?.user?.id || null,
      counts: {
        subjects: Array.isArray(plannerData?.subjects) ? plannerData.subjects.length : 0,
        tasks: Array.isArray(plannerData?.tasks) ? plannerData.tasks.length : 0,
        studySessions: Array.isArray(plannerData?.studySessions) ? plannerData.studySessions.length : 0,
        exams: Array.isArray(plannerData?.exams) ? plannerData.exams.length : 0,
        todayFocus: Array.isArray(plannerData?.todayFocus) ? plannerData.todayFocus.length : 0,
      },
    });

    // Upsert avoids race conditions between SELECT->INSERT/PATCH.
    await supabaseRequest(
      `/user_plans?on_conflict=user_id`,
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify({ user_id: userId, data: plannerData }),
      }
    );

    logSyncDebug("save:success", { userId });

    return true;
  } catch (error) {
    console.error("Save planner data error:", error);
    logSyncDebug("save:error", {
      userId,
      message: error?.message || String(error),
    });
    throw error;
  }
}

/**
 * Normalize default planner data structure
 */
export function normalizeDefaultData() {
  return {
    subjects: [],
    topics: [],
    tasks: [],
    studySessions: [],
    exams: [],
    todayFocus: [],
    settings: {
      appearance: "light",
      sidebarCollapsed: false,
      dashboardLayout: [...DASHBOARD_WIDGET_IDS],
      deadlineWidget: { activeFilter: "all", defaultFilter: "all" },
    },
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

/**
 * Semesters CRUD
 */
export async function loadSemesters(userId) {
  const rows = await supabaseRequest(
    `/semesters?user_id=eq.${userId}&select=id,name,start_date,end_date,user_id,created_at&order=created_at.asc`,
    {
      method: "GET",
      headers: { apikey: SUPABASE_ANON_KEY },
    }
  );
  return Array.isArray(rows) ? rows : [];
}

export async function createSemester(userId, semester) {
  const rows = await supabaseRequest(
    "/semesters?select=id,name,start_date,end_date,user_id,created_at",
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        user_id: userId,
        name: semester.name,
        start_date: semester.startDate || null,
        end_date: semester.endDate || null,
      }),
    }
  );
  return rows?.[0] || null;
}

export async function updateSemester(userId, semesterId, patch) {
  const rows = await supabaseRequest(
    `/semesters?id=eq.${semesterId}&user_id=eq.${userId}&select=id,name,start_date,end_date,user_id,created_at`,
    {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        name: patch.name,
        start_date: patch.startDate || null,
        end_date: patch.endDate || null,
      }),
    }
  );
  return rows?.[0] || null;
}

export async function deleteSemester(userId, semesterId) {
  await supabaseRequest(
    `/semesters?id=eq.${semesterId}&user_id=eq.${userId}`,
    {
      method: "DELETE",
      headers: { apikey: SUPABASE_ANON_KEY },
    }
  );
}

/**
 * Subjects CRUD (soft-delete via is_archived)
 */
export async function loadSubjects(userId) {
  const rows = await supabaseRequest(
    `/subjects?user_id=eq.${userId}&select=id,name,color,description,goal,target_hours,semester_id,group_id,user_id,is_archived,include_in_learning_plan,priority,new_topic_every_days,next_new_topic_due_at,paused,created_at,updated_at&order=created_at.asc`,
    {
      method: "GET",
      headers: { apikey: SUPABASE_ANON_KEY },
    }
  );
  return Array.isArray(rows) ? rows : [];
}

export async function createSubjectRecord(userId, subject) {
  const rows = await supabaseRequest(
    "/subjects?select=id,name,color,description,goal,target_hours,semester_id,group_id,user_id,is_archived,include_in_learning_plan,priority,new_topic_every_days,next_new_topic_due_at,paused,created_at,updated_at",
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        id: subject.id,
        user_id: userId,
        semester_id: subject.semesterId || subject.groupId || null,
        name: subject.name,
        color: subject.color,
        description: subject.description || "",
        goal: subject.goal || "",
        target_hours: Number(subject.targetHours || 0),
        include_in_learning_plan: subject.includeInLearningPlan ?? true,
        priority: Number.isFinite(Number(subject.priority)) ? Number(subject.priority) : null,
        new_topic_every_days: Math.max(1, Number(subject.newTopicEveryDays || 3)),
        next_new_topic_due_at: toIsoDateTimeOrNull(subject.nextNewTopicDueAt),
        paused: Boolean(subject.paused),
        is_archived: false,
      }),
    }
  );
  return rows?.[0] || null;
}

export async function updateSubjectRecord(userId, subjectId, patch) {
  const body = {};

  if ("semesterId" in patch || "groupId" in patch) {
    body.semester_id = patch.semesterId || patch.groupId || null;
  }
  if ("name" in patch) body.name = patch.name;
  if ("color" in patch) body.color = patch.color;
  if ("description" in patch) body.description = patch.description || "";
  if ("goal" in patch) body.goal = patch.goal || "";
  if ("targetHours" in patch) body.target_hours = Number(patch.targetHours || 0);
  if ("includeInLearningPlan" in patch) body.include_in_learning_plan = Boolean(patch.includeInLearningPlan);
  if ("priority" in patch) body.priority = Number.isFinite(Number(patch.priority)) ? Number(patch.priority) : null;
  if ("newTopicEveryDays" in patch) body.new_topic_every_days = Math.max(1, Number(patch.newTopicEveryDays || 3));
  if ("nextNewTopicDueAt" in patch) body.next_new_topic_due_at = toIsoDateTimeOrNull(patch.nextNewTopicDueAt);
  if ("paused" in patch) body.paused = Boolean(patch.paused);

  const rows = await supabaseRequest(
    `/subjects?id=eq.${subjectId}&user_id=eq.${userId}&select=id,name,color,description,goal,target_hours,semester_id,group_id,user_id,is_archived,include_in_learning_plan,priority,new_topic_every_days,next_new_topic_due_at,paused,created_at,updated_at`,
    {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Prefer: "return=representation",
      },
      body: JSON.stringify(body),
    }
  );
  return rows?.[0] || null;
}

export async function archiveSubjectRecord(userId, subjectId) {
  const rows = await supabaseRequest(
    `/subjects?id=eq.${subjectId}&user_id=eq.${userId}&select=id,name,color,description,goal,target_hours,semester_id,group_id,user_id,is_archived,include_in_learning_plan,priority,new_topic_every_days,next_new_topic_due_at,paused,created_at,updated_at`,
    {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Prefer: "return=representation",
      },
      body: JSON.stringify({ is_archived: true }),
    }
  );
  return rows?.[0] || null;
}

export async function unarchiveSubjectRecord(userId, subjectId) {
  const rows = await supabaseRequest(
    `/subjects?id=eq.${subjectId}&user_id=eq.${userId}&select=id,name,color,description,goal,target_hours,semester_id,group_id,user_id,is_archived,include_in_learning_plan,priority,new_topic_every_days,next_new_topic_due_at,paused,created_at,updated_at`,
    {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Prefer: "return=representation",
      },
      body: JSON.stringify({ is_archived: false }),
    }
  );
  return rows?.[0] || null;
}

export async function deleteSubjectRecord(userId, subjectId) {
  await supabaseRequest(
    `/subjects?id=eq.${subjectId}&user_id=eq.${userId}`,
    {
      method: "DELETE",
      headers: { apikey: SUPABASE_ANON_KEY },
    }
  );
}

const TOPIC_SELECT = "id,subject_id,user_id,title,order_index,status,last_studied_at,next_review_at,review_step,completed,is_paused_today,created_at,updated_at";

export async function loadTopics(userId) {
  const rows = await supabaseRequest(
    `/topics?user_id=eq.${userId}&select=${TOPIC_SELECT}&order=order_index.asc`,
    {
      method: "GET",
      headers: { apikey: SUPABASE_ANON_KEY },
    }
  );
  return Array.isArray(rows) ? rows : [];
}

export async function createTopicRecord(userId, topic) {
  const rows = await supabaseRequest(
    `/topics?select=${TOPIC_SELECT}`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        id: topic.id,
        user_id: userId,
        subject_id: topic.subjectId,
        title: topic.title,
        order_index: Math.max(0, Number(topic.orderIndex || 0)),
        status: topic.status || "new",
        last_studied_at: toIsoDateTimeOrNull(topic.lastStudiedAt),
        next_review_at: toIsoDateTimeOrNull(topic.nextReviewAt),
        review_step: Math.max(0, Number(topic.reviewStep || 0)),
        completed: Boolean(topic.completed),
        is_paused_today: Boolean(topic.isPausedToday),
      }),
    }
  );
  return rows?.[0] || null;
}

export async function updateTopicRecord(userId, topicId, patch) {
  const payload = {};

  if (Object.prototype.hasOwnProperty.call(patch, "subjectId")) payload.subject_id = patch.subjectId;
  if (Object.prototype.hasOwnProperty.call(patch, "title")) payload.title = patch.title;
  if (Object.prototype.hasOwnProperty.call(patch, "orderIndex")) payload.order_index = Math.max(0, Number(patch.orderIndex || 0));
  if (Object.prototype.hasOwnProperty.call(patch, "status")) payload.status = patch.status;
  if (Object.prototype.hasOwnProperty.call(patch, "lastStudiedAt")) payload.last_studied_at = toIsoDateTimeOrNull(patch.lastStudiedAt);
  if (Object.prototype.hasOwnProperty.call(patch, "nextReviewAt")) payload.next_review_at = toIsoDateTimeOrNull(patch.nextReviewAt);
  if (Object.prototype.hasOwnProperty.call(patch, "reviewStep")) payload.review_step = Math.max(0, Number(patch.reviewStep || 0));
  if (Object.prototype.hasOwnProperty.call(patch, "completed")) payload.completed = Boolean(patch.completed);
  if (Object.prototype.hasOwnProperty.call(patch, "isPausedToday")) payload.is_paused_today = Boolean(patch.isPausedToday);

  const rows = await supabaseRequest(
    `/topics?id=eq.${topicId}&user_id=eq.${userId}&select=${TOPIC_SELECT}`,
    {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Prefer: "return=representation",
      },
      body: JSON.stringify(payload),
    }
  );

  return rows?.[0] || null;
}

export async function deleteTopicRecord(userId, topicId) {
  await supabaseRequest(
    `/topics?id=eq.${topicId}&user_id=eq.${userId}`,
    {
      method: "DELETE",
      headers: { apikey: SUPABASE_ANON_KEY },
    }
  );
}

const EXAM_SELECT = "id,user_id,subject_id,title,exam_date,exam_time,location,notes,status,is_archived,created_at,updated_at";

function mapExamRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    subjectId: row.subject_id || "",
    title: row.title || "",
    examDate: row.exam_date || "",
    examTime: row.exam_time || "",
    location: row.location || "",
    notes: row.notes || "",
    status: row.status === "written" ? "written" : "open",
    isArchived: Boolean(row.is_archived),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function loadExams(userId) {
  const rows = await supabaseRequest(
    `/exams?user_id=eq.${userId}&select=${EXAM_SELECT}&order=exam_date.asc,exam_time.asc.nulls_last,created_at.asc`,
    {
      method: "GET",
      headers: { apikey: SUPABASE_ANON_KEY },
    }
  );
  return Array.isArray(rows) ? rows.map(mapExamRow).filter(Boolean) : [];
}

export async function createExamRecord(userId, exam) {
  const rows = await supabaseRequest(
    `/exams?select=${EXAM_SELECT}`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        id: exam.id,
        user_id: userId,
        subject_id: exam.subjectId || null,
        title: exam.title,
        exam_date: exam.examDate || null,
        exam_time: exam.examTime || null,
        location: exam.location || null,
        notes: exam.notes || null,
        status: exam.status === "written" ? "written" : "open",
        is_archived: Boolean(exam.isArchived),
      }),
    }
  );
  return mapExamRow(rows?.[0] || null);
}

export async function updateExamRecord(userId, examId, patch) {
  const payload = {};

  if (Object.prototype.hasOwnProperty.call(patch, "subjectId")) payload.subject_id = patch.subjectId || null;
  if (Object.prototype.hasOwnProperty.call(patch, "title")) payload.title = patch.title;
  if (Object.prototype.hasOwnProperty.call(patch, "examDate")) payload.exam_date = patch.examDate || null;
  if (Object.prototype.hasOwnProperty.call(patch, "examTime")) payload.exam_time = patch.examTime || null;
  if (Object.prototype.hasOwnProperty.call(patch, "location")) payload.location = patch.location || null;
  if (Object.prototype.hasOwnProperty.call(patch, "notes")) payload.notes = patch.notes || null;
  if (Object.prototype.hasOwnProperty.call(patch, "status")) payload.status = patch.status === "written" ? "written" : "open";
  if (Object.prototype.hasOwnProperty.call(patch, "isArchived")) payload.is_archived = Boolean(patch.isArchived);

  const rows = await supabaseRequest(
    `/exams?id=eq.${examId}&user_id=eq.${userId}&select=${EXAM_SELECT}`,
    {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Prefer: "return=representation",
      },
      body: JSON.stringify(payload),
    }
  );

  return mapExamRow(rows?.[0] || null);
}

export async function deleteExamRecord(userId, examId) {
  await supabaseRequest(
    `/exams?id=eq.${examId}&user_id=eq.${userId}`,
    {
      method: "DELETE",
      headers: { apikey: SUPABASE_ANON_KEY },
    }
  );
}

export async function markTopicAsLearnedNew(userId, topic, subject, options = {}) {
  const now = new Date();
  const nextReviewAt = calculateNextReviewAt(0, now, options.maxReviewGapDuringSemester || MAX_REVIEW_GAP_DURING_SEMESTER);
  const newTopicEveryDays = Math.max(1, Number(subject?.newTopicEveryDays || 3));
  const nextNewTopicDueAt = addDays(now, newTopicEveryDays).toISOString();

  const [updatedTopic] = await Promise.all([
    updateTopicRecord(userId, topic.id, {
      status: "review",
      reviewStep: 0,
      lastStudiedAt: now.toISOString(),
      nextReviewAt,
      isPausedToday: false,
      completed: false,
    }),
    updateSubjectRecord(userId, subject.id, {
      ...subject,
      nextNewTopicDueAt,
    }),
  ]);

  return { updatedTopic, nextNewTopicDueAt };
}

export async function markTopicAsReviewed(userId, topic, options = {}) {
  const now = new Date();
  const currentStep = Math.max(0, Number(topic?.reviewStep || 0));
  const nextStep = currentStep + 1;
  const nextReviewAt = calculateNextReviewAt(nextStep, now, options.maxReviewGapDuringSemester || MAX_REVIEW_GAP_DURING_SEMESTER);

  const updatedTopic = await updateTopicRecord(userId, topic.id, {
    status: "review",
    reviewStep: nextStep,
    lastStudiedAt: now.toISOString(),
    nextReviewAt,
    isPausedToday: false,
  });

  return updatedTopic;
}

const TIMER_SESSION_SELECT = "id,user_id,subject_id,mode,preset_minutes,started_at,paused_at,total_pause_seconds,status,created_at,updated_at";

function mapTimerSession(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    subjectId: row.subject_id,
    mode: row.mode || "stopwatch",
    presetMinutes: Number(row.preset_minutes || 90),
    startedAt: row.started_at,
    pausedAt: row.paused_at,
    totalPauseSeconds: Number(row.total_pause_seconds || 0),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function loadActiveTimerSession(userId) {
  const rows = await supabaseRequest(
    `/timer_sessions?user_id=eq.${userId}&status=in.(running,paused)&select=${TIMER_SESSION_SELECT}&order=created_at.desc&limit=1`,
    {
      method: "GET",
      headers: { apikey: SUPABASE_ANON_KEY },
    }
  );
  return mapTimerSession(rows?.[0] || null);
}

async function loadTimerSessionById(userId, sessionId) {
  const rows = await supabaseRequest(
    `/timer_sessions?id=eq.${sessionId}&user_id=eq.${userId}&select=${TIMER_SESSION_SELECT}&limit=1`,
    {
      method: "GET",
      headers: { apikey: SUPABASE_ANON_KEY },
    }
  );
  return mapTimerSession(rows?.[0] || null);
}

export async function startTimerSession(userId, subjectId, options = {}) {
  const existing = await loadActiveTimerSession(userId);
  if (existing) return existing;

  const mode = options.mode === "pomodoro" ? "pomodoro" : "stopwatch";
  const presetMinutes = Math.max(1, Number(options.presetMinutes || 90));
  const nowIso = new Date().toISOString();

  try {
    const rows = await supabaseRequest(
      `/timer_sessions?select=${TIMER_SESSION_SELECT}`,
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          user_id: userId,
          subject_id: subjectId,
          mode,
          preset_minutes: presetMinutes,
          started_at: nowIso,
          paused_at: null,
          total_pause_seconds: 0,
          status: "running",
        }),
      }
    );
    return mapTimerSession(rows?.[0] || null);
  } catch (error) {
    const message = String(error?.message || "").toLowerCase();
    if (message.includes("duplicate") || message.includes("unique")) {
      return loadActiveTimerSession(userId);
    }
    throw error;
  }
}

export async function pauseTimerSession(userId, sessionId) {
  const nowIso = new Date().toISOString();
  const rows = await supabaseRequest(
    `/timer_sessions?id=eq.${sessionId}&user_id=eq.${userId}&status=eq.running&select=${TIMER_SESSION_SELECT}`,
    {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        status: "paused",
        paused_at: nowIso,
      }),
    }
  );

  if (rows?.[0]) return mapTimerSession(rows[0]);
  return loadTimerSessionById(userId, sessionId);
}

export async function resumeTimerSession(userId, sessionId) {
  const existing = await loadTimerSessionById(userId, sessionId);
  if (!existing) return null;
  if (existing.status !== "paused") return existing;

  const pausedAtMs = existing.pausedAt ? new Date(existing.pausedAt).getTime() : Date.now();
  const additionalPause = Math.max(0, Math.floor((Date.now() - pausedAtMs) / 1000));
  const updatedPauseSeconds = Number(existing.totalPauseSeconds || 0) + additionalPause;

  const rows = await supabaseRequest(
    `/timer_sessions?id=eq.${sessionId}&user_id=eq.${userId}&status=eq.paused&select=${TIMER_SESSION_SELECT}`,
    {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        status: "running",
        paused_at: null,
        total_pause_seconds: updatedPauseSeconds,
      }),
    }
  );

  if (rows?.[0]) return mapTimerSession(rows[0]);
  return loadTimerSessionById(userId, sessionId);
}

export async function finishTimerSession(userId, sessionId) {
  const rows = await supabaseRequest(
    `/timer_sessions?id=eq.${sessionId}&user_id=eq.${userId}&status=in.(running,paused)&select=${TIMER_SESSION_SELECT}`,
    {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        status: "finished",
        paused_at: null,
      }),
    }
  );
  return mapTimerSession(rows?.[0] || null);
}

export async function cancelTimerSession(userId, sessionId) {
  const rows = await supabaseRequest(
    `/timer_sessions?id=eq.${sessionId}&user_id=eq.${userId}&status=in.(running,paused)&select=${TIMER_SESSION_SELECT}`,
    {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        status: "cancelled",
        paused_at: null,
      }),
    }
  );
  return mapTimerSession(rows?.[0] || null);
}
