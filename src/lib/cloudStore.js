/**
 * Cloud Storage Module for Supabase Authentication and Data Sync
 * Handles user registration, login, logout, and planner data persistence
 */

import { getSupabaseAnonKey } from "@/infrastructure/supabase/client";
import {
  getActiveSession as getActiveSessionFromRepository,
  requestPasswordReset as requestPasswordResetFromRepository,
  resendSignupConfirmation as resendSignupConfirmationFromRepository,
  signInWithEmail as signInWithEmailFromRepository,
  signOutCurrentSession as signOutCurrentSessionFromRepository,
  signUpWithEmail as signUpWithEmailFromRepository,
} from "@/infrastructure/supabase/authRepository";
import {
  supabaseRequest,
} from "@/infrastructure/supabase/restRepository";
import {
  CONFIDENCE_LEVELS,
  normalizeConfidence,
  normalizeTopicStatus,
  TOPIC_STATUSES,
} from "@/domain/academics/topic";
import { updateSubjectRecord } from "@/infrastructure/supabase/subjectRepository";
import { updateTopicRecord } from "@/infrastructure/supabase/topicRepository";

export {
  loadUserPlannerData,
  PLANNER_SNAPSHOT_ERROR_CODES,
  PlannerSnapshotError,
  saveUserPlannerData,
} from "@/infrastructure/supabase/plannerSnapshotRepository";
export { normalizeDefaultData } from "@/app/state/plannerSnapshot";
export {
  CONFIDENCE_LEVELS,
  normalizeConfidence,
  normalizeTopicStatus,
  TOPIC_STATUSES,
} from "@/domain/academics/topic";
export {
  createSemester,
  deleteSemester,
  loadSemesters,
  updateSemester,
} from "@/infrastructure/supabase/semesterRepository";
export {
  archiveSubjectRecord,
  createSubjectRecord,
  deleteSubjectRecord,
  loadSubjects,
  unarchiveSubjectRecord,
  updateSubjectRecord,
} from "@/infrastructure/supabase/subjectRepository";
export {
  createTopicRecord,
  deleteTopicRecord,
  loadTopics,
  updateTopicRecord,
} from "@/infrastructure/supabase/topicRepository";
export {
  createExamRecord,
  deleteExamRecord,
  loadExams,
  updateExamRecord,
} from "@/infrastructure/supabase/examRepository";

const SUPABASE_ANON_KEY = getSupabaseAnonKey();

export const REVIEW_INTERVAL_DAYS = [1, 3, 7];
export const SUBJECT_REVIEW_INTERVAL_DAYS = [1, 2, 4, 7];
export const MAX_REVIEW_GAP_DURING_SEMESTER = 7;
export const MAX_TOPIC_REVIEW_GAP_DAYS = 21;

export const ACTIVITY_TYPES = [
  "cheatsheet_created",
  "theory_read",
  "exercises_practiced",
  "review_done",
  "exam_exercise_practiced",
];

export const ACTIVITY_TYPE_LABELS = {
  cheatsheet_created: "Cheatsheet erstellt",
  theory_read: "Theorie gelesen",
  exercises_practiced: "Aufgaben geübt",
  review_done: "Wiederholung gemacht",
  exam_exercise_practiced: "Klausuraufgabe geübt",
};

export const CONFIDENCE_LABELS = {
  not_understood: "nicht verstanden",
  unsure: "unsicher",
  okay: "okay",
  confident: "sicher",
  very_confident: "sehr sicher",
};

export const TOPIC_STATUS_LABELS = {
  new: "neu",
  active: "aktiv",
  secure: "sicher",
  paused: "pausiert",
  archived: "archiviert",
};

export const CONFIDENCE_REVIEW_INTERVAL_DAYS = {
  not_understood: 1,
  unsure: 2,
  okay: 4,
  confident: 7,
  very_confident: 14,
};

const REVIEW_UPDATING_ACTIVITY_TYPES = new Set([
  "exercises_practiced",
  "review_done",
  "exam_exercise_practiced",
]);

function normalizeLookupKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_\s-]+/g, " ");
}

export function normalizeActivityType(value, fallback = "theory_read") {
  const key = normalizeLookupKey(value);
  const mapping = {
    cheatsheet_created: "cheatsheet_created",
    "cheatsheet created": "cheatsheet_created",
    "cheatsheet erstellt": "cheatsheet_created",
    theory_read: "theory_read",
    "theory read": "theory_read",
    "theorie gelesen": "theory_read",
    exercises_practiced: "exercises_practiced",
    "exercises practiced": "exercises_practiced",
    "aufgaben geübt": "exercises_practiced",
    "aufgaben geuebt": "exercises_practiced",
    "wiederholung": "review_done",
    review_done: "review_done",
    "review done": "review_done",
    "wiederholung gemacht": "review_done",
    exam_exercise_practiced: "exam_exercise_practiced",
    "exam exercise practiced": "exam_exercise_practiced",
    "klausuraufgabe geübt": "exam_exercise_practiced",
    "klausuraufgabe geuebt": "exam_exercise_practiced",
  };
  return mapping[key] || (ACTIVITY_TYPES.includes(fallback) ? fallback : "theory_read");
}

