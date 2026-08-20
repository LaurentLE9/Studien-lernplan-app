import { getSupabaseAnonKey } from "./client";
import { toIsoDateTimeOrNull } from "./dateMapping";
import { supabaseRequest } from "./restRepository";

export const SUBJECT_SELECT = "id,name,color,description,goal,target_hours,semester_id,group_id,user_id,is_archived,include_in_learning_plan,priority,new_topic_every_days,next_new_topic_due_at,paused,last_studied_at,next_review_at,review_step,last_studied_minutes,study_count,created_at,updated_at";

const requestHeaders = () => ({ apikey: getSupabaseAnonKey() });

export function mapSubjectRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    description: row.description,
    goal: row.goal,
    target_hours: row.target_hours,
    semester_id: row.semester_id,
    group_id: row.group_id,
    user_id: row.user_id,
    is_archived: row.is_archived,
    include_in_learning_plan: row.include_in_learning_plan,
    priority: row.priority,
    new_topic_every_days: row.new_topic_every_days,
    next_new_topic_due_at: row.next_new_topic_due_at,
    paused: row.paused,
    last_studied_at: row.last_studied_at,
    next_review_at: row.next_review_at,
    review_step: row.review_step,
    last_studied_minutes: row.last_studied_minutes,
    study_count: row.study_count,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapSubjectCreate(userId, subject) {
  if (!subject.semesterId && !subject.groupId) throw new Error("semesterId ist für Fächer erforderlich");
  return {
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
    last_studied_at: toIsoDateTimeOrNull(subject.lastStudiedAt),
    next_review_at: toIsoDateTimeOrNull(subject.nextReviewAt),
    review_step: Math.max(0, Number(subject.reviewStep || 0)),
    last_studied_minutes: Math.max(0, Math.round(Number(subject.lastStudiedMinutes || 0))),
    study_count: Math.max(0, Math.round(Number(subject.studyCount || 0))),
    is_archived: false,
  };
}

export function mapSubjectPatch(patch) {
  const row = {};
  if ("semesterId" in patch || "groupId" in patch) row.semester_id = patch.semesterId || patch.groupId || null;
  if ("name" in patch) row.name = patch.name;
  if ("color" in patch) row.color = patch.color;
  if ("description" in patch) row.description = patch.description || "";
  if ("goal" in patch) row.goal = patch.goal || "";
  if ("targetHours" in patch) row.target_hours = Number(patch.targetHours || 0);
  if ("includeInLearningPlan" in patch) row.include_in_learning_plan = Boolean(patch.includeInLearningPlan);
  if ("priority" in patch) row.priority = Number.isFinite(Number(patch.priority)) ? Number(patch.priority) : null;
  if ("newTopicEveryDays" in patch) row.new_topic_every_days = Math.max(1, Number(patch.newTopicEveryDays || 3));
  if ("nextNewTopicDueAt" in patch) row.next_new_topic_due_at = toIsoDateTimeOrNull(patch.nextNewTopicDueAt);
  if ("paused" in patch) row.paused = Boolean(patch.paused);
  if ("lastStudiedAt" in patch) row.last_studied_at = toIsoDateTimeOrNull(patch.lastStudiedAt);
  if ("nextReviewAt" in patch) row.next_review_at = toIsoDateTimeOrNull(patch.nextReviewAt);
  if ("reviewStep" in patch) row.review_step = Math.max(0, Number(patch.reviewStep || 0));
  if ("lastStudiedMinutes" in patch) row.last_studied_minutes = Math.max(0, Math.round(Number(patch.lastStudiedMinutes || 0)));
  if ("studyCount" in patch) row.study_count = Math.max(0, Math.round(Number(patch.studyCount || 0)));
  return row;
}

export async function loadSubjects(userId, options = {}) {
  if (!options.semesterId) throw new Error("semesterId ist zum Laden von Fächern erforderlich");
  const rows = await supabaseRequest(`/subjects?user_id=eq.${userId}&semester_id=eq.${options.semesterId}&select=${SUBJECT_SELECT}&order=created_at.asc`, {
    method: "GET",
    headers: requestHeaders(),
  });
  return Array.isArray(rows) ? rows.map(mapSubjectRow).filter(Boolean) : [];
}

export async function createSubjectRecord(userId, subject) {
  const rows = await supabaseRequest(`/subjects?select=${SUBJECT_SELECT}`, {
    method: "POST",
    headers: { ...requestHeaders(), Prefer: "return=representation" },
    body: JSON.stringify(mapSubjectCreate(userId, subject)),
  });
  return mapSubjectRow(rows?.[0]);
}

export async function updateSubjectRecord(userId, subjectId, patch, options = {}) {
  if (!options.semesterId) throw new Error("semesterId ist zum Ändern von Fächern erforderlich");
  const rows = await supabaseRequest(`/subjects?id=eq.${subjectId}&user_id=eq.${userId}&semester_id=eq.${options.semesterId}&select=${SUBJECT_SELECT}`, {
    method: "PATCH",
    headers: { ...requestHeaders(), Prefer: "return=representation" },
    body: JSON.stringify(mapSubjectPatch(patch)),
  });
  return mapSubjectRow(rows?.[0]);
}

async function setSubjectArchived(userId, subjectId, isArchived, options = {}) {
  if (!options.semesterId) throw new Error("semesterId ist zum Archivieren von Fächern erforderlich");
  const rows = await supabaseRequest(`/subjects?id=eq.${subjectId}&user_id=eq.${userId}&semester_id=eq.${options.semesterId}&select=${SUBJECT_SELECT}`, {
    method: "PATCH",
    headers: { ...requestHeaders(), Prefer: "return=representation" },
    body: JSON.stringify({ is_archived: isArchived }),
  });
  return mapSubjectRow(rows?.[0]);
}

export function archiveSubjectRecord(userId, subjectId, options = {}) {
  return setSubjectArchived(userId, subjectId, true, options);
}

export function unarchiveSubjectRecord(userId, subjectId, options = {}) {
  return setSubjectArchived(userId, subjectId, false, options);
}

export async function deleteSubjectRecord(userId, subjectId, options = {}) {
  if (!options.semesterId) throw new Error("semesterId ist zum Löschen von Fächern erforderlich");
  await supabaseRequest(`/subjects?id=eq.${subjectId}&user_id=eq.${userId}&semester_id=eq.${options.semesterId}`, {
    method: "DELETE",
    headers: requestHeaders(),
  });
}
