function normalizeLookupKey(value) {
  return String(value || "").trim().toLowerCase().replace(/[_\s-]+/g, " ");
}

export const TOPIC_STATUSES = ["new", "active", "secure", "paused", "archived"];
export const CONFIDENCE_LEVELS = ["not_understood", "unsure", "okay", "confident", "very_confident"];

export function normalizeConfidence(value, fallback = "unsure") {
  const mapping = {
    not_understood: "not_understood",
    "not understood": "not_understood",
    "nicht verstanden": "not_understood",
    unsure: "unsure",
    unsicher: "unsure",
    okay: "okay",
    ok: "okay",
    confident: "confident",
    sicher: "confident",
    very_confident: "very_confident",
    "very confident": "very_confident",
    "sehr sicher": "very_confident",
  };
  return mapping[normalizeLookupKey(value)] || (CONFIDENCE_LEVELS.includes(fallback) ? fallback : "unsure");
}

export function normalizeTopicStatus(value, fallback = "new") {
  const mapping = {
    new: "new",
    neu: "new",
    learning: "active",
    lernen: "active",
    active: "active",
    aktiv: "active",
    review: "active",
    wiederholung: "active",
    secure: "secure",
    sicher: "secure",
    paused: "paused",
    pausiert: "paused",
    postponed: "paused",
    archived: "archived",
    archiviert: "archived",
    completed: "archived",
    erledigt: "archived",
  };
  return mapping[normalizeLookupKey(value)] || (TOPIC_STATUSES.includes(fallback) ? fallback : "new");
}