export function getActivityTypeLabel(value) {
  return ACTIVITY_TYPE_LABELS[normalizeActivityType(value)] || ACTIVITY_TYPE_LABELS.theory_read;
}

export function getConfidenceLabel(value) {
  return CONFIDENCE_LABELS[normalizeConfidence(value)] || CONFIDENCE_LABELS.unsure;
}

export function getTopicStatusLabel(value) {
  return TOPIC_STATUS_LABELS[normalizeTopicStatus(value)] || TOPIC_STATUS_LABELS.new;
}

export function isValidDateValue(value) {
  if (value === null || value === undefined || value === "" || value === 0) return false;
  if (typeof value === "string" && !value.trim()) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

export function formatLearningDate(value, fallbackText = "noch nicht geplant", options = {}) {
  if (!isValidDateValue(value)) return fallbackText;
  const date = new Date(value);
  const formatterOptions = options.includeTime
    ? { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }
    : { day: "2-digit", month: "2-digit", year: "2-digit" };
  return date.toLocaleString("de-DE", {
    ...formatterOptions,
    hour12: false,
  });
}

function toIsoDateTimeOrNull(value) {
  if (!isValidDateValue(value)) return null;
  const date = new Date(value);
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

export function calculateNextSubjectReviewAt(reviewStep = 0, now = new Date(), maxGapDuringSemester = MAX_REVIEW_GAP_DURING_SEMESTER) {
  const normalizedStep = Math.max(0, Number(reviewStep || 0));
  const interval = SUBJECT_REVIEW_INTERVAL_DAYS[Math.min(normalizedStep, SUBJECT_REVIEW_INTERVAL_DAYS.length - 1)] || SUBJECT_REVIEW_INTERVAL_DAYS[SUBJECT_REVIEW_INTERVAL_DAYS.length - 1];
  const boundedInterval = Math.min(interval, Math.max(1, Number(maxGapDuringSemester || MAX_REVIEW_GAP_DURING_SEMESTER)));
  return addDays(now, boundedInterval).toISOString();
}

export function shouldUpdateTopicReview(activityType, options = {}) {
  const normalizedActivityType = normalizeActivityType(activityType);
  if (REVIEW_UPDATING_ACTIVITY_TYPES.has(normalizedActivityType)) return true;
  return normalizedActivityType === "cheatsheet_created" && Boolean(options.alsoPracticed);
}

export function calculateNextTopicReviewAt(confidence, studiedAt = new Date(), options = {}) {
  const studiedAtDate = isValidDateValue(studiedAt) ? new Date(studiedAt) : new Date();
  const normalizedConfidence = normalizeConfidence(confidence);
  const intervalDays = CONFIDENCE_REVIEW_INTERVAL_DAYS[normalizedConfidence] || CONFIDENCE_REVIEW_INTERVAL_DAYS.unsure;
  const boundedIntervalDays = Math.min(intervalDays, Math.max(1, Number(options.maxReviewGapDays || MAX_TOPIC_REVIEW_GAP_DAYS)));
  const candidate = addDays(studiedAtDate, boundedIntervalDays);

  const deadlineDates = Array.isArray(options.deadlineDates) ? options.deadlineDates : [];
  const earliestDeadline = deadlineDates
    .filter(isValidDateValue)
    .map((value) => startOfLocalDay(value))
    .filter((date) => date.getTime() >= startOfLocalDay(studiedAtDate).getTime())
    .sort((a, b) => a.getTime() - b.getTime())[0] || null;

  if (!earliestDeadline) return candidate.toISOString();

  const latestReviewDay = startOfLocalDay(earliestDeadline);
  latestReviewDay.setDate(latestReviewDay.getDate() - 1);

  if (latestReviewDay.getTime() < startOfLocalDay(studiedAtDate).getTime()) {
    return studiedAtDate.toISOString();
  }

  return candidate.getTime() > latestReviewDay.getTime()
    ? latestReviewDay.toISOString()
    : candidate.toISOString();
}

export function buildTopicReviewProgress(topic, options = {}) {
  if (!topic) return null;

  const activityType = normalizeActivityType(options.activityType || options.activity_type);
  const confidence = normalizeConfidence(options.confidence);
  const reviewUpdated = shouldUpdateTopicReview(activityType, {
    alsoPracticed: Boolean(options.alsoPracticed || options.also_practiced),
  });

  if (!reviewUpdated) {
    return {
      reviewUpdated: false,
      activityType,
      confidence,
      topicPatch: {},
    };
  }

  const studiedAtDate = isValidDateValue(options.studiedAt) ? new Date(options.studiedAt) : new Date();
  const currentReviewCount = Math.max(0, Number(topic.reviewCount ?? topic.review_count ?? 0));
  const currentReviewStep = Math.max(0, Number(topic.reviewStep ?? topic.review_step ?? 0));
  const nextReviewAt = calculateNextTopicReviewAt(confidence, studiedAtDate, {
    deadlineDates: options.deadlineDates,
    maxReviewGapDays: options.maxReviewGapDays || MAX_TOPIC_REVIEW_GAP_DAYS,
  });
  const nextStatus = confidence === "confident" || confidence === "very_confident" ? "secure" : "active";

  return {
    reviewUpdated: true,
    activityType,
    confidence,
    topicPatch: {
      status: nextStatus,
      confidence,
      reviewCount: currentReviewCount + 1,
      reviewStep: currentReviewStep + 1,
      lastStudiedAt: studiedAtDate.toISOString(),
      nextReviewAt,
      isPausedToday: false,
      completed: false,
    },
  };
}

function startOfLocalDay(value) {
  const date = new Date(value || Date.now());
  date.setHours(0, 0, 0, 0);
  return date;
}

function isSameLocalDay(a, b) {
  const first = new Date(a);
  const second = new Date(b);
  if (Number.isNaN(first.getTime()) || Number.isNaN(second.getTime())) return false;
  return startOfLocalDay(first).getTime() === startOfLocalDay(second).getTime();
}

export function buildSubjectStudyProgress(subject, options = {}) {
  if (!subject) return null;

  const studiedAtDate = new Date(options.studiedAt || Date.now());
  if (Number.isNaN(studiedAtDate.getTime())) return null;

  const currentStep = Math.max(0, Number(subject.reviewStep || 0));
  const lastStudiedAt = subject.lastStudiedAt || null;
  const studyCount = Math.max(0, Number(subject.studyCount || 0));
  const alreadyStudiedToday = lastStudiedAt ? isSameLocalDay(lastStudiedAt, studiedAtDate) : false;
  const hasPriorStudy = Boolean(lastStudiedAt) || studyCount > 0;
  const nextStep = hasPriorStudy && !alreadyStudiedToday ? currentStep + 1 : currentStep;
  const durationMinutes = Math.max(1, Math.round(Number(options.durationMinutes || 0)));

  return {
    lastStudiedAt: studiedAtDate.toISOString(),
    nextReviewAt: calculateNextSubjectReviewAt(nextStep, studiedAtDate, options.maxReviewGapDuringSemester || MAX_REVIEW_GAP_DURING_SEMESTER),
    reviewStep: nextStep,
    lastStudiedMinutes: durationMinutes,
    studyCount: studyCount + 1,
  };
}

/**
 * Sign up a new user with email and password
 */
export async function signUpWithEmail(email, password) {
  return signUpWithEmailFromRepository(email, password);
}

/**
 * Sign in with email and password
 */
export async function signInWithEmail(email, password) {
  return signInWithEmailFromRepository(email, password);
}

/**
 * Send password reset email
 */
export async function requestPasswordReset(email) {
  return requestPasswordResetFromRepository(email);
}

/**
 * Resend signup confirmation email
 */
export async function resendSignupConfirmation(email) {
  return resendSignupConfirmationFromRepository(email);
}

/**
 * Get active session from localStorage
 */
export async function getActiveSession() {
  return getActiveSessionFromRepository();
}

/**
 * Sign out current session
 */
export async function signOutCurrentSession() {
  return signOutCurrentSessionFromRepository();
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

export async function updateSubjectStudyProgress(userId, subject, options = {}) {
  const patch = buildSubjectStudyProgress(subject, options);
  if (!patch) return null;
  return updateSubjectRecord(userId, subject.id, patch);
}

export async function markTopicAsLearnedNew(userId, topic, subject, options = {}) {
  const now = new Date();
  const nextReviewAt = calculateNextReviewAt(0, now, options.maxReviewGapDuringSemester || MAX_REVIEW_GAP_DURING_SEMESTER);
  const newTopicEveryDays = Math.max(1, Number(subject?.newTopicEveryDays || 3));
  const nextNewTopicDueAt = addDays(now, newTopicEveryDays).toISOString();

  const [updatedTopic] = await Promise.all([
    updateTopicRecord(userId, topic.id, {
      status: "active",
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
    status: "active",
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

/**
 * Study Time Entries CRUD
 * Flexible time tracking linked to subjects and optional topics
 */
const STUDY_TIME_ENTRY_SELECT = "id,user_id,subject_id,topic_id,task_id,duration_minutes,source,notes,activity_type,confidence,review_updated,recorded_at,created_at,updated_at";

function mapStudyTimeEntry(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
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

export async function loadStudyTimeEntries(userId, options = {}) {
  let query = `/study_time_entries?user_id=eq.${userId}&select=${STUDY_TIME_ENTRY_SELECT}`;

  if (options.subjectId) {
    query += `&subject_id=eq.${options.subjectId}`;
  }
  if (options.topicId) {
    query += `&topic_id=eq.${options.topicId}`;
  }
  if (options.taskId) {
    query += `&task_id=eq.${encodeURIComponent(options.taskId)}`;
  }

  query += "&order=recorded_at.desc";

  if (options.limit) {
    query += `&limit=${Math.max(1, Number(options.limit))}`;
  }

  const rows = await supabaseRequest(query, {
    method: "GET",
    headers: { apikey: SUPABASE_ANON_KEY },
  });

  return Array.isArray(rows) ? rows.map(mapStudyTimeEntry) : [];
}

export async function createStudyTimeEntry(userId, entry) {
  if (!entry.subjectId) {
    throw new Error("subjectId ist erforderlich");
  }
  if (!entry.durationMinutes || entry.durationMinutes <= 0) {
    throw new Error("durationMinutes muss größer als 0 sein");
  }

  const rows = await supabaseRequest(
    `/study_time_entries?select=${STUDY_TIME_ENTRY_SELECT}`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        id: entry.id || crypto.randomUUID(),
        user_id: userId,
        subject_id: entry.subjectId,
        topic_id: entry.topicId || null,
        task_id: entry.taskId || null,
        duration_minutes: Math.max(1, Math.round(Number(entry.durationMinutes))),
        source: entry.source || "manual",
        notes: entry.notes || "",
        activity_type: normalizeActivityType(entry.activityType || entry.activity_type),
        confidence: entry.confidence ? normalizeConfidence(entry.confidence) : null,
        review_updated: Boolean(entry.reviewUpdated || entry.review_updated),
        recorded_at: entry.recordedAt || new Date().toISOString(),
      }),
    }
  );

  return mapStudyTimeEntry(rows?.[0] || null);
}

export async function updateStudyTimeEntry(userId, entryId, patch) {
  const payload = {};

  if ("durationMinutes" in patch) {
    payload.duration_minutes = Math.max(1, Math.round(Number(patch.durationMinutes)));
  }
  if ("notes" in patch) {
    payload.notes = patch.notes || "";
  }
  if ("taskId" in patch) {
    payload.task_id = patch.taskId || null;
  }
  if ("topicId" in patch) {
    payload.topic_id = patch.topicId || null;
  }
  if ("source" in patch) {
    payload.source = patch.source || "manual";
  }
  if ("activityType" in patch) {
    payload.activity_type = normalizeActivityType(patch.activityType);
  }
  if ("confidence" in patch) {
    payload.confidence = patch.confidence ? normalizeConfidence(patch.confidence) : null;
  }
  if ("reviewUpdated" in patch) {
    payload.review_updated = Boolean(patch.reviewUpdated);
  }
  if ("recordedAt" in patch) {
    payload.recorded_at = toIsoDateTimeOrNull(patch.recordedAt);
  }

  const rows = await supabaseRequest(
    `/study_time_entries?id=eq.${entryId}&user_id=eq.${userId}&select=${STUDY_TIME_ENTRY_SELECT}`,
    {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Prefer: "return=representation",
      },
      body: JSON.stringify(payload),
    }
  );

  return mapStudyTimeEntry(rows?.[0] || null);
}

export async function deleteStudyTimeEntry(userId, entryId) {
  await supabaseRequest(
    `/study_time_entries?id=eq.${entryId}&user_id=eq.${userId}`,
    {
      method: "DELETE",
      headers: { apikey: SUPABASE_ANON_KEY },
    }
  );
}

export async function getTotalTimeForTopic(userId, topicId) {
  const rows = await supabaseRequest(
    `/study_time_entries?user_id=eq.${userId}&topic_id=eq.${topicId}&select=duration_minutes`,
    {
      method: "GET",
      headers: { apikey: SUPABASE_ANON_KEY },
    }
  );

  if (!Array.isArray(rows)) return 0;
  return rows.reduce((sum, row) => sum + Number(row.duration_minutes || 0), 0);
}

export async function getTotalTimeForSubject(userId, subjectId) {
  const rows = await supabaseRequest(
    `/study_time_entries?user_id=eq.${userId}&subject_id=eq.${subjectId}&select=duration_minutes`,
    {
      method: "GET",
      headers: { apikey: SUPABASE_ANON_KEY },
    }
  );

  if (!Array.isArray(rows)) return 0;
  return rows.reduce((sum, row) => sum + Number(row.duration_minutes || 0), 0);
}
