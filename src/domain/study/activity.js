function normalizeLookupKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_\s-]+/g, " ");
}

export const ACTIVITY_TYPES = [
  "cheatsheet_created",
  "theory_read",
  "exercises_practiced",
  "review_done",
  "exam_exercise_practiced",
];

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
    wiederholung: "review_done",
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
