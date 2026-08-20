/**
 * Cloud Storage Module for Supabase Authentication and Data Sync
 * Handles user registration, login, logout, and planner data persistence
 */

import {
  getActiveSession as getActiveSessionFromRepository,
  requestPasswordReset as requestPasswordResetFromRepository,
  resendSignupConfirmation as resendSignupConfirmationFromRepository,
  signInWithEmail as signInWithEmailFromRepository,
  signOutCurrentSession as signOutCurrentSessionFromRepository,
  signUpWithEmail as signUpWithEmailFromRepository,
} from "@/infrastructure/supabase/authRepository";
import {
  CONFIDENCE_LEVELS,
  normalizeConfidence,
  normalizeTopicStatus,
  TOPIC_STATUSES,
} from "@/domain/academics/topic";
import {
  ACTIVITY_TYPES,
  normalizeActivityType,
} from "@/domain/study/activity";
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
export {
  cancelTimerSession,
  finishTimerSession,
  loadActiveTimerSession,
  pauseTimerSession,
  resumeTimerSession,
  startTimerSession,
} from "@/infrastructure/supabase/timerSessionRepository";
export {
  createStudyTimeEntry,
  deleteStudyTimeEntry,
  getTotalTimeForSubject,
  getTotalTimeForTopic,
  loadStudyTimeEntries,
  updateStudyTimeEntry,
} from "@/infrastructure/supabase/studyTimeRepository";
export { ACTIVITY_TYPES, normalizeActivityType };

export const REVIEW_INTERVAL_DAYS = [1, 3, 7];
export const SUBJECT_REVIEW_INTERVAL_DAYS = [1, 2, 4, 7];
export const MAX_REVIEW_GAP_DURING_SEMESTER = 7;
export const MAX_TOPIC_REVIEW_GAP_DAYS = 21;

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
  return updateSubjectRecord(userId, subject.id, patch, { semesterId: subject.semesterId });
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
    }, { semesterId: topic.semesterId || subject.semesterId }),
    updateSubjectRecord(userId, subject.id, {
      ...subject,
      nextNewTopicDueAt,
    }, { semesterId: subject.semesterId }),
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
  }, { semesterId: topic.semesterId });

  return updatedTopic;
}
