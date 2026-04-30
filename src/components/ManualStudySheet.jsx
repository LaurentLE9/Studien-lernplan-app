import React, { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  PencilLine,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  ACTIVITY_TYPES,
  ACTIVITY_TYPE_LABELS,
  CONFIDENCE_LEVELS,
  CONFIDENCE_LABELS,
  normalizeActivityType,
  normalizeConfidence,
  normalizeTopicStatus,
  shouldUpdateTopicReview,
} from "@/lib/cloudStore";

function formatDateInput(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function toTimeInputValue(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "00:00";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function normalizeTimeDraft(value) {
  const cleaned = String(value || "").replace(/[^\d:]/g, "");
  if (cleaned.includes(":")) {
    const [hours = "", minutes = ""] = cleaned.split(":");
    const nextHours = hours.slice(0, 2);
    const nextMinutes = minutes.slice(0, 2);
    return nextMinutes.length ? `${nextHours}:${nextMinutes}` : nextHours;
  }

  const digits = cleaned.slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function finalizeTime24(value, fallback = "00:00") {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 4);
  if (!digits.length) return fallback;

  let hours = 0;
  let minutes = 0;

  if (digits.length === 1) {
    hours = Number(digits);
  } else if (digits.length === 2) {
    hours = Number(digits);
  } else if (digits.length === 3) {
    hours = Number(digits.slice(0, 1));
    minutes = Number(digits.slice(1));
  } else {
    hours = Number(digits.slice(0, 2));
    minutes = Number(digits.slice(2));
  }

  hours = Math.max(0, Math.min(23, hours || 0));
  minutes = Math.max(0, Math.min(59, minutes || 0));

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function formatMinutes(minutes) {
  const totalMinutes = Math.max(0, Math.round(Number(minutes) || 0));
  if (!totalMinutes) return "0 Min.";
  const hours = Math.floor(totalMinutes / 60);
  const restMinutes = totalMinutes % 60;
  if (hours && restMinutes) return `${hours} h ${restMinutes} Min.`;
  if (hours) return `${hours} h`;
  return `${restMinutes} Min.`;
}

function TimeInput24({ value, onChange, className }) {
  return (
    <Input
      type="text"
      inputMode="numeric"
      placeholder="HH:MM"
      value={value}
      onChange={(event) => onChange(normalizeTimeDraft(event.target.value))}
      onBlur={(event) => onChange(finalizeTime24(event.target.value, value || "00:00"))}
      className={className}
    />
  );
}

export default function ManualStudySheet({
  open,
  onOpenChange,
  subjects,
  topics,
  tasks = [],
  darkMode,
  selectedSubjectId,
  onSelectedSubjectChange,
  selectedTaskId,
  onSelectedTaskChange,
  selectedTopicId,
  onSelectedTopicChange,
  onCreateTopic,
  onSaveEntry,
  initialValue,
  liveBreakMinutes,
  title = "Lerneinheit",
  submitLabel = "Speichern",
}) {
  const [entryDate, setEntryDate] = useState(formatDateInput(new Date()));
  const [startTime, setStartTime] = useState(new Date().toTimeString().slice(0, 5));
  const [endTime, setEndTime] = useState(new Date().toTimeString().slice(0, 5));
  const [breakMinutes, setBreakMinutes] = useState("0");
  const [breakMinutesTouched, setBreakMinutesTouched] = useState(false);
  const [activityType, setActivityType] = useState("exercises_practiced");
  const [confidence, setConfidence] = useState("unsure");
  const [alsoPracticed, setAlsoPracticed] = useState(false);
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [newTopicTitle, setNewTopicTitle] = useState("");
  const [newTopicCheatsheet, setNewTopicCheatsheet] = useState("");
  const [newTopicUrl, setNewTopicUrl] = useState("");
  const [isCreatingTopic, setIsCreatingTopic] = useState(false);

  const [panelWidth, setPanelWidth] = useState(() => {
    const saved = localStorage.getItem("manualStudySheetWidth");
    return saved ? parseInt(saved, 10) : 600;
  });

  const panelWidthRef = React.useRef(panelWidth);
  useEffect(() => {
    panelWidthRef.current = panelWidth;
  }, [panelWidth]);

  const handleDrag = React.useCallback((e) => {
    const newWidth = document.documentElement.clientWidth - e.clientX;
    if (newWidth >= 400 && newWidth <= 900) {
      setPanelWidth(newWidth);
    }
  }, []);

  const stopDrag = React.useCallback(() => {
    document.removeEventListener("mousemove", handleDrag);
    document.removeEventListener("mouseup", stopDrag);
    localStorage.setItem("manualStudySheetWidth", panelWidthRef.current);
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
  }, [handleDrag]);

  const startDrag = React.useCallback((e) => {
    e.preventDefault();
    document.addEventListener("mousemove", handleDrag);
    document.addEventListener("mouseup", stopDrag);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "ew-resize";
  }, [handleDrag, stopDrag]);

  useEffect(() => {
    if (!open) return;
    const seed = initialValue || {};
    const now = new Date();
    setEntryDate(seed.date || formatDateInput(now));
    setStartTime(seed.startTime || toTimeInputValue(now));
    setEndTime(seed.endTime || toTimeInputValue(now));
    setBreakMinutes(seed.breakMinutes ?? "0");
    setBreakMinutesTouched(false);
    setActivityType(normalizeActivityType(seed.activityType || seed.activity || "exercises_practiced", "exercises_practiced"));
    setConfidence(normalizeConfidence(seed.confidence || "unsure"));
    setAlsoPracticed(Boolean(seed.alsoPracticed));
    setNote(seed.note || "");
    setNewTopicTitle("");
    setNewTopicCheatsheet("");
    setNewTopicUrl("");
  }, [open, initialValue]);

  useEffect(() => {
    if (!open || breakMinutesTouched) return;
    if (liveBreakMinutes === undefined || liveBreakMinutes === null) return;
    setBreakMinutes(String(liveBreakMinutes));
  }, [open, breakMinutesTouched, liveBreakMinutes]);

  const openTasksForSubject = useMemo(
    () => (tasks || []).filter(
      (task) => task.subjectId === selectedSubjectId && task.status !== "erledigt" && !task.isCompleted && !task.archived
    ),
    [tasks, selectedSubjectId]
  );

  const openTopicsForSubject = useMemo(
    () => (topics || []).filter((topic) => {
      if (topic.subjectId !== selectedSubjectId) return false;
      const status = normalizeTopicStatus(topic.status);
      return status !== "archived" && !topic.completed && !topic.archivedAt;
    }),
    [topics, selectedSubjectId]
  );

  useEffect(() => {
    if (!selectedTaskId) return;
    if (openTasksForSubject.some((task) => task.id === selectedTaskId)) return;
    onSelectedTaskChange?.("");
  }, [openTasksForSubject, onSelectedTaskChange, selectedTaskId]);

  useEffect(() => {
    if (!selectedTopicId) return;
    if (openTopicsForSubject.some((topic) => topic.id === selectedTopicId)) return;
    onSelectedTopicChange?.("");
  }, [openTopicsForSubject, onSelectedTopicChange, selectedTopicId]);

  function shiftDate(days) {
    const date = new Date(entryDate);
    date.setDate(date.getDate() + days);
    setEntryDate(formatDateInput(date));
  }

  function getDurationMinutes() {
    const [startHours, startMinutes] = startTime.split(":").map(Number);
    const [endHours, endMinutes] = endTime.split(":").map(Number);
    let total = endHours * 60 + endMinutes - (startHours * 60 + startMinutes);
    if (total < 0) total += 24 * 60;
    total -= Number(breakMinutes || 0);
    return Math.max(0, total);
  }

  async function saveEntry() {
    const durationMinutes = getDurationMinutes();
    if (!selectedSubjectId || durationMinutes <= 0) return;

    try {
      setIsSaving(true);
      const normalizedActivityType = normalizeActivityType(activityType, "exercises_practiced");
      const normalizedConfidence = normalizeConfidence(confidence);
      const reviewUpdated = selectedTopicId
        ? shouldUpdateTopicReview(normalizedActivityType, { alsoPracticed })
        : false;
      await Promise.resolve(onSaveEntry({
        id: initialValue?.id || crypto.randomUUID(),
        subjectId: selectedSubjectId,
        taskId: selectedTaskId || undefined,
        topicId: selectedTopicId || undefined,
        durationMinutes,
        createdAt: new Date(`${entryDate}T${endTime}:00`).toISOString(),
        source: initialValue?.source === "manual-entry" ? "manual" : initialValue?.source || "manual",
        activityType: normalizedActivityType,
        confidence: normalizedConfidence,
        alsoPracticed,
        reviewUpdated,
        note: [ACTIVITY_TYPE_LABELS[normalizedActivityType], note].filter(Boolean).join(" - ") || "Lerneinheit manuell angelegt",
      }));
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  }

  async function createTopicFromSheet() {
    const title = newTopicTitle.trim();
    if (!title || !selectedSubjectId || !onCreateTopic) return;

    try {
      setIsCreatingTopic(true);
      const created = await Promise.resolve(onCreateTopic({
        subjectId: selectedSubjectId,
        title,
        cheatsheetText: newTopicCheatsheet,
        cheatsheetUrl: newTopicUrl,
        status: "new",
      }));
      if (created?.id) {
        onSelectedTopicChange?.(created.id);
        setNewTopicTitle("");
        setNewTopicCheatsheet("");
        setNewTopicUrl("");
      }
    } finally {
      setIsCreatingTopic(false);
    }
  }

  const durationMinutes = getDurationMinutes();
  const dateLabel = new Date(entryDate).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    weekday: "short",
  }).replace(",", " -");
  const accentSubject = subjects.find((subject) => subject.id === selectedSubjectId) || null;
  const sheetSurfaceClass = darkMode
    ? "border-slate-800 bg-[#0f172a] text-slate-50"
    : "border-slate-200 bg-white text-slate-900";
  const sectionSurfaceClass = darkMode
    ? "border-slate-800 bg-slate-950/60"
    : "border-slate-200 bg-slate-50/90";
  const fieldSurfaceClass = darkMode
    ? "border-slate-800/80 bg-slate-900/80"
    : "border-slate-200 bg-white";
  const mutedTextClass = darkMode ? "text-slate-400" : "text-slate-600";
  const inputClass = cn(
    "mt-3 border-0 bg-transparent px-0 font-semibold shadow-none focus-visible:ring-0",
    darkMode ? "text-slate-50 placeholder:text-slate-500" : "text-slate-900"
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        position="right"
        showClose={false}
        className={cn("border-l shadow-[var(--shadow-medium)] !max-w-none sm:!max-w-none transition-none", sheetSurfaceClass)}
        style={{ width: `${panelWidth}px` }}
      >
        <div
          className={cn(
            "absolute bottom-0 left-0 top-0 z-50 w-1 cursor-ew-resize bg-transparent transition-colors hover:bg-black/10 sm:w-2 dark:hover:bg-white/10",
            darkMode ? "bg-transparent" : "bg-transparent"
          )}
          onMouseDown={startDrag}
        />
        <div className="flex h-full min-h-0 flex-col pl-[2px]">
          <div className={cn("border-b px-4 pb-4 pt-5 sm:px-6", darkMode ? "border-slate-800 bg-slate-950/75" : "border-slate-200 bg-white")}>
            <div className="flex items-start justify-between gap-4">
              <DialogHeader className="min-w-0 space-y-2">
                <p className={cn("text-xs font-semibold uppercase tracking-[0.2em]", mutedTextClass)}>Lerneinheit</p>
                <DialogTitle className="text-xl font-semibold sm:text-2xl">{title}</DialogTitle>
                <DialogDescription>
                  Erfasse eine Lerneinheit mit Fach, optionaler Aufgabe, Lernthema und Aktivitaet.
                </DialogDescription>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={cn("rounded-full border px-3 py-1.5 text-xs", darkMode ? "border-slate-700 bg-slate-900/80 text-slate-200" : "border-slate-200 bg-slate-50 text-slate-700")}>
                    {initialValue?.id ? "Bearbeiten" : "Neu erfassen"}
                  </Badge>
                  <Badge variant="outline" className={cn("rounded-full border px-3 py-1.5 text-xs", darkMode ? "border-slate-700 bg-slate-900/80 text-slate-200" : "border-slate-200 bg-slate-50 text-slate-700")}>
                    {durationMinutes > 0 ? formatMinutes(durationMinutes) : "Dauer offen"}
                  </Badge>
                  {accentSubject ? (
                    <span className="inline-flex max-w-full items-center rounded-full px-3 py-1.5 text-xs font-semibold text-slate-950" style={{ backgroundColor: accentSubject.color }}>
                      <span className="truncate">{accentSubject.name}</span>
                    </span>
                  ) : null}
                </div>
              </DialogHeader>

              <Button type="button" variant="ghost" size="icon" className="rounded-[1rem]" onClick={() => onOpenChange(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-4 sm:px-6">
            <div className="grid gap-5 py-5">
              <div className={cn("rounded-[1.3rem] border p-4", sectionSurfaceClass)}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold">Zeitraum</p>
                    <p className={cn("mt-1 text-sm", mutedTextClass)}>Datum, Start, Ende und Pause bestimmen die Netto-Lernzeit.</p>
                  </div>
                  <Badge variant="outline" className={cn("rounded-full border px-3 py-1.5 text-xs", darkMode ? "border-slate-700 bg-slate-900/80 text-slate-200" : "border-slate-200 bg-white text-slate-700")}>
                    {durationMinutes > 0 ? formatMinutes(durationMinutes) : "0 Min."}
                  </Badge>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-[1.2fr_.8fr]">
                  <div className={cn("rounded-[1rem] border p-4", fieldSurfaceClass)}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="relative flex-1">
                      <div className={cn("flex items-center gap-2 text-sm font-semibold", mutedTextClass)}>
                        <CalendarDays className="h-4 w-4" />
                        Datum
                      </div>
                      <p className="mt-2 text-lg font-semibold">{dateLabel}</p>
                      <input
                        type="date"
                        value={entryDate}
                        onChange={(e) => setEntryDate(e.target.value)}
                        onClick={(e) => {
                          if (typeof e.currentTarget.showPicker === "function") {
                            try { e.currentTarget.showPicker(); } catch {}
                          }
                        }}
                        className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
                      />
                    </div>
                    <div className="flex gap-2 relative z-10">
                      <Button type="button" variant="outline" size="icon" className="rounded-full" onClick={() => shiftDate(-1)}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="outline" size="icon" className="rounded-full" onClick={() => shiftDate(1)}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                  <div className={cn("rounded-[1rem] border p-4", fieldSurfaceClass)}>
                  <div className={cn("flex items-center gap-2 text-sm font-semibold", mutedTextClass)}>
                    <Clock3 className="h-4 w-4" />
                    Netto-Lernzeit
                  </div>
                  <p className="mt-2 text-2xl font-semibold tracking-tight">{durationMinutes > 0 ? formatMinutes(durationMinutes) : "-"}</p>
                    <p className={cn("mt-1 text-sm", mutedTextClass)}>Berechnet aus Start, Ende und Pause.</p>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <div className={cn("rounded-[1rem] border p-4", fieldSurfaceClass)}>
                  <Label>Start</Label>
                    <TimeInput24 value={startTime} onChange={setStartTime} className={cn(inputClass, "text-2xl")} />
                </div>
                  <div className={cn("rounded-[1rem] border p-4", fieldSurfaceClass)}>
                  <Label>Ende</Label>
                    <TimeInput24 value={endTime} onChange={setEndTime} className={cn(inputClass, "text-2xl")} />
                </div>
                  <div className={cn("rounded-[1rem] border p-4", fieldSurfaceClass)}>
                  <Label>Pause (Min.)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={breakMinutes}
                    onChange={(event) => {
                      setBreakMinutesTouched(true);
                      setBreakMinutes(event.target.value);
                    }}
                      className={cn(inputClass, "text-2xl")}
                  />
                  </div>
                </div>
              </div>

              <div className={cn("rounded-[1.3rem] border p-4", sectionSurfaceClass)}>
                <div>
                  <p className={cn("text-xs font-semibold uppercase tracking-[0.18em]", mutedTextClass)}>Zuordnung</p>
                  <h4 className="mt-1 text-base font-semibold">Fach, Aufgabe und Lernthema</h4>
                  <p className={cn("mt-1 text-sm", mutedTextClass)}>Aufgaben bleiben To-dos; Lernthemen sind wiederholbare Wissenseinheiten.</p>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className={cn("rounded-[1rem] border p-4", fieldSurfaceClass)}>
                    <Label>Fach</Label>
                    <div className="mt-3 flex items-center gap-2">
                      <Select value={selectedSubjectId || undefined} onValueChange={onSelectedSubjectChange}>
                        <SelectTrigger className="border-0 bg-transparent px-0 text-base font-semibold shadow-none focus:ring-0 focus:ring-offset-0">
                          <SelectValue placeholder="Fach waehlen" />
                        </SelectTrigger>
                        <SelectContent>
                          {subjects.map((subject) => (
                            <SelectItem key={subject.id} value={subject.id}>
                              {subject.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedSubjectId ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-full"
                          onClick={() => {
                            onSelectedSubjectChange("");
                            onSelectedTaskChange?.("");
                            onSelectedTopicChange?.("");
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  <div className={cn("rounded-[1rem] border p-4", fieldSurfaceClass)}>
                    <Label>Aufgabe (optional)</Label>
                    <div className="mt-3 flex items-center gap-2">
                      {selectedSubjectId && openTasksForSubject.length > 0 ? (
                        <>
                          <Select value={selectedTaskId || ""} onValueChange={(value) => onSelectedTaskChange?.(value || "")}>
                            <SelectTrigger className="border-0 bg-transparent px-0 text-base font-semibold shadow-none focus:ring-0 focus:ring-offset-0">
                              <SelectValue placeholder="Aufgabe auswaehlen" />
                            </SelectTrigger>
                            <SelectContent>
                              {openTasksForSubject.map((task) => (
                                <SelectItem key={task.id} value={task.id}>
                                  {task.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {selectedTaskId ? (
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => onSelectedTaskChange?.("")}>
                              <X className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </>
                      ) : (
                        <div className={cn("flex min-h-[44px] w-full items-center rounded-[1rem] border px-3 text-sm", darkMode ? "border-slate-700 bg-slate-900/80 text-slate-400" : "border-slate-200 bg-white text-slate-600")}>
                          {selectedSubjectId ? "Keine offenen Aufgaben fuer dieses Fach vorhanden." : "Waehle zuerst ein Fach aus."}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid gap-3">
                  <div className={cn("rounded-[1rem] border p-4", fieldSurfaceClass)}>
                    <Label>Lernthema (optional)</Label>
                    <div className="mt-3 flex items-center gap-2">
                      {selectedSubjectId && openTopicsForSubject.length > 0 ? (
                        <>
                          <Select value={selectedTopicId || ""} onValueChange={(value) => onSelectedTopicChange?.(value || "")}>
                            <SelectTrigger className="border-0 bg-transparent px-0 text-base font-semibold shadow-none focus:ring-0 focus:ring-offset-0">
                              <SelectValue placeholder="Lernthema auswaehlen" />
                            </SelectTrigger>
                            <SelectContent>
                              {openTopicsForSubject.map((topic) => (
                                <SelectItem key={topic.id} value={topic.id}>
                                  {topic.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {selectedTopicId ? (
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => onSelectedTopicChange?.("")}>
                              <X className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </>
                      ) : (
                        <div className={cn("flex min-h-[44px] w-full items-center rounded-[1rem] border px-3 text-sm", darkMode ? "border-slate-700 bg-slate-900/80 text-slate-400" : "border-slate-200 bg-white text-slate-600")}>
                          {selectedSubjectId ? "Fuer dieses Fach gibt es noch keine Lernthemen." : "Waehle zuerst ein Fach aus."}
                        </div>
                      )}
                    </div>
                  </div>

                  {selectedSubjectId && onCreateTopic ? (
                    <div className={cn("rounded-[1rem] border p-4", fieldSurfaceClass)}>
                      <Label>Neues Lernthema direkt anlegen</Label>
                      <div className="mt-3 grid gap-3">
                        <Input
                          value={newTopicTitle}
                          onChange={(event) => setNewTopicTitle(event.target.value)}
                          placeholder="Titel des Lernthemas"
                          className={darkMode ? "border-slate-700 bg-slate-900 text-slate-50 placeholder:text-slate-500" : ""}
                        />
                        <Textarea
                          value={newTopicCheatsheet}
                          onChange={(event) => setNewTopicCheatsheet(event.target.value)}
                          placeholder="Cheatsheet / Notiz"
                          className={cn("min-h-[88px] resize-none", darkMode ? "border-slate-700 bg-slate-900 text-slate-50 placeholder:text-slate-500" : "")}
                        />
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Input
                            value={newTopicUrl}
                            onChange={(event) => setNewTopicUrl(event.target.value)}
                            placeholder="Cheatsheet-Link (optional)"
                            className={darkMode ? "border-slate-700 bg-slate-900 text-slate-50 placeholder:text-slate-500" : ""}
                          />
                          <Button type="button" variant="secondary" className="rounded-[1rem]" onClick={createTopicFromSheet} disabled={!newTopicTitle.trim() || isCreatingTopic}>
                            {isCreatingTopic ? "Wird angelegt..." : "Lernthema anlegen"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className={cn("rounded-[1.3rem] border p-4", sectionSurfaceClass)}>
                <div>
                  <p className={cn("text-xs font-semibold uppercase tracking-[0.18em]", mutedTextClass)}>Details</p>
                  <h4 className="mt-1 text-base font-semibold">Aktivitaet, Sicherheit und Notiz</h4>
                </div>

                <div className="mt-4 grid gap-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className={cn("rounded-[1rem] border p-4", fieldSurfaceClass)}>
                      <Label>Aktivitaet</Label>
                      <Select value={activityType} onValueChange={(value) => setActivityType(normalizeActivityType(value, "exercises_practiced"))}>
                        <SelectTrigger className="mt-3 border-0 bg-transparent px-0 text-base font-semibold shadow-none focus:ring-0 focus:ring-offset-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ACTIVITY_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
                              {ACTIVITY_TYPE_LABELS[type]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className={cn("rounded-[1rem] border p-4", fieldSurfaceClass)}>
                      <Label>Sicherheit</Label>
                      <Select value={confidence} onValueChange={(value) => setConfidence(normalizeConfidence(value))}>
                        <SelectTrigger className="mt-3 border-0 bg-transparent px-0 text-base font-semibold shadow-none focus:ring-0 focus:ring-offset-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CONFIDENCE_LEVELS.map((level) => (
                            <SelectItem key={level} value={level}>
                              {CONFIDENCE_LABELS[level]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {activityType === "cheatsheet_created" ? (
                    <label className={cn("flex items-center justify-between gap-3 rounded-[1rem] border p-4 text-sm", fieldSurfaceClass)}>
                      <span>Auch geuebt und als Wiederholung zaehlen</span>
                      <input
                        type="checkbox"
                        checked={alsoPracticed}
                        onChange={(event) => setAlsoPracticed(event.target.checked)}
                        className="h-4 w-4"
                      />
                    </label>
                  ) : null}

                  <div className={cn("rounded-[1rem] border p-4", fieldSurfaceClass)}>
                    <Label>Notiz</Label>
                    <Textarea
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="Kurze Notiz zur Lerneinheit"
                      className={cn(inputClass, "mt-3 min-h-[132px] resize-none text-base")}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className={cn("border-t px-4 py-4 sm:px-6", darkMode ? "border-slate-800 bg-slate-950/75" : "border-slate-200 bg-white")}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className={cn("flex items-center gap-2 text-sm", !selectedSubjectId || durationMinutes <= 0 ? "text-destructive" : "text-muted-foreground")}>
                <PencilLine className="h-4 w-4" />
                {!selectedSubjectId 
                  ? "Bitte Fach waehlen." 
                  : durationMinutes > 0 
                    ? `${formatMinutes(durationMinutes)} werden gespeichert.` 
                    : "Bitte gueltige Dauer eingeben."}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="button" variant="outline" className="h-11 rounded-[1rem] px-4" onClick={() => onOpenChange(false)} disabled={isSaving}>
                  Abbrechen
                </Button>
                <Button 
                  type="button" 
                  className={cn("h-11 rounded-[1rem] px-4", (!selectedSubjectId || durationMinutes <= 0) && "opacity-50 cursor-not-allowed")} 
                  onClick={saveEntry} 
                  disabled={isSaving || !selectedSubjectId || durationMinutes <= 0}
                >
                  <Check className="h-4 w-4" />
                  {submitLabel}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
