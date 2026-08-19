import { normalizeConfidence, normalizeTopicStatus } from "@/domain/academics/topic";
import { getSupabaseAnonKey } from "./client";
import { toIsoDateTimeOrNull } from "./dateMapping";
import { logSyncDebug, supabaseRequest } from "./restRepository";

export const TOPIC_SELECT = "id,semester_id,subject_id,user_id,title,order_index,status,cheatsheet_text,cheatsheet_url,confidence,last_studied_at,next_review_at,review_count,review_step,completed,is_paused_today,archived_at,created_at,updated_at";

const requestHeaders = () => ({ apikey: getSupabaseAnonKey() });

export function mapTopicRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    semester_id: row.semester_id || null,
    subject_id: row.subject_id,
    user_id: row.user_id,
    title: row.title,
    order_index: row.order_index,
    status: row.status,
    cheatsheet_text: row.cheatsheet_text,
    cheatsheet_url: row.cheatsheet_url,
    confidence: row.confidence,
    last_studied_at: row.last_studied_at,
    next_review_at: row.next_review_at,
    review_count: row.review_count,
    review_step: row.review_step,
    completed: row.completed,
    is_paused_today: row.is_paused_today,
    archived_at: row.archived_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapTopicCreate(userId, topic) {
  if (!topic.semesterId) throw new Error("semesterId ist für Themen erforderlich");
  return {
    id: topic.id,
    semester_id: topic.semesterId || null,
    user_id: userId,
    subject_id: topic.subjectId,
    title: topic.title,
    order_index: Math.max(0, Number(topic.orderIndex || 0)),
    status: normalizeTopicStatus(topic.status || "new"),
    cheatsheet_text: topic.cheatsheetText || "",
    cheatsheet_url: topic.cheatsheetUrl || null,
    confidence: normalizeConfidence(topic.confidence),
    last_studied_at: toIsoDateTimeOrNull(topic.lastStudiedAt),
    next_review_at: toIsoDateTimeOrNull(topic.nextReviewAt),
    review_count: Math.max(0, Number(topic.reviewCount || 0)),
    review_step: Math.max(0, Number(topic.reviewStep || 0)),
    completed: Boolean(topic.completed),
    is_paused_today: Boolean(topic.isPausedToday),
    archived_at: toIsoDateTimeOrNull(topic.archivedAt),
  };
}

export function mapTopicPatch(patch) {
  const row = {};
  if ("subjectId" in patch) row.subject_id = patch.subjectId;
  if ("title" in patch) row.title = patch.title;
  if ("orderIndex" in patch) row.order_index = Math.max(0, Number(patch.orderIndex || 0));
  if ("status" in patch) row.status = normalizeTopicStatus(patch.status);
  if ("cheatsheetText" in patch) row.cheatsheet_text = patch.cheatsheetText || "";
  if ("cheatsheetUrl" in patch) row.cheatsheet_url = patch.cheatsheetUrl || null;
  if ("confidence" in patch) row.confidence = normalizeConfidence(patch.confidence);
  if ("lastStudiedAt" in patch) row.last_studied_at = toIsoDateTimeOrNull(patch.lastStudiedAt);
  if ("nextReviewAt" in patch) row.next_review_at = toIsoDateTimeOrNull(patch.nextReviewAt);
  if ("reviewCount" in patch) row.review_count = Math.max(0, Number(patch.reviewCount || 0));
  if ("reviewStep" in patch) row.review_step = Math.max(0, Number(patch.reviewStep || 0));
  if ("completed" in patch) row.completed = Boolean(patch.completed);
  if ("isPausedToday" in patch) row.is_paused_today = Boolean(patch.isPausedToday);
  if ("archivedAt" in patch) row.archived_at = toIsoDateTimeOrNull(patch.archivedAt);
  return row;
}

export async function loadTopics(userId, options = {}) {
  if (!options.semesterId) throw new Error("semesterId ist zum Laden von Themen erforderlich");
  try {
    const rows = await supabaseRequest(`/topics?user_id=eq.${userId}&semester_id=eq.${options.semesterId}&select=${TOPIC_SELECT}&order=order_index.asc`, {
      method: "GET",
      headers: requestHeaders(),
    });
    logSyncDebug("loadTopics:success", { userId, count: Array.isArray(rows) ? rows.length : 0 });
    return Array.isArray(rows) ? rows.map(mapTopicRow).filter(Boolean) : [];
  } catch (error) {
    logSyncDebug("loadTopics:error", { userId, error: error?.message });
    throw error;
  }
}

export async function createTopicRecord(userId, topic) {
  const rows = await supabaseRequest(`/topics?select=${TOPIC_SELECT}`, {
    method: "POST",
    headers: { ...requestHeaders(), Prefer: "return=representation" },
    body: JSON.stringify(mapTopicCreate(userId, topic)),
  });
  return mapTopicRow(rows?.[0]);
}

export async function updateTopicRecord(userId, topicId, patch, options = {}) {
  if (!options.semesterId) throw new Error("semesterId ist zum Ändern von Themen erforderlich");
  const rows = await supabaseRequest(`/topics?id=eq.${topicId}&user_id=eq.${userId}&semester_id=eq.${options.semesterId}&select=${TOPIC_SELECT}`, {
    method: "PATCH",
    headers: { ...requestHeaders(), Prefer: "return=representation" },
    body: JSON.stringify(mapTopicPatch(patch)),
  });
  return mapTopicRow(rows?.[0]);
}

export async function deleteTopicRecord(userId, topicId, options = {}) {
  if (!options.semesterId) throw new Error("semesterId ist zum Löschen von Themen erforderlich");
  await supabaseRequest(`/topics?id=eq.${topicId}&user_id=eq.${userId}&semester_id=eq.${options.semesterId}`, {
    method: "DELETE",
    headers: requestHeaders(),
  });
}
