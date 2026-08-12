import {
  normalizeDefaultData,
  normalizePlannerSnapshot,
} from "@/domain/planner/plannerSnapshot";
import { SupabaseRequestError } from "./client";
import { getActiveSession } from "./authRepository";
import {
  buildPlannerSnapshotUpsert,
  readPlannerSnapshotRow,
} from "./plannerSnapshotMapper";
import { logSyncDebug, supabaseRequest } from "./restRepository";

export const PLANNER_SNAPSHOT_ERROR_CODES = {
  AUTH_REQUIRED: "PLANNER_AUTH_REQUIRED",
  LOAD_FAILED: "PLANNER_LOAD_FAILED",
  SAVE_FAILED: "PLANNER_SAVE_FAILED",
  SCHEMA_ERROR: "PLANNER_SCHEMA_ERROR",
  TRANSPORT_ERROR: "PLANNER_TRANSPORT_ERROR",
};

export class PlannerSnapshotError extends Error {
  constructor(message, { code, operation, cause } = {}) {
    super(message, { cause });
    this.name = "PlannerSnapshotError";
    this.code = code;
    this.operation = operation;
  }
}

function categorizePlannerSnapshotError(error, operation) {
  if (error instanceof PlannerSnapshotError) return error;

  const message = error?.message || String(error);
  const schemaError = message.includes("public.user_plans") || message.toLowerCase().includes("schema-cache");
  const fallbackCode = operation === "load"
    ? PLANNER_SNAPSHOT_ERROR_CODES.LOAD_FAILED
    : PLANNER_SNAPSHOT_ERROR_CODES.SAVE_FAILED;

  return new PlannerSnapshotError(message, {
    code: schemaError
      ? PLANNER_SNAPSHOT_ERROR_CODES.SCHEMA_ERROR
      : error instanceof SupabaseRequestError
        ? PLANNER_SNAPSHOT_ERROR_CODES.TRANSPORT_ERROR
        : fallbackCode,
    operation,
    cause: error,
  });
}

async function requireActiveSession(operation) {
  const session = await getActiveSession();
  if (session) return session;

  throw new PlannerSnapshotError("No active session", {
    code: PLANNER_SNAPSHOT_ERROR_CODES.AUTH_REQUIRED,
    operation,
  });
}

export async function loadUserPlannerData(userId) {
  try {
    const session = await requireActiveSession("load");
    logSyncDebug("load:start", {
      userId,
      sessionUserId: session?.user?.id || null,
    });

    const rows = await supabaseRequest(
      `/user_plans?user_id=eq.${userId}&select=data`,
      { method: "GET" },
    );
    const { found, snapshot } = readPlannerSnapshotRow(rows);

    if (!found) {
      logSyncDebug("load:success", { userId, hasData: false });
      return normalizeDefaultData();
    }

    logSyncDebug("load:success", {
      userId,
      hasData: true,
      counts: {
        subjects: Array.isArray(snapshot.subjects) ? snapshot.subjects.length : 0,
        tasks: Array.isArray(snapshot.tasks) ? snapshot.tasks.length : 0,
        studySessions: Array.isArray(snapshot.studySessions) ? snapshot.studySessions.length : 0,
        exams: Array.isArray(snapshot.exams) ? snapshot.exams.length : 0,
        todayFocus: Array.isArray(snapshot.todayFocus) ? snapshot.todayFocus.length : 0,
      },
    });

    return normalizePlannerSnapshot(snapshot);
  } catch (error) {
    const categorizedError = categorizePlannerSnapshotError(error, "load");
    console.error("Load planner data error:", categorizedError);
    logSyncDebug("load:error", { userId, message: categorizedError.message });
    throw categorizedError;
  }
}

export async function saveUserPlannerData(userId, plannerData) {
  try {
    const session = await requireActiveSession("save");
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

    await supabaseRequest(
      "/user_plans?on_conflict=user_id",
      {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(buildPlannerSnapshotUpsert(userId, plannerData)),
      },
    );

    logSyncDebug("save:success", { userId });
    return true;
  } catch (error) {
    const categorizedError = categorizePlannerSnapshotError(error, "save");
    console.error("Save planner data error:", categorizedError);
    logSyncDebug("save:error", { userId, message: categorizedError.message });
    throw categorizedError;
  }
}
