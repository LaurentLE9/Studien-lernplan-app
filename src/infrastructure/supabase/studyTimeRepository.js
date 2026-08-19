import { normalizeConfidence } from "@/domain/academics/topic";
import { normalizeActivityType } from "@/domain/study/activity";
import { clampPostgresDurationMinutes } from "@/domain/study/integer";
import { getSupabaseAnonKey } from "./client";
import { toIsoDateTimeOrNull } from "./dateMapping";
import { supabaseRequest } from "./restRepository";

export const STUDY_TIME_ENTRY_SELECT = "id,user_id,semester_id,subject_id,topic_id,task_id,duration_minutes,source,notes,activity_type,confidence,review_updated,recorded_at,created_at,updated_at";

const requestHeaders = () => ({ apikey: getSupabaseAnonKey() });

function assertValidDurationMinutes(value) {
  if (!Number.isFinite(Number(value)) || Number(value) <= 0) {
    throw new Error("durationMinutes muss größer als 0 sein");
  }
}

export function mapStudyTimeEntryRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    ...(row.semester_id ? { semesterId: row.semester_id } : {}),
    subjectId: row.subject_id,
    topicId: row.topic_id || null,
    taskId: row.task_id || null,
    durationMinutes: Number(row.duration_minutes || 0),
    source: row.source || "manual",
    notes: row.notes || "",
    activityType: normalizeActivityType(row.activity_type),
    confidence: row.confidence ? normalizeConfidence(row.confidence) : null,
    reviewUpdated: Boolean(row.review_updated),
    recordedAt: row.recorded_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapStudyTimeEntryCreate(userId, entry, nowIso = new Date().toISOString()) {
  if (!entry.semesterId) throw new Error("semesterId ist für Lernzeiten erforderlich");
  if (!entry.subjectId) throw new Error("subjectId ist erforderlich");
  assertValidDurationMinutes(entry.durationMinutes);

  return {
    id: entry.id || crypto.randomUUID(),
    user_id: userId,
    subject_id: entry.subjectId,
    topic_id: entry.topicId || null,
    task_id: entry.taskId || null,
    duration_minutes: clampPostgresDurationMinutes(entry.durationMinutes),
    source: entry.source || "manual",
    notes: entry.notes || "",
    activity_type: normalizeActivityType(entry.activityType || entry.activity_type),
    confidence: entry.confidence ? normalizeConfidence(entry.confidence) : null,
    review_updated: Boolean(entry.reviewUpdated || entry.review_updated),
    recorded_at: toIsoDateTimeOrNull(entry.recordedAt) || nowIso,
    ...(entry.semesterId ? { semester_id: entry.semesterId } : {}),
  };
}

export function mapStudyTimeEntryPatch(patch) {
  const row = {};
  if ("durationMinutes" in patch) {
    assertValidDurationMinutes(patch.durationMinutes);
    row.duration_minutes = clampPostgresDurationMinutes(patch.durationMinutes);
  }
  if ("notes" in patch) row.notes = patch.notes || "";
  if ("taskId" in patch) row.task_id = patch.taskId || null;
  if ("topicId" in patch) row.topic_id = patch.topicId || null;
  if ("source" in patch) row.source = patch.source || "manual";
  if ("activityType" in patch) row.activity_type = normalizeActivityType(patch.activityType);
  if ("confidence" in patch) row.confidence = patch.confidence ? normalizeConfidence(patch.confidence) : null;
  if ("reviewUpdated" in patch) row.review_updated = Boolean(patch.reviewUpdated);
  if ("recordedAt" in patch) row.recorded_at = toIsoDateTimeOrNull(patch.recordedAt);
  return row;
}

export async function loadStudyTimeEntries(userId, options = {}) {
  if (!options.semesterId) throw new Error("semesterId ist zum Laden von Lernzeiten erforderlich");
  let query = `/study_time_entries?user_id=eq.${userId}&select=${STUDY_TIME_ENTRY_SELECT}`;
  if (options.semesterId) query += `&semester_id=eq.${options.semesterId}`;
  if (Array.isArray(options.subjectIds) && options.subjectIds.length) {
    query += `&subject_id=in.(${options.subjectIds.join(",")})`;
  }
  if (options.subjectId) query += `&subject_id=eq.${options.subjectId}`;
  if (options.topicId) query += `&topic_id=eq.${options.topicId}`;
  if (options.taskId) query += `&task_id=eq.${encodeURIComponent(options.taskId)}`;
  query += "&order=recorded_at.desc";
  if (options.limit) query += `&limit=${Math.max(1, Number(options.limit))}`;

  const rows = await supabaseRequest(query, { method: "GET", headers: requestHeaders() });
  return Array.isArray(rows) ? rows.map(mapStudyTimeEntryRow) : [];
}

export async function createStudyTimeEntry(userId, entry) {
  const rows = await supabaseRequest(`/study_time_entries?select=${STUDY_TIME_ENTRY_SELECT}`, {
    method: "POST",
    headers: { ...requestHeaders(), Prefer: "return=representation" },
    body: JSON.stringify(mapStudyTimeEntryCreate(userId, entry)),
  });
  return mapStudyTimeEntryRow(rows?.[0] || null);
}

export async function updateStudyTimeEntry(userId, entryId, patch, options = {}) {
  if (!options.semesterId) throw new Error("semesterId ist zum Ändern von Lernzeiten erforderlich");
  const rows = await supabaseRequest(
    `/study_time_entries?id=eq.${entryId}&user_id=eq.${userId}&semester_id=eq.${options.semesterId}&select=${STUDY_TIME_ENTRY_SELECT}`,
    {
      method: "PATCH",
      headers: { ...requestHeaders(), Prefer: "return=representation" },
      body: JSON.stringify(mapStudyTimeEntryPatch(patch)),
    },
  );
  return mapStudyTimeEntryRow(rows?.[0] || null);
}

export async function deleteStudyTimeEntry(userId, entryId, options = {}) {
  if (!options.semesterId) throw new Error("semesterId ist zum Löschen von Lernzeiten erforderlich");
  await supabaseRequest(`/study_time_entries?id=eq.${entryId}&user_id=eq.${userId}&semester_id=eq.${options.semesterId}`, {
    method: "DELETE",
    headers: requestHeaders(),
  });
}

async function getTotalTime(userId, relationName, relationId) {
  const rows = await supabaseRequest(
    `/study_time_entries?user_id=eq.${userId}&${relationName}=eq.${relationId}&select=duration_minutes`,
    { method: "GET", headers: requestHeaders() },
  );
  if (!Array.isArray(rows)) return 0;
  return rows.reduce((sum, row) => sum + Number(row.duration_minutes || 0), 0);
}

export function getTotalTimeForTopic(userId, topicId) {
  return getTotalTime(userId, "topic_id", topicId);
}

export function getTotalTimeForSubject(userId, subjectId) {
  return getTotalTime(userId, "subject_id", subjectId);
}
