import { getSupabaseAnonKey } from "./client";
import { supabaseRequest } from "./restRepository";

export const EXAM_SELECT = "id,user_id,subject_id,title,exam_date,exam_time,location,notes,status,is_archived,created_at,updated_at";

const requestHeaders = () => ({ apikey: getSupabaseAnonKey() });

export function mapExamRow(row) {
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

export function mapExamCreate(userId, exam) {
  return {
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
  };
}

export function mapExamPatch(patch) {
  const row = {};
  if ("subjectId" in patch) row.subject_id = patch.subjectId || null;
  if ("title" in patch) row.title = patch.title;
  if ("examDate" in patch) row.exam_date = patch.examDate || null;
  if ("examTime" in patch) row.exam_time = patch.examTime || null;
  if ("location" in patch) row.location = patch.location || null;
  if ("notes" in patch) row.notes = patch.notes || null;
  if ("status" in patch) row.status = patch.status === "written" ? "written" : "open";
  if ("isArchived" in patch) row.is_archived = Boolean(patch.isArchived);
  return row;
}

export async function loadExams(userId) {
  const rows = await supabaseRequest(`/exams?user_id=eq.${userId}&select=${EXAM_SELECT}&order=exam_date.asc,exam_time.asc.nullslast,created_at.asc`, {
    method: "GET",
    headers: requestHeaders(),
  });
  return Array.isArray(rows) ? rows.map(mapExamRow).filter(Boolean) : [];
}

export async function createExamRecord(userId, exam) {
  const rows = await supabaseRequest(`/exams?select=${EXAM_SELECT}`, {
    method: "POST",
    headers: { ...requestHeaders(), Prefer: "return=representation" },
    body: JSON.stringify(mapExamCreate(userId, exam)),
  });
  return mapExamRow(rows?.[0]);
}

export async function updateExamRecord(userId, examId, patch) {
  const rows = await supabaseRequest(`/exams?id=eq.${examId}&user_id=eq.${userId}&select=${EXAM_SELECT}`, {
    method: "PATCH",
    headers: { ...requestHeaders(), Prefer: "return=representation" },
    body: JSON.stringify(mapExamPatch(patch)),
  });
  return mapExamRow(rows?.[0]);
}

export async function deleteExamRecord(userId, examId) {
  await supabaseRequest(`/exams?id=eq.${examId}&user_id=eq.${userId}`, {
    method: "DELETE",
    headers: requestHeaders(),
  });
}
