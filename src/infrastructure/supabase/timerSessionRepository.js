import { clampPostgresInteger, POSTGRES_INTEGER_MAX } from "@/domain/study/integer";
import { getSupabaseAnonKey } from "./client";
import { supabaseRequest } from "./restRepository";

export const TIMER_SESSION_SELECT = "id,user_id,subject_id,mode,preset_minutes,started_at,paused_at,total_pause_seconds,status,created_at,updated_at";

const requestHeaders = () => ({ apikey: getSupabaseAnonKey() });

export function mapTimerSessionRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    subjectId: row.subject_id,
    mode: row.mode || "stopwatch",
    presetMinutes: clampPostgresInteger(row.preset_minutes, { minimum: 1, fallback: 90 }),
    startedAt: row.started_at,
    pausedAt: row.paused_at,
    totalPauseSeconds: clampPostgresInteger(row.total_pause_seconds),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapTimerSessionCreate(userId, subjectId, options = {}, nowIso = new Date().toISOString()) {
  return {
    user_id: userId,
    subject_id: subjectId,
    mode: options.mode === "pomodoro" ? "pomodoro" : "stopwatch",
    preset_minutes: clampPostgresInteger(options.presetMinutes, { minimum: 1, fallback: 90 }),
    started_at: nowIso,
    paused_at: null,
    total_pause_seconds: 0,
    status: "running",
  };
}

export function calculateAccumulatedPauseSeconds(session, nowMs = Date.now()) {
  const persisted = clampPostgresInteger(session?.totalPauseSeconds);
  const pausedAtMs = session?.pausedAt ? new Date(session.pausedAt).getTime() : Number.NaN;
  if (!Number.isFinite(pausedAtMs) || !Number.isFinite(nowMs)) return persisted;

  const additionalPause = Math.max(0, Math.floor((nowMs - pausedAtMs) / 1000));
  return Math.min(POSTGRES_INTEGER_MAX, persisted + additionalPause);
}

export async function loadActiveTimerSession(userId) {
  const rows = await supabaseRequest(
    `/timer_sessions?user_id=eq.${userId}&status=in.(running,paused)&select=${TIMER_SESSION_SELECT}&order=created_at.desc&limit=1`,
    { method: "GET", headers: requestHeaders() },
  );
  return mapTimerSessionRow(rows?.[0] || null);
}

async function loadTimerSessionById(userId, sessionId) {
  const rows = await supabaseRequest(
    `/timer_sessions?id=eq.${sessionId}&user_id=eq.${userId}&select=${TIMER_SESSION_SELECT}&limit=1`,
    { method: "GET", headers: requestHeaders() },
  );
  return mapTimerSessionRow(rows?.[0] || null);
}

export async function startTimerSession(userId, subjectId, options = {}) {
  const existing = await loadActiveTimerSession(userId);
  if (existing) return existing;

  try {
    const rows = await supabaseRequest(`/timer_sessions?select=${TIMER_SESSION_SELECT}`, {
      method: "POST",
      headers: { ...requestHeaders(), Prefer: "return=representation" },
      body: JSON.stringify(mapTimerSessionCreate(userId, subjectId, options)),
    });
    return mapTimerSessionRow(rows?.[0] || null);
  } catch (error) {
    const message = String(error?.message || "").toLowerCase();
    if (message.includes("duplicate") || message.includes("unique")) {
      return loadActiveTimerSession(userId);
    }
    throw error;
  }
}

export async function pauseTimerSession(userId, sessionId) {
  const rows = await supabaseRequest(
    `/timer_sessions?id=eq.${sessionId}&user_id=eq.${userId}&status=eq.running&select=${TIMER_SESSION_SELECT}`,
    {
      method: "PATCH",
      headers: { ...requestHeaders(), Prefer: "return=representation" },
      body: JSON.stringify({ status: "paused", paused_at: new Date().toISOString() }),
    },
  );
  if (rows?.[0]) return mapTimerSessionRow(rows[0]);
  return loadTimerSessionById(userId, sessionId);
}

export async function resumeTimerSession(userId, sessionId) {
  const existing = await loadTimerSessionById(userId, sessionId);
  if (!existing) return null;
  if (existing.status !== "paused") return existing;

  const rows = await supabaseRequest(
    `/timer_sessions?id=eq.${sessionId}&user_id=eq.${userId}&status=eq.paused&select=${TIMER_SESSION_SELECT}`,
    {
      method: "PATCH",
      headers: { ...requestHeaders(), Prefer: "return=representation" },
      body: JSON.stringify({
        status: "running",
        paused_at: null,
        total_pause_seconds: calculateAccumulatedPauseSeconds(existing),
      }),
    },
  );
  if (rows?.[0]) return mapTimerSessionRow(rows[0]);
  return loadTimerSessionById(userId, sessionId);
}

async function closeTimerSession(userId, sessionId, status) {
  const rows = await supabaseRequest(
    `/timer_sessions?id=eq.${sessionId}&user_id=eq.${userId}&status=in.(running,paused)&select=${TIMER_SESSION_SELECT}`,
    {
      method: "PATCH",
      headers: { ...requestHeaders(), Prefer: "return=representation" },
      body: JSON.stringify({ status, paused_at: null }),
    },
  );
  return mapTimerSessionRow(rows?.[0] || null);
}

export function finishTimerSession(userId, sessionId) {
  return closeTimerSession(userId, sessionId, "finished");
}

export function cancelTimerSession(userId, sessionId) {
  return closeTimerSession(userId, sessionId, "cancelled");
}
