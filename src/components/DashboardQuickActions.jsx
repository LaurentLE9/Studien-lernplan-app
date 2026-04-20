import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Pause,
  Play,
  Plus,
  TimerReset,
  X,
} from "lucide-react";
import {
  cancelTimerSession,
  finishTimerSession,
  loadActiveTimerSession,
  pauseTimerSession,
  resumeTimerSession,
  startTimerSession,
} from "@/lib/cloudStore";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import ManualStudySheet from "@/components/ManualStudySheet";

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

export default function DashboardQuickActions({
  subjects,
  tasks,
  topics,
  onSaveSession,
  darkMode,
  userId,
}) {
  const storedTimer = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("study_planner_timer_state") || "{}");
    } catch {
      return {};
    }
  }, []);

  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [manualSeed, setManualSeed] = useState(null);
  const [timerOpen, setTimerOpen] = useState(false);
  const [timerTaskSelectMode, setTimerTaskSelectMode] = useState(false);
  const [expireDialogOpen, setExpireDialogOpen] = useState(false);
  const [manualSubjectId, setManualSubjectId] = useState("");
  const [manualTopicId, setManualTopicId] = useState("");
  const [timerSubjectId, setTimerSubjectId] = useState(storedTimer.timerSubjectId || subjects[0]?.id || "");
  const [timerTaskId, setTimerTaskId] = useState(storedTimer.timerTaskId || "");
  const [timerMode, setTimerMode] = useState(storedTimer.timerMode || "stopwatch");
  const [timerPreset, setTimerPreset] = useState(storedTimer.timerPreset || 90);
  const [customPomodoroMinutes, setCustomPomodoroMinutes] = useState(String(storedTimer.timerPreset || 90));
  const [customPomodoroError, setCustomPomodoroError] = useState("");
  const [activeTimer, setActiveTimer] = useState(null);
  const [tickNowMs, setTickNowMs] = useState(Date.now());
  const [timerBusy, setTimerBusy] = useState(false);
  const intervalRef = useRef(null);

  const actionButtonBaseClass =
    "h-11 rounded-[1rem] px-4 shadow-[var(--shadow-xs)] sm:h-12 sm:px-5";
  const manualButtonClass = darkMode
    ? "border-white/10 bg-white text-slate-950 hover:bg-slate-100"
    : "border-border/70 bg-[hsl(var(--surface)/0.96)] text-slate-950 hover:bg-slate-100";
  const timerButtonClass = darkMode
    ? "border-blue-400/40 bg-blue-600 text-white hover:bg-blue-500 disabled:border-slate-700 disabled:bg-slate-900 disabled:text-slate-400"
    : "border-blue-300 bg-blue-600 text-white hover:bg-blue-500 disabled:border-slate-200 disabled:bg-slate-200 disabled:text-slate-500";
  const sheetSurfaceClass = darkMode
    ? "border-slate-800 bg-[#0f172a] text-slate-50"
    : "border-slate-200 bg-white text-slate-900";
  const sectionSurfaceClass = darkMode
    ? "border-slate-800 bg-slate-950/60"
    : "border-slate-200 bg-slate-50/90";
  const subtleSurfaceClass = darkMode
    ? "border-slate-800/80 bg-slate-900/80"
    : "border-slate-200 bg-white";
  const mutedTextClass = darkMode ? "text-slate-400" : "text-slate-600";
  const isTimerBackedManualEntry = (source) => source === "stopwatch" || source === "pomodoro";
  const tasksForTimerSubject = (tasks || []).filter((task) => task.subjectId === timerSubjectId);

  useEffect(() => {
    if (!timerSubjectId && subjects[0]?.id) setTimerSubjectId(subjects[0].id);
  }, [subjects, timerSubjectId]);

  useEffect(() => {
    localStorage.setItem("study_planner_timer_state", JSON.stringify({
      timerSubjectId,
      timerTaskId,
      timerMode,
      timerPreset,
    }));
  }, [timerSubjectId, timerTaskId, timerMode, timerPreset]);

  useEffect(() => {
    setCustomPomodoroMinutes(String(timerPreset));
  }, [timerPreset]);

  useEffect(() => {
    if (!timerOpen) {
      setTimerTaskSelectMode(false);
      setCustomPomodoroError("");
    }
  }, [timerOpen]);

  useEffect(() => {
    if (!activeTimer || (activeTimer.status !== "running" && activeTimer.status !== "paused")) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setTickNowMs(Date.now());
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [activeTimer]);

  useEffect(() => {
    if (!userId) {
      setActiveTimer(null);
      return;
    }

    let cancelled = false;
    const restoreActiveTimer = async () => {
      try {
        const existing = await loadActiveTimerSession(userId);
        if (cancelled) return;
        if (existing) {
          setActiveTimer(existing);
          setTimerOpen(false);
          setTimerSubjectId(existing.subjectId || "");
          if (existing.mode === "pomodoro") {
            setTimerMode("pomodoro");
            if (existing.presetMinutes) {
              setTimerPreset(existing.presetMinutes);
            }
          } else {
            setTimerMode("stopwatch");
          }
        } else {
          setActiveTimer(null);
        }
      } catch (error) {
        console.error("Restore active timer failed:", error);
      }
    };
    restoreActiveTimer();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  function getElapsedSeconds(session, nowMs = Date.now()) {
    if (!session?.startedAt) return 0;
    const startedMs = new Date(session.startedAt).getTime();
    const pausedMs = session.pausedAt ? new Date(session.pausedAt).getTime() : nowMs;
    const endMs = session.status === "paused" ? pausedMs : nowMs;
    const raw = Math.max(0, Math.floor((endMs - startedMs) / 1000));
    return Math.max(0, raw - Number(session.totalPauseSeconds || 0));
  }

  function getCurrentPauseSeconds(session, nowMs = Date.now()) {
    if (!session) return 0;
    const persisted = Math.max(0, Number(session.totalPauseSeconds || 0));
    if (session.status !== "paused" || !session.pausedAt) {
      return persisted;
    }
    const pausedAtMs = new Date(session.pausedAt).getTime();
    const activePause = Math.max(0, Math.floor((nowMs - pausedAtMs) / 1000));
    return persisted + activePause;
  }

  function getCurrentPauseMinutes(session, nowMs = Date.now()) {
    return Math.floor(getCurrentPauseSeconds(session, nowMs) / 60);
  }

  function getDisplaySeconds(session) {
    const elapsed = getElapsedSeconds(session, tickNowMs);
    if (session?.mode === "pomodoro") {
      const presetSeconds = Math.max(1, Number(session.presetMinutes || timerPreset || 90)) * 60;
      return Math.max(0, presetSeconds - elapsed);
    }
    return elapsed;
  }

  function openManualWithSeed(subjectId, seed = null) {
    setManualSubjectId(subjectId || "");
    setManualTopicId(seed?.taskId || "");
    setManualSeed(seed);
    setManualDialogOpen(true);
  }

  function applyPomodoroPreset(minutes) {
    const normalized = Math.max(1, Math.floor(Number(minutes) || 0));
    setTimerPreset(normalized);
    setCustomPomodoroMinutes(String(normalized));
    setCustomPomodoroError("");
  }

  function applyCustomPomodoroMinutes() {
    const rawValue = String(customPomodoroMinutes || "").trim();
    if (!/^\d+$/.test(rawValue)) {
      setCustomPomodoroError("Bitte eine ganze Zahl groesser als 0 eingeben.");
      return;
    }

    const parsedMinutes = Number(rawValue);
    if (!Number.isFinite(parsedMinutes) || parsedMinutes <= 0) {
      setCustomPomodoroError("Bitte eine ganze Zahl groesser als 0 eingeben.");
      return;
    }

    applyPomodoroPreset(parsedMinutes);
  }

  function resetTimerFlowState() {
    setActiveTimer(null);
    setTimerOpen(false);
    setExpireDialogOpen(false);
    setTickNowMs(Date.now());
  }

  async function stopAndResetTimerSession(strategy = "finish", sessionToClose = activeTimer) {
    if (!userId || !sessionToClose) return;
    if (strategy === "cancel") {
      await cancelTimerSession(userId, sessionToClose.id);
    } else {
      await finishTimerSession(userId, sessionToClose.id);
    }
    resetTimerFlowState();
  }

  async function handleTimerSubjectPick(subjectId) {
    setTimerSubjectId(subjectId);
    setTimerTaskId("");
    setTimerTaskSelectMode(true);
  }

  async function handleTimerTaskPick(taskId) {
    setTimerTaskId(taskId);
    setTimerTaskSelectMode(false);
    setTimerOpen(false);

    if (!userId || !timerSubjectId || activeTimer) return;

    try {
      setTimerBusy(true);
      const created = await startTimerSession(userId, timerSubjectId, {
        mode: timerMode,
        presetMinutes: timerPreset,
        taskId: taskId || undefined,
      });
      if (created) {
        setActiveTimer(created);
        setTickNowMs(Date.now());
      }
    } catch (error) {
      console.error("Start timer failed:", error);
    } finally {
      setTimerBusy(false);
    }
  }

  async function handleTimerStartWithoutTask() {
    setTimerTaskId("");
    setTimerTaskSelectMode(false);
    setTimerOpen(false);

    if (!userId || !timerSubjectId || activeTimer) return;

    try {
      setTimerBusy(true);
      const created = await startTimerSession(userId, timerSubjectId, {
        mode: timerMode,
        presetMinutes: timerPreset,
      });
      if (created) {
        setActiveTimer(created);
        setTickNowMs(Date.now());
      }
    } catch (error) {
      console.error("Start timer failed:", error);
    } finally {
      setTimerBusy(false);
    }
  }

  async function pauseQuickTimer() {
    if (!userId || !activeTimer || activeTimer.status !== "running") return;
    try {
      setTimerBusy(true);
      const updated = await pauseTimerSession(userId, activeTimer.id);
      if (updated) setActiveTimer(updated);
    } catch (error) {
      console.error("Pause timer failed:", error);
    } finally {
      setTimerBusy(false);
    }
  }

  async function resumeQuickTimer() {
    if (!userId || !activeTimer || activeTimer.status !== "paused") return;
    try {
      setTimerBusy(true);
      const updated = await resumeTimerSession(userId, activeTimer.id);
      if (updated) {
        setActiveTimer(updated);
        setTickNowMs(Date.now());
      }
    } catch (error) {
      console.error("Resume timer failed:", error);
    } finally {
      setTimerBusy(false);
    }
  }

  function openManualFromActiveTimer() {
    if (!activeTimer?.subjectId) return;
    const now = new Date();
    const nowMs = Date.now();
    const elapsedSeconds = getElapsedSeconds(activeTimer, Date.now());
    const durationMinutes = Math.max(1, Math.round(elapsedSeconds / 60));
    const start = new Date(now.getTime() - durationMinutes * 60000);
    const taskLabel = selectedTask?.title || null;
    openManualWithSeed(activeTimer.subjectId, {
      date: formatDateInput(now),
      startTime: toTimeInputValue(start),
      endTime: toTimeInputValue(now),
      breakMinutes: String(getCurrentPauseMinutes(activeTimer, nowMs)),
      activity: activeTimer.mode === "pomodoro" ? "Pomodoro" : "Stoppuhr",
      note: activeTimer.mode === "pomodoro"
        ? `${taskLabel ? `Aufgabe: ${taskLabel} - ` : ""}Pomodoro ${activeTimer.presetMinutes || timerPreset} Minuten`
        : taskLabel || "Stoppuhr-Sitzung",
      source: activeTimer.mode || "stopwatch",
      taskId: selectedTask?.id || "",
    });
  }

  async function handleExpireSave() {
    if (!activeTimer || !userId) return;
    try {
      setTimerBusy(true);
      const elapsedSeconds = getElapsedSeconds(activeTimer, Date.now());
      const durationMinutes = Math.max(1, Math.round(elapsedSeconds / 60));
      const taskLabel = selectedTask?.title || null;

      if (elapsedSeconds > 0 && activeTimer.subjectId) {
        onSaveSession({
          id: crypto.randomUUID(),
          subjectId: activeTimer.subjectId,
          taskId: selectedTask?.id || undefined,
          durationMinutes,
          createdAt: new Date().toISOString(),
          source: activeTimer.mode || "stopwatch",
          note: activeTimer.mode === "pomodoro"
            ? `${taskLabel ? `Aufgabe: ${taskLabel} - ` : ""}Pomodoro ${activeTimer.presetMinutes || timerPreset} Minuten`
            : taskLabel || "Stoppuhr-Sitzung",
        });
      }

      await stopAndResetTimerSession("finish", activeTimer);
    } catch (error) {
      console.error("Finish timer with save failed:", error);
    } finally {
      setTimerBusy(false);
    }
  }

  async function handleExpireDiscard() {
    if (!activeTimer || !userId) return;
    try {
      setTimerBusy(true);
      await stopAndResetTimerSession("cancel", activeTimer);
    } catch (error) {
      console.error("Cancel timer failed:", error);
    } finally {
      setTimerBusy(false);
    }
  }

  async function handleManualSaveEntry(entry) {
    onSaveSession(entry);

    if (!activeTimer || !isTimerBackedManualEntry(entry?.source)) {
      setManualSeed(null);
      return;
    }

    try {
      setTimerBusy(true);
      await stopAndResetTimerSession("finish", activeTimer);
    } catch (error) {
      console.error("Finish timer after manual save failed:", error);
    } finally {
      setTimerBusy(false);
      setManualSeed(null);
    }
  }

  const selectedSubjectId = activeTimer?.subjectId || timerSubjectId;
  const timerSubject = subjects.find((subject) => subject.id === selectedSubjectId);
  const selectedTask = tasks.find((task) => task.id === timerTaskId) || null;
  const timerTaskChoices = tasksForTimerSubject.length > 0 ? tasksForTimerSubject : (tasks || []);
  const showingFallbackTasks = tasksForTimerSubject.length === 0 && (tasks || []).length > 0;
  const displaySeconds = activeTimer ? getDisplaySeconds(activeTimer) : 0;
  const timerDisplay = `${String(Math.floor(displaySeconds / 3600)).padStart(2, "0")}:${String(Math.floor((displaySeconds % 3600) / 60)).padStart(2, "0")}:${String(displaySeconds % 60).padStart(2, "0")}`;
  const isPaused = activeTimer?.status === "paused";
  const livePauseMinutes = activeTimer ? getCurrentPauseMinutes(activeTimer, tickNowMs) : undefined;
  const timerModeLabel = timerMode === "pomodoro" ? "Pomodoro" : "Stoppuhr";
  const activeTimerDetail = selectedTask?.title
    || (activeTimer?.mode === "pomodoro" ? "Pomodoro ohne Aufgabe" : "Zeit laeuft ohne Aufgabe");

  return (
    <>
      <Dialog
        open={timerOpen}
        onOpenChange={(open) => {
          setTimerOpen(open);
          if (!open) setTimerTaskSelectMode(false);
        }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={() => {
              setManualSeed(null);
              setManualDialogOpen(true);
              setTimerOpen(false);
            }}
            className={cn(actionButtonBaseClass, manualButtonClass)}
          >
            <Plus className="h-4 w-4" />
            Lerneinheit anlegen
          </Button>

          <Button
            type="button"
            onClick={() => setTimerOpen(true)}
            className={cn(actionButtonBaseClass, timerButtonClass)}
            disabled={!!activeTimer}
          >
            <Play className="h-4 w-4" />
            Timer
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>

        <DialogContent
          position="right"
          showClose={false}
          className={cn("border-l shadow-[var(--shadow-medium)]", sheetSurfaceClass)}
        >
          <Tabs value={timerMode} onValueChange={setTimerMode} className="flex h-full min-h-0 flex-col overflow-hidden">
            <div className={cn("border-b px-4 pb-4 pt-5 sm:px-6", darkMode ? "border-slate-800 bg-slate-950/75" : "border-slate-200 bg-white")}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className={cn("text-xs font-semibold uppercase tracking-[0.2em]", mutedTextClass)}>Timer</p>
                  <h3 className="mt-1 text-xl font-semibold">Lernsitzung starten</h3>
                  <p className={cn("mt-1 text-sm", mutedTextClass)}>Stoppuhr oder Pomodoro vorbereiten und anschliessend Fach und Aufgabe waehlen.</p>
                </div>
                <Button type="button" variant="ghost" size="icon" className="rounded-[1rem]" onClick={() => setTimerOpen(false)} aria-label="Timer schliessen">
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={cn("rounded-full border px-3 py-1.5 text-xs", darkMode ? "border-slate-700 bg-slate-900/80 text-slate-200" : "border-slate-200 bg-slate-50 text-slate-700")}>
                  {timerModeLabel}
                </Badge>
                {timerMode === "pomodoro" ? (
                  <Badge variant="outline" className={cn("rounded-full border px-3 py-1.5 text-xs", darkMode ? "border-slate-700 bg-slate-900/80 text-slate-200" : "border-slate-200 bg-slate-50 text-slate-700")}>
                    {timerPreset} Min.
                  </Badge>
                ) : null}
                {timerSubject ? (
                  <span className="inline-flex max-w-full items-center rounded-full px-3 py-1.5 text-xs font-semibold text-slate-950" style={{ backgroundColor: timerSubject.color }}>
                    <span className="truncate">{timerSubject.name}</span>
                  </span>
                ) : null}
                {selectedTask ? (
                  <Badge variant="outline" className={cn("rounded-full border px-3 py-1.5 text-xs", darkMode ? "border-slate-700 bg-slate-900/80 text-slate-200" : "border-slate-200 bg-slate-50 text-slate-700")}>
                    <span className="max-w-[12rem] truncate">{selectedTask.title}</span>
                  </Badge>
                ) : null}
              </div>

              <TabsList className={cn("mt-5 grid w-full grid-cols-2 rounded-[1.1rem] p-1", darkMode ? "bg-[#22304a]" : "bg-slate-100")}>
                <TabsTrigger value="stopwatch" className="rounded-[0.9rem] px-4 py-2.5 data-[state=active]:bg-slate-950 data-[state=active]:text-white dark:data-[state=active]:bg-slate-100 dark:data-[state=active]:text-slate-950">
                  Stoppuhr
                </TabsTrigger>
                <TabsTrigger value="pomodoro" className="rounded-[0.9rem] px-4 py-2.5 data-[state=active]:bg-slate-950 data-[state=active]:text-white dark:data-[state=active]:bg-slate-100 dark:data-[state=active]:text-slate-950">
                  Pomodoro
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-4 sm:px-6">
              <div className="grid gap-5 py-5">
                <TabsContent value="stopwatch" className="m-0">
                  <div className={cn("rounded-[1.3rem] border p-4", sectionSurfaceClass)}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold">Stoppuhr</p>
                        <p className={cn("mt-1 text-sm", mutedTextClass)}>Die Zeit laeuft offen weiter, bis du pausierst oder speicherst.</p>
                      </div>
                      <Badge variant="outline" className={cn("rounded-full border px-3 py-1.5 text-xs", darkMode ? "border-slate-700 bg-slate-900/80 text-slate-200" : "border-slate-200 bg-white text-slate-700")}>
                        Offen
                      </Badge>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="pomodoro" className="m-0">
                  <div className={cn("rounded-[1.3rem] border p-4", sectionSurfaceClass)}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold">Pomodoro-Dauer</p>
                        <p className={cn("mt-1 text-sm", mutedTextClass)}>Waehle ein Preset oder setze eine eigene Dauer in Minuten.</p>
                      </div>
                      <Badge variant="outline" className={cn("rounded-full border px-3 py-1.5 text-xs", darkMode ? "border-slate-700 bg-slate-900/80 text-slate-200" : "border-slate-200 bg-white text-slate-700")}>
                        {timerPreset} Min.
                      </Badge>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
                      {[25, 45, 60, 90, 120].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => applyPomodoroPreset(preset)}
                          className={cn(
                            "rounded-[1rem] border px-3 py-3 text-sm font-semibold transition",
                            timerPreset === preset
                              ? "border-blue-400/60 bg-blue-600 text-white shadow-[var(--shadow-xs)]"
                              : darkMode
                                ? "border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500 hover:bg-slate-800"
                                : "border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50"
                          )}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-[auto_1fr] sm:items-end">
                      <div className={cn("flex h-11 items-center justify-between rounded-[1rem] border px-3", subtleSurfaceClass)}>
                        <button type="button" onClick={() => applyPomodoroPreset(Math.max(5, timerPreset - 5))} className={cn("rounded-full p-1 transition", darkMode ? "text-slate-300 hover:text-white" : "text-slate-600 hover:text-slate-900")}>
                          -
                        </button>
                        <span className="px-3 text-sm font-semibold">{timerPreset} Min.</span>
                        <button type="button" onClick={() => applyPomodoroPreset(timerPreset + 5)} className={cn("rounded-full p-1 transition", darkMode ? "text-slate-300 hover:text-white" : "text-slate-600 hover:text-slate-900")}>
                          +
                        </button>
                      </div>

                      <div className="grid gap-2">
                        <Label className={cn("text-xs", mutedTextClass)}>Eigene Dauer (Minuten)</Label>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Input
                            value={customPomodoroMinutes}
                            onChange={(event) => {
                              setCustomPomodoroMinutes(event.target.value);
                              if (customPomodoroError) setCustomPomodoroError("");
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                applyCustomPomodoroMinutes();
                              }
                            }}
                            inputMode="numeric"
                            placeholder="z. B. 75"
                            className={cn(
                              "h-11 rounded-[1rem]",
                              darkMode ? "border-slate-700 bg-slate-900 text-slate-50 placeholder:text-slate-500" : "",
                              customPomodoroError ? "border-red-500 focus-visible:ring-red-500" : ""
                            )}
                          />
                          <Button type="button" variant="secondary" className={cn("h-11 rounded-[1rem] px-4", darkMode ? "bg-slate-100 text-slate-950 hover:bg-white" : "")} onClick={applyCustomPomodoroMinutes}>
                            Uebernehmen
                          </Button>
                        </div>
                        {customPomodoroError ? <p className="text-xs text-red-500">{customPomodoroError}</p> : null}
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <div className={cn("rounded-[1.3rem] border p-4", sectionSurfaceClass)}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className={cn("text-xs font-semibold uppercase tracking-[0.18em]", mutedTextClass)}>
                        {timerTaskSelectMode ? "Schritt 2 von 2" : "Schritt 1 von 2"}
                      </p>
                      <h4 className="mt-1 text-base font-semibold">
                        {timerTaskSelectMode ? "Aufgabe auswaehlen" : "Fach auswaehlen"}
                      </h4>
                    </div>
                    {timerTaskSelectMode ? (
                      <button
                        type="button"
                        onClick={() => setTimerTaskSelectMode(false)}
                        className={cn("inline-flex h-10 items-center gap-2 rounded-full border px-3 text-sm font-medium transition", darkMode ? "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50")}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Zurueck
                      </button>
                    ) : (
                      <Badge variant="outline" className={cn("rounded-full border px-3 py-1.5 text-xs", darkMode ? "border-slate-700 bg-slate-900/80 text-slate-200" : "border-slate-200 bg-white text-slate-700")}>
                        {subjects.length} Faecher
                      </Badge>
                    )}
                  </div>

                  <div className="mt-4 grid gap-2">
                    {!timerTaskSelectMode ? (
                      subjects.map((subject) => {
                        const isSelected = timerSubjectId === subject.id;
                        return (
                          <button
                            key={subject.id}
                            type="button"
                            onClick={() => handleTimerSubjectPick(subject.id)}
                            className={cn(
                              "flex w-full items-center gap-3 rounded-[1.1rem] border px-4 py-3.5 text-left transition",
                              darkMode ? "border-slate-800 bg-slate-900/70 hover:bg-slate-900" : "border-slate-200 bg-white hover:bg-slate-50",
                              isSelected ? "border-blue-400/60 bg-blue-500/10" : ""
                            )}
                          >
                            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[1rem]" style={{ backgroundColor: `${subject.color}26`, color: subject.color }}>
                              <BookOpen className="h-4 w-4" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className={cn("truncate font-semibold", darkMode ? "text-slate-100" : "text-slate-900")}>{subject.name}</p>
                              <p className={cn("mt-1 text-xs", mutedTextClass)}>Verfuegbare Aufgaben fuer dieses Fach anzeigen.</p>
                            </div>
                            {isSelected ? (
                              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
                                <Check className="h-4 w-4" />
                              </span>
                            ) : (
                              <ChevronRight className={cn("h-4 w-4 flex-shrink-0", mutedTextClass)} />
                            )}
                          </button>
                        );
                      })
                    ) : (
                      <>
                        <div className={cn("rounded-[1rem] border px-4 py-3 text-sm", darkMode ? "border-slate-700 bg-slate-900/80 text-slate-200" : "border-slate-200 bg-white text-slate-700")}>
                          <span className="font-semibold">{subjects.find((subject) => subject.id === timerSubjectId)?.name || "Fach"}</span>
                          <span className={cn("ml-2", mutedTextClass)}>Aufgabe auswaehlen oder direkt ohne Aufgabe starten.</span>
                        </div>

                        {timerTaskChoices.length === 0 ? (
                          <div className={cn("rounded-[1rem] border px-4 py-4 text-sm", darkMode ? "border-slate-700 bg-slate-900/80 text-slate-400" : "border-slate-200 bg-white text-slate-600")}>
                            Noch keine Aufgaben vorhanden.
                          </div>
                        ) : (
                          <>
                            {showingFallbackTasks ? (
                              <div className={cn("rounded-[1rem] border px-4 py-3 text-xs", darkMode ? "border-slate-700 bg-slate-900/80 text-slate-400" : "border-slate-200 bg-white text-slate-600")}>
                                Fuer dieses Fach gibt es noch keine Aufgaben. Deshalb werden alle Aufgaben angezeigt.
                              </div>
                            ) : null}
                            {timerTaskChoices.map((task) => {
                              const taskSubject = subjects.find((subject) => subject.id === task.subjectId);
                              return (
                                <button
                                  key={task.id}
                                  type="button"
                                  onClick={() => handleTimerTaskPick(task.id)}
                                  className={cn("flex w-full items-start gap-3 rounded-[1.1rem] border px-4 py-3 text-left transition", darkMode ? "border-slate-800 bg-slate-900/70 hover:bg-slate-900" : "border-slate-200 bg-white hover:bg-slate-50")}
                                >
                                  <span className={cn("mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full", darkMode ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600")}>
                                    <ChevronRight className="h-4 w-4" />
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <p className={cn("truncate font-medium", darkMode ? "text-slate-100" : "text-slate-900")}>{task.title}</p>
                                    {taskSubject ? (
                                      <div className="mt-2 flex flex-wrap gap-2">
                                        <span className="inline-flex max-w-full items-center rounded-full px-2.5 py-1 text-[11px] font-semibold text-slate-950" style={{ backgroundColor: taskSubject.color }}>
                                          <span className="max-w-[12rem] truncate">{taskSubject.name}</span>
                                        </span>
                                      </div>
                                    ) : null}
                                  </div>
                                </button>
                              );
                            })}
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className={cn("border-t px-4 py-4 sm:px-6", darkMode ? "border-slate-800 bg-slate-950/75" : "border-slate-200 bg-white")}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className={cn("min-w-0 text-sm", mutedTextClass)}>
                  {timerTaskSelectMode
                    ? "Waehle eine Aufgabe fuer den Timer oder starte direkt ohne Aufgabe."
                    : "Waehle zuerst ein Fach. Die Aufgabenliste folgt im zweiten Schritt."}
                </p>
                {timerTaskSelectMode ? (
                  <Button type="button" onClick={handleTimerStartWithoutTask} className="h-11 rounded-[1rem] bg-blue-600 px-4 text-white hover:bg-blue-500" disabled={!timerSubjectId || !!activeTimer || timerBusy}>
                    Ohne Aufgabe starten
                  </Button>
                ) : null}
              </div>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>

      {activeTimer ? (
        <div className="fixed inset-x-0 top-4 z-[80] px-3 sm:px-4">
          <div className={cn("mx-auto w-full max-w-[44rem] rounded-[1.4rem] border shadow-[var(--shadow-medium)] backdrop-blur-xl", darkMode ? "border-slate-700/70 bg-[#11192b]/95 text-slate-50" : "border-white/80 bg-white/95 text-slate-900")}>
            <div className="flex flex-wrap items-center gap-3 px-3 py-3 sm:px-4">
              {isPaused ? (
                <button
                  type="button"
                  onClick={resumeQuickTimer}
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-500"
                  disabled={timerBusy}
                  aria-label="Timer fortsetzen"
                >
                  <Play className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={pauseQuickTimer}
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-500"
                  disabled={timerBusy}
                  aria-label="Timer pausieren"
                >
                  <Pause className="h-4 w-4" />
                </button>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                  <span className={cn("rounded-full px-3 py-1.5", isPaused ? "bg-amber-500/20 text-amber-300" : "bg-emerald-500/20 text-emerald-300")}>
                    {isPaused ? "Pausiert" : "Laeuft"}
                  </span>
                  <span className={cn("rounded-full px-3 py-1.5", darkMode ? "bg-slate-900 text-slate-300" : "bg-slate-100 text-slate-700")}>
                    {activeTimer?.mode === "pomodoro" ? `${activeTimer.presetMinutes || timerPreset} Min. Pomodoro` : "Stoppuhr"}
                  </span>
                  {timerSubject ? (
                    <span className="inline-flex max-w-full items-center rounded-full px-3 py-1.5 text-slate-950" style={{ backgroundColor: timerSubject.color }}>
                      <span className="max-w-[12rem] truncate text-xs font-semibold">{timerSubject.name}</span>
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1">
                  <span className="font-mono text-xl font-semibold tracking-tight sm:text-2xl">{timerDisplay}</span>
                  <span className={cn("min-w-0 text-sm", mutedTextClass)}>
                    <span className="inline-block max-w-[20rem] truncate align-bottom">{activeTimerDetail}</span>
                  </span>
                </div>
              </div>

              <div className="ml-auto flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" onClick={openManualFromActiveTimer} className={cn("h-11 rounded-[1rem] px-4", darkMode ? "border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800" : "")}>
                  <Maximize2 className="h-4 w-4" />
                  In Eintrag
                </Button>
                <Button type="button" variant="outline" onClick={() => setExpireDialogOpen(true)} className={cn("h-11 rounded-[1rem] px-4", darkMode ? "border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800" : "")}>
                  <TimerReset className="h-4 w-4" />
                  Beenden
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <Dialog open={expireDialogOpen} onOpenChange={setExpireDialogOpen}>
        <DialogContent className={cn("max-w-md rounded-[1.5rem]", darkMode ? "border-slate-800 bg-[#11192b]" : "border-slate-200 bg-white")}>
          <DialogHeader>
            <DialogTitle className={darkMode ? "text-white" : "text-slate-900"}>Timer beenden</DialogTitle>
          </DialogHeader>
          <div className={cn("space-y-3 py-2 text-sm", darkMode ? "text-slate-300" : "text-slate-600")}>
            <p>Willst du die laufende Zeit speichern oder verwerfen?</p>
            <p className={darkMode ? "text-slate-100" : "text-slate-900"}>Aktuelle Dauer: <span className="font-mono font-semibold">{timerDisplay}</span></p>
          </div>
          <div className="flex flex-col gap-2 border-t border-border/70 pt-4 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setExpireDialogOpen(false)} className="rounded-[1rem]">Zurueck</Button>
            <Button variant="destructive" onClick={handleExpireDiscard} className="rounded-[1rem]" disabled={timerBusy}>Verwerfen</Button>
            <Button onClick={handleExpireSave} className="rounded-[1rem] bg-blue-600 hover:bg-blue-500" disabled={timerBusy}>Speichern</Button>
          </div>
        </DialogContent>
      </Dialog>

      <ManualStudySheet
        open={manualDialogOpen}
        onOpenChange={setManualDialogOpen}
        subjects={subjects || []}
        topics={topics || []}
        darkMode={darkMode}
        selectedSubjectId={manualSubjectId}
        onSelectedSubjectChange={setManualSubjectId}
        selectedTopicId={manualTopicId}
        onSelectedTopicChange={setManualTopicId}
        onSaveEntry={handleManualSaveEntry}
        initialValue={manualSeed}
        liveBreakMinutes={livePauseMinutes}
        title="Lerneinheit anlegen"
        submitLabel={manualSeed?.id ? "Aktualisieren" : "Speichern"}
      />
    </>
  );
}
