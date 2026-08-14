import { getSupabaseAnonKey } from "./client";
import { supabaseRequest } from "./restRepository";

export const SEMESTER_SELECT = "id,name,start_date,end_date,user_id,created_at";

const requestHeaders = () => ({ apikey: getSupabaseAnonKey() });

export function mapSemesterRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    start_date: row.start_date,
    end_date: row.end_date,
    user_id: row.user_id,
    created_at: row.created_at,
  };
}

export function mapSemesterWrite(semester) {
  return {
    name: semester.name,
    start_date: semester.startDate || null,
    end_date: semester.endDate || null,
  };
}

export async function loadSemesters(userId) {
  const rows = await supabaseRequest(
    `/semesters?user_id=eq.${userId}&select=${SEMESTER_SELECT}&order=created_at.asc`,
    { method: "GET", headers: requestHeaders() },
  );
  return Array.isArray(rows) ? rows.map(mapSemesterRow).filter(Boolean) : [];
}

export async function createSemester(userId, semester) {
  const rows = await supabaseRequest(`/semesters?select=${SEMESTER_SELECT}`, {
    method: "POST",
    headers: { ...requestHeaders(), Prefer: "return=representation" },
    body: JSON.stringify({ user_id: userId, ...mapSemesterWrite(semester) }),
  });
  return mapSemesterRow(rows?.[0]);
}

export async function updateSemester(userId, semesterId, patch) {
  const rows = await supabaseRequest(
    `/semesters?id=eq.${semesterId}&user_id=eq.${userId}&select=${SEMESTER_SELECT}`,
    {
      method: "PATCH",
      headers: { ...requestHeaders(), Prefer: "return=representation" },
      body: JSON.stringify(mapSemesterWrite(patch)),
    },
  );
  return mapSemesterRow(rows?.[0]);
}

export async function deleteSemester(userId, semesterId) {
  await supabaseRequest(`/semesters?id=eq.${semesterId}&user_id=eq.${userId}`, {
    method: "DELETE",
    headers: requestHeaders(),
  });
}
