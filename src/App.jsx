import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock3,
  Download,
  GraduationCap,
  HelpCircle,
  LayoutDashboard,
  ListTodo,
  Maximize2,
  Monitor,
  Moon,
  Menu,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Plus,
  Search,
  Settings,
  Sun,
  Trash2,
  Upload,
  X,
    LogOut,
  } from "lucide-react";
  import AuthScreen from "@/components/AuthScreen";
  
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy } from "@dnd-kit/sortable";
import { SortableTile } from "@/components/SortableTile";

import {
  getActiveSession,
  signOutCurrentSession,
  loadUserPlannerData,
  saveUserPlannerData,
  normalizeDefaultData,
  loadActiveTimerSession,
  startTimerSession,
  pauseTimerSession,
  resumeTimerSession,
  finishTimerSession,
  cancelTimerSession,
  loadSemesters,
  createSemester,
  updateSemester,
  deleteSemester,
  loadSubjects,
  createSubjectRecord,
  updateSubjectRecord,
  archiveSubjectRecord,
  unarchiveSubjectRecord,
  deleteSubjectRecord,
} from "@/lib/cloudStore";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const STORAGE_KEY = "study_planner_app_v3";
const DASHBOARD_WIDGET_IDS = ["stats", "deadlines", "hours", "today", "recent", "done"];
const DEADLINE_FILTER_OPTIONS = [
  { id: "all", label: "Alle" },
  { id: "open", label: "Nur offene" },
  { id: "urgent", label: "Dringend" },
  { id: "today", label: "Heute lernen" },
  { id: "next3", label: "Naechste 3 Tage" },
];
const USER_CACHE_PREFIX = `${STORAGE_KEY}:user`;

function getUserCacheKey(userId) {
  return `${USER_CACHE_PREFIX}:${userId}`;
}

function readUserCache(userId) {
  try {
    const raw = localStorage.getItem(getUserCacheKey(userId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeUserCache(userId, data) {
  try {
    localStorage.setItem(getUserCacheKey(userId), JSON.stringify(data));
  } catch {
    // Ignore storage quota/errors and keep cloud sync path active.
  }
}

function normalizeDashboardLayout(layout) {
  if (!Array.isArray(layout)) return [...DASHBOARD_WIDGET_IDS];
  const filtered = layout.filter((id) => DASHBOARD_WIDGET_IDS.includes(id));
  const missing = DASHBOARD_WIDGET_IDS.filter((id) => !filtered.includes(id));
  return [...filtered, ...missing];
}

function normalizeDeadlineWidgetSettings(value) {
  const fallback = { activeFilter: "all", defaultFilter: "all" };
  const isValid = (filterId) => DEADLINE_FILTER_OPTIONS.some((option) => option.id === filterId);
  const activeFilter = isValid(value?.activeFilter) ? value.activeFilter : fallback.activeFilter;
  const defaultFilter = isValid(value?.defaultFilter) ? value.defaultFilter : fallback.defaultFilter;
  return { activeFilter, defaultFilter };
}

function taskMatchesDeadlineFilter(task, filterId) {
  if (filterId === "all") return true;
  if (filterId === "open") return task.status !== "erledigt";
  if (filterId === "urgent") return Boolean(task.urgent);
  if (filterId === "today") return Boolean(task.flaggedToday);
  if (filterId === "next3") {
    if (!task.nextRelevantDate || task.status === "erledigt") return false;
    const diff = daysUntil(task.nextRelevantDate);
    return diff !== null && diff >= 0 && diff <= 3;
  }
  return true;
}

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

// Export/Import functionality
function exportDataToJSON(data) {
  const exportData = {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    data: {
      subjects: data.subjects,
      tasks: data.tasks,
      studySessions: data.studySessions,
      settings: data.settings,
    },
  };
  return JSON.stringify(exportData, null, 2);
}

function importDataFromJSON(jsonString, existingData) {
  try {
    const imported = JSON.parse(jsonString);
    if (!imported.data) throw new Error("Invalid export format");
    
    return {
      subjects: imported.data.subjects || existingData.subjects,
      tasks: imported.data.tasks || existingData.tasks,
      studySessions: imported.data.studySessions || existingData.studySessions,
      settings: { ...existingData.settings, ...(imported.data.settings || {}) },
      seeds: existingData.seeds,
    };
  } catch (error) {
    throw new Error(`Import failed: ${error.message}`);
  }
}

function generateRecurringTask(originalTask, pattern) {
  if (pattern === "none" || !pattern) return null;
  
  const newTask = { ...originalTask };
  newTask.id = crypto.randomUUID();
  newTask.status = "offen";
  newTask.createdAt = formatDateInput(new Date());
  
  if (pattern === "weekly" && originalTask.dueDate) {
    const dueDate = new Date(originalTask.dueDate);
    dueDate.setDate(dueDate.getDate() + 7);
    newTask.dueDate = formatDateInput(dueDate);
    if (originalTask.acceptanceDate) {
      const acceptDate = new Date(originalTask.acceptanceDate);
      acceptDate.setDate(acceptDate.getDate() + 7);
      newTask.acceptanceDate = formatDateInput(acceptDate);
    }
  } else if (pattern === "monthly" && originalTask.dueDate) {
    const dueDate = new Date(originalTask.dueDate);
    dueDate.setMonth(dueDate.getMonth() + 1);
    newTask.dueDate = formatDateInput(dueDate);
    if (originalTask.acceptanceDate) {
      const acceptDate = new Date(originalTask.acceptanceDate);
      acceptDate.setMonth(acceptDate.getMonth() + 1);
      newTask.acceptanceDate = formatDateInput(acceptDate);
    }
  }
  
  return newTask;
}

function formatDateInput(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function formatDateDisplay(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function formatDateTimeDisplay(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function toTimeInputValue(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "00:00";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function normalizeTimeDraft(value) {
  const cleaned = String(value || "").replace(/[^\d:]/g, "");
  if (cleaned.includes(":")) {
    const [hours = "", minutes = ""] = cleaned.split(":");
    const h = hours.slice(0, 2);
    const m = minutes.slice(0, 2);
    return m.length ? `${h}:${m}` : h;
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

  hours = Math.min(23, Math.max(0, hours || 0));
  minutes = Math.min(59, Math.max(0, minutes || 0));

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function TimeInput24({ value, onChange, className }) {
  return (
    <Input
      type="text"
      inputMode="numeric"
      placeholder="HH:MM"
      value={value}
      onChange={(e) => onChange(normalizeTimeDraft(e.target.value))}
      onBlur={(e) => onChange(finalizeTime24(e.target.value, value || "00:00"))}
      className={className}
    />
  );
}

function buildSessionSeedFromEntry(entry) {
  const end = new Date(entry.createdAt || new Date());
  const durationMinutes = Number(entry.durationMinutes || 0);
  const start = new Date(end.getTime() - durationMinutes * 60000);
  return {
    id: entry.id,
    date: formatDateInput(end),
    startTime: toTimeInputValue(start),
    endTime: toTimeInputValue(end),
    breakMinutes: "0",
    activity: "",
    note: entry.note || "",
    source: entry.source || "manual-entry",
  };
}

function formatMinutes(minutes) {
  const totalMinutes = Math.max(0, Math.round(Number(minutes) || 0));
  if (!totalMinutes) return "0min";
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h && m) return `${h}h ${m}min`;
  if (h) return `${h}h`;
  return `${m}min`;
}

function formatMinutesCompact(minutes) {
  const totalMinutes = Math.max(0, Math.round(Number(minutes) || 0));
  if (!totalMinutes) return "–";
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h},${String(m).padStart(2, "0")}h`;
}

function formatMinutesAsHourComma(minutes, withSuffix = true) {
  const totalMinutes = Math.max(0, Math.round(Number(minutes) || 0));
  if (!totalMinutes) return withSuffix ? "0,00h" : "0,00";
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const value = `${h},${String(m).padStart(2, "0")}`;
  return withSuffix ? `${value}h` : value;
}

function formatDecimalHoursAsHourComma(hours, withSuffix = true) {
  if (!hours) return withSuffix ? "0,00h" : "0,00";
  const totalMinutes = Math.round(Number(hours) * 60);
  return formatMinutesAsHourComma(totalMinutes, withSuffix);
}

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isSameDay(a, b) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

function getWeekStart(date = new Date()) {
  const d = startOfDay(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function daysUntil(dateValue) {
  if (!dateValue) return null;
  const today = startOfDay(new Date());
  const target = startOfDay(new Date(dateValue));
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function deadlineLabel(dateValue, status) {
  if (!dateValue) return "Kein Termin";
  if (status === "erledigt") return "Erledigt";
  const diff = daysUntil(dateValue);
  if (diff > 1) return `Fällig in ${diff} Tagen`;
  if (diff === 1) return "Fällig morgen";
  if (diff === 0) return "Heute fällig";
  if (diff === -1) return "1 Tag überfällig";
  return `${Math.abs(diff)} Tage überfällig`;
}

function deadlineTone(dateValue, status) {
  if (status === "erledigt") return "bg-emerald-200 text-slate-950 ring-1 ring-emerald-300";
  const diff = daysUntil(dateValue);
  if (diff === null) return "bg-slate-200 text-slate-950 ring-1 ring-slate-300";
  if (diff < 0) return "bg-red-300 text-slate-950 ring-1 ring-red-400";
  if (diff === 0) return "bg-red-200 text-slate-950 ring-1 ring-red-300";
  if (diff === 1) return "bg-orange-200 text-slate-950 ring-1 ring-orange-300";
  if (diff <= 3) return "bg-amber-200 text-slate-950 ring-1 ring-amber-300";
  if (diff <= 7) return "bg-yellow-200 text-slate-950 ring-1 ring-yellow-300";
  return "bg-slate-200 text-slate-950 ring-1 ring-slate-300";
}

function deadlineCardTone(dateValue, status) {
  if (status === "erledigt") return "border-emerald-500/30 bg-emerald-500/5";
  const diff = daysUntil(dateValue);
  if (diff === null) return "";
  if (diff < 0) return "border-red-500/40 bg-red-500/5";
  if (diff === 0) return "border-red-400/35 bg-red-400/5";
  if (diff === 1) return "border-orange-400/35 bg-orange-400/5";
  if (diff <= 3) return "border-amber-400/35 bg-amber-400/5";
  if (diff <= 7) return "border-yellow-400/30 bg-yellow-400/5";
  return "";
}

function priorityTone(priority) {
  if (priority === "hoch") return "destructive";
  if (priority === "mittel") return "secondary";
  return "outline";
}

function getSurfaceClass(darkMode) {
  return darkMode
    ? "border-slate-800 bg-slate-900 text-slate-50"
    : "border-slate-200 bg-white text-slate-900";
}

function getSoftSurfaceClass(darkMode) {
  return darkMode
    ? "border-slate-800 bg-[#141b2b] text-slate-50"
    : "border-slate-200 bg-white/90 text-slate-900";
}

const SUBJECTS = [
  { name: "Mathematik 2", color: "#5eead4", targetHours: 60 },
  { name: "Betriebssysteme", color: "#fca5a5", targetHours: 45 },
  { name: "Diskrete Mathematik", color: "#fcd34d", targetHours: 60 },
  { name: "Labormathematik", color: "#fcd34d", targetHours: 30 },
  { name: "Laborstatistik", color: "#fdba74", targetHours: 30 },
  { name: "Objektorientierte Systeme", color: "#6ee7b7", targetHours: 60 },
  { name: "Offene Sicherheit", color: "#93c5fd", targetHours: 60 },
  { name: "Statistik", color: "#fdba74", targetHours: 45 },
];

const TASK_IMPORTS = [
  ["Projekt 2 Statistik", "Statistik", "offen", 22, "mittel"],
  ["Projekt 3 (Teil 1) Statistik", "Statistik", "offen", 29, "mittel"],
  ["Labor Mathe Car", "Labormathematik", "offen", 30, "mittel"],
  ["Betriebssysteme Labor 2", "Betriebssysteme", "offen", 37, "mittel"],
  ["Projekt 3 (Teil 2) Statistik", "Statistik", "offen", 43, "mittel"],
  ["Betriebssysteme Labor 3", "Betriebssysteme", "offen", 65, "mittel"],
  ["Labor Mathe Swingboat", "Labormathematik", "offen", 65, "mittel"],
  ["Projekt 4 Statistik", "Statistik", "offen", 78, "mittel"],
  ["Labor Mathe Saxophone", "Labormathematik", "offen", 79, "mittel"],
  ["Projekt 1 Statistik", "Statistik", "in Bearbeitung", 8, "hoch"],
  ["Betriebssysteme Labor 1", "Betriebssysteme", "in Bearbeitung", 9, "hoch"],
  ["Labor Mathe Python", "Labormathematik", "in Bearbeitung", 9, "hoch"],
  ["c++ Aufgabe 0", "Objektorientierte Systeme", "erledigt", -11, "mittel"],
  ["c++ Aufgabe 1", "Objektorientierte Systeme", "erledigt", -11, "mittel"],
  ["c++ Aufgabe 2", "Objektorientierte Systeme", "erledigt", -4, "mittel"],
  ["c++ Aufgabe 3", "Objektorientierte Systeme", "erledigt", -4, "mittel"],
  ["c++ Aufgabe 4", "Objektorientierte Systeme", "erledigt", -4, "mittel"],
  ["c++ Aufgabe 5", "Objektorientierte Systeme", "erledigt", -4, "mittel"],
  ["c++ Aufgabe 6", "Objektorientierte Systeme", "erledigt", 3, "hoch"],
];

const SEEDED_HOURS = {
  "Mathematik 2": 3,
  Betriebssysteme: 5,
  "Diskrete Mathematik": 2,
  Labormathematik: 2,
  Laborstatistik: 0,
  "Objektorientierte Systeme": 16,
  "Offene Sicherheit": 0,
  Statistik: 3,
};

function makeInitialSubjects() {
  return SUBJECTS.map((subject) => ({
    id: crypto.randomUUID(),
    name: subject.name,
    color: subject.color,
    targetHours: subject.targetHours,
    description: "",
    semester: "2. Semester",
    goal: "",
  }));
}

function getTaskMilestones(task) {
  return [
    task.dueDate ? { label: "Abgabe", date: task.dueDate } : null,
    task.acceptanceDate ? { label: "Abnahme", date: task.acceptanceDate } : null,
  ]
    .filter(Boolean)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

function getNextTaskMilestone(task) {
  const milestones = getTaskMilestones(task);
  return milestones[0] || null;
}

function getTaskSortTimestamp(task) {
  return new Date(task.acceptanceDate || task.nextRelevantDate || task.dueDate || task.createdAt || 0).getTime();
}

function isTaskArchived(task) {
  if (task.archived) return true;
  if (task.status !== "erledigt") return false;
  if (!task.acceptanceDate) return false;
  const acceptance = startOfDay(new Date(task.acceptanceDate));
  const today = startOfDay(new Date());
  return acceptance.getTime() <= today.getTime();
}

function usePersistentState() {
  const [data, setData] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return {
          subjects: makeInitialSubjects(),
          tasks: [],
          studySessions: [],
          todayFocus: [],
          settings: {
            appearance: "light",
            sidebarCollapsed: false,
            dashboardLayout: [...DASHBOARD_WIDGET_IDS],
            deadlineWidget: normalizeDeadlineWidgetSettings(),
          },
          seeds: { tasks: false, sessions: false },
        };
      }
      const parsed = JSON.parse(raw);
      return {
        subjects: parsed.subjects?.length ? parsed.subjects : makeInitialSubjects(),
        tasks: parsed.tasks || [],
        studySessions: parsed.studySessions || [],
        todayFocus: parsed.todayFocus || [],
        settings: {
          appearance: parsed.settings?.appearance || "light",
          sidebarCollapsed: parsed.settings?.sidebarCollapsed || false,
          dashboardLayout: normalizeDashboardLayout(parsed.settings?.dashboardLayout),
          deadlineWidget: normalizeDeadlineWidgetSettings(parsed.settings?.deadlineWidget),
        },
        seeds: { tasks: false, sessions: false, ...(parsed.seeds || {}) },
      };
    } catch {
      return {
        subjects: makeInitialSubjects(),
        tasks: [],
        studySessions: [],
        todayFocus: [],
        settings: {
          appearance: "light",
          sidebarCollapsed: false,
          dashboardLayout: [...DASHBOARD_WIDGET_IDS],
          deadlineWidget: normalizeDeadlineWidgetSettings(),
        },
        seeds: { tasks: false, sessions: false },
      };
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  return [data, setData];
}

function createLoggedOutData() {
  return {
    ...normalizeDefaultData(),
    settings: {
      ...normalizeDefaultData().settings,
      appearance: "light",
      sidebarCollapsed: false,
      dashboardLayout: [...DASHBOARD_WIDGET_IDS],
      deadlineWidget: normalizeDeadlineWidgetSettings(),
    },
  };
}

function StatCard({ title, value, sub, icon: Icon, darkMode }) {
  return (
    <Card className={cn("rounded-2xl border shadow-sm", getSurfaceClass(darkMode))}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className={cn("text-sm", darkMode ? "text-slate-400" : "text-slate-500")}>{title}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
            {sub ? <p className={cn("mt-1 text-xs", darkMode ? "text-slate-400" : "text-slate-500")}>{sub}</p> : null}
          </div>
          <div className={cn("rounded-2xl p-3", darkMode ? "bg-slate-800 text-slate-200" : "bg-slate-100 text-slate-700")}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StudyOverviewStrip({ studyStats, darkMode }) {
  const overview = [
    { label: "Heute", value: studyStats.todayMinutes, target: 180 },
    { label: "Woche", value: studyStats.weekMinutes, target: 900 },
    { label: "Monat", value: studyStats.monthMinutes, target: 2400 },
  ];

  return (
    <div className={cn("rounded-[1.2rem] border px-4 py-3", darkMode ? "border-slate-800 bg-[#1b2237] text-slate-100" : "border-slate-200 bg-slate-50 text-slate-900")}>
      <div className="grid gap-4 sm:grid-cols-3">
        {overview.map((item) => {
          const progress = Math.min(100, Math.round((item.value / item.target) * 100));
          return (
            <div key={item.label}>
              <p className={cn("text-sm font-medium", darkMode ? "text-slate-300" : "text-slate-600")}>{item.label}</p>
              <div className="mt-1 flex items-center gap-2">
                <CalendarClock className={cn("h-3.5 w-3.5", darkMode ? "text-slate-400" : "text-slate-500")} />
                <span className="text-xl font-bold tracking-tight">{formatMinutesCompact(item.value)}</span>
              </div>
              <div className={cn("mt-2 h-2.5 overflow-hidden rounded-full", darkMode ? "bg-slate-700/70" : "bg-slate-200")}>
                <div
                  className={cn("h-full rounded-full transition-all", item.value ? "bg-emerald-500" : darkMode ? "bg-slate-600" : "bg-slate-300")}
                  style={{ width: `${Math.max(item.value ? 10 : 0, progress)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4">
        <div className="mb-3 flex items-center gap-2">
          <div className={cn("h-0 w-0 border-l-[4px] border-r-[4px] border-t-[6px] border-l-transparent border-r-transparent", darkMode ? "border-t-slate-400" : "border-t-slate-500")} />
          <h3 className={cn("text-lg font-semibold tracking-tight", darkMode ? "text-white" : "text-slate-900")}>Erfolgsserie</h3>
        </div>
        <div className="grid grid-cols-7 gap-2 text-center">
          {studyStats.streakDays.map((day) => (
            <div key={day.key} className="grid gap-2">
              <span className={cn("text-sm font-medium", darkMode ? "text-slate-300" : "text-slate-600")}>{day.label}</span>
              <div className={cn(
                "mx-auto flex h-9 w-9 items-center justify-center rounded-full ring-1",
                day.status === "done" && "bg-emerald-500/20 text-emerald-300 ring-emerald-500/40",
                day.status === "missed" && "bg-red-500/20 text-red-300 ring-red-500/40",
                day.status === "open" && "bg-blue-500/20 text-blue-300 ring-blue-500/40",
                day.status === "upcoming" && (darkMode ? "bg-slate-500/20 text-slate-300 ring-slate-500/30" : "bg-slate-200 text-slate-600 ring-slate-300")
              )}>
                {day.status === "done" ? <Check className="h-4 w-4" /> : day.status === "missed" ? <X className="h-4 w-4" /> : <HelpCircle className="h-4 w-4" />}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ChartValueLabel({ x, y, value, color, strokeColor = "#1e212b" }) {
  if (typeof x !== "number" || typeof y !== "number" || value === undefined || value === null) return null;
  const label = value === 0 ? "-" : formatDecimalHoursAsHourComma(value, false);
  const width = value === 0 ? 26 : Math.max(32, label.length * 7 + 10);
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={-width / 2} y={-24} width={width} height={20} fill={color} rx={4} stroke={strokeColor} strokeWidth={2} />
      <text x={0} y={-10} fill="#fff" fontSize={12} fontWeight="700" textAnchor="middle">{label}</text>
    </g>
  );
}

function BarTopLabel({ x, y, width, value, darkMode }) {
  if (typeof x !== "number" || typeof y !== "number" || typeof width !== "number" || value === undefined || value === null) return null;
  const minutes = Math.round(Number(value) * 60);
  return (
    <text
      x={x + width / 2}
      y={Math.max(12, y - 8)}
      textAnchor="middle"
      fill={darkMode ? "#e2e8f0" : "#334155"}
      fontSize={11}
      fontWeight={600}
    >
      {formatMinutes(minutes)}
    </text>
  );
}

function LinePointLabel({ x, y, value, darkMode }) {
  if (typeof x !== "number" || typeof y !== "number" || value === undefined || value === null) return null;
  const minutes = Math.round(Number(value) * 60);
  const label = formatMinutes(minutes);
  return (
    <text
      x={x}
      y={Math.max(12, y - 12)}
      textAnchor="middle"
      fill={darkMode ? "#e2e8f0" : "#334155"}
      fontSize={11}
      fontWeight={600}
    >
      {label}
    </text>
  );
}

function getSubjectAxisLines(label) {
  const map = {
    "Mathematik 2": ["Mathematik", "2"],
    "Betriebssysteme": ["Betriebssysteme"],
    "Diskrete Mathematik": ["Diskrete", "Mathematik"],
    "Labormathematik": ["Labor", "Mathematik"],
    "Laborstatistik": ["Labor", "Statistik"],
    "Objektorientierte Systeme": ["Objektorientierte", "Systeme"],
    "Offene Sicherheit": ["Offene", "Sicherheit"],
    "Statistik": ["Statistik"],
  };
  return map[label] || [label];
}

function SubjectAxisTick({ x, y, payload, darkMode }) {
  if (typeof x !== "number" || typeof y !== "number" || !payload?.value) return null;
  const lines = getSubjectAxisLines(payload.value);
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        textAnchor="middle"
        fill={darkMode ? "#475569" : "#475569"}
        fontSize={10}
        fontWeight={500}
      >
        {lines.map((line, index) => (
          <tspan key={`${payload.value}-${index}`} x={0} dy={index === 0 ? 14 : 11}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}

function SubjectHoursChart({ data, darkMode, onEditSubject, onDeleteSubject }) {
  const [activeTab, setActiveTab] = useState("diagramm");

  const shortNameMap = {
    "Mathematik 2": "Mathe 2",
    Betriebssysteme: "Betriebssyst.",
    "Diskrete Mathematik": "Diskrete Mathe",
    Labormathematik: "Labor Mathe",
    Laborstatistik: "Labor Statistik",
    "Objektorientierte Systeme": "OOS",
    "Offene Sicherheit": "Offene Sich.",
    Statistik: "Statistik",
  };

  const chartData = useMemo(
    () =>
      data.map((subject) => ({
        ...subject,
        shortName: shortNameMap[subject.name] || subject.name,
        learnedHours: subject.hours,
      })),
    [data]
  );

  const chartBg = darkMode ? "border-slate-800 bg-[#1e212b] text-slate-200" : "border-slate-200 bg-slate-50 text-slate-900";
  const tabBg = darkMode ? "bg-[#2a2d39]" : "bg-slate-200";
  const activeTabBg = darkMode ? "bg-[#1e212b] text-white" : "bg-white text-slate-900";
  const inactiveTabText = darkMode ? "text-slate-400 hover:text-slate-200" : "text-slate-600 hover:text-slate-900";
  const xTickColor = darkMode ? "#e2e8f0" : "#334155";
  const gridStroke = darkMode ? "#334155" : "#cbd5e1";
  const lineColor = darkMode ? "#3b82f6" : "#2563eb";
  const gradientId = darkMode ? "subjectHoursFillDark" : "subjectHoursFillLight";
  const labelStroke = darkMode ? "#1e212b" : "#ffffff";

  return (
    <div className={cn("rounded-[1.35rem] border px-3 py-4 shadow-lg", chartBg)}>
      <div className="mb-4 flex items-center gap-2">
        <h3 className={cn("flex items-center gap-2 text-xl font-bold", darkMode ? "text-white" : "text-slate-900")}>
          Fächer <span className="text-base font-normal text-slate-500">• {chartData.length}</span>
        </h3>
      </div>

      <div className={cn("mx-auto mb-5 flex max-w-sm rounded-xl p-1", tabBg)}>
        {["diagramm", "tabelle"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn("flex-1 rounded-lg py-2 text-xs font-bold transition-all", activeTab === tab ? activeTabBg : inactiveTabText)}
          >
            {tab === "diagramm" ? "Diagramm" : "Tabelle"}
          </button>
        ))}
      </div>

      {activeTab === "diagramm" ? (
        <div className="relative -mx-3 h-[360px] w-[calc(100%+24px)] px-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 28, right: 8, left: 8, bottom: 88 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={lineColor} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={lineColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} opacity={0.24} />
              <XAxis
                dataKey="shortName"
                axisLine={false}
                tickLine={false}
                tick={{ fill: xTickColor, fontSize: 10, fontWeight: 500 }}
                dy={10}
                angle={-24}
                textAnchor="end"
                height={74}
                interval={0}
                padding={{ left: 14, right: 14 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                width={44}
                tick={{ fill: xTickColor, fontSize: 10 }}
                tickFormatter={(value) => formatDecimalHoursAsHourComma(value, false)}
                domain={[0, "dataMax + 4"]}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: darkMode ? "1px solid #334155" : "1px solid #cbd5e1",
                  backgroundColor: darkMode ? "#0f172a" : "#ffffff",
                  color: darkMode ? "#f8fafc" : "#0f172a",
                  fontSize: 12,
                }}
                formatter={(value, _name, item) => [formatDecimalHoursAsHourComma(value), item?.payload?.name || "Lernzeit"]}
                labelFormatter={(label, payload) => payload?.[0]?.payload?.name || label}
              />
              <Area
                type="monotone"
                dataKey="learnedHours"
                stroke={lineColor}
                strokeWidth={2.5}
                fillOpacity={1}
                fill={`url(#${gradientId})`}
                activeDot={{ r: 5, fill: lineColor, stroke: darkMode ? "#ffffff" : "#0f172a", strokeWidth: 2 }}
                label={(props) => <ChartValueLabel {...props} color={lineColor} strokeColor={labelStroke} />}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-700/30">
          <div className={cn("grid grid-cols-[minmax(0,1fr)_132px_40px] items-center gap-3 border-b px-3 py-2.5 text-xs font-semibold", darkMode ? "border-slate-700 bg-slate-800/60 text-slate-300" : "border-slate-200 bg-slate-100 text-slate-700")}>
            <div>Fach</div>
            <div className="text-right">Dauer</div>
            <div className="text-right" />
          </div>
          <div className={cn("divide-y", darkMode ? "divide-slate-800" : "divide-slate-200")}>
            {chartData.map((subject) => (
              <div
                key={subject.id}
                className={cn("grid grid-cols-[minmax(0,1fr)_132px_40px] items-center gap-3 px-3 py-3", darkMode ? "bg-slate-900/25" : "bg-white")}
              >
                <div className="min-w-0">
                  <div className="inline-flex max-w-full items-center rounded-full px-2.5 py-1.5 text-sm font-semibold text-slate-900" style={{ backgroundColor: subject.color }}>
                    <span className="whitespace-normal break-words leading-tight">{subject.name}</span>
                  </div>
                </div>
                <div className={cn("text-right text-sm font-semibold tabular-nums", darkMode ? "text-white" : "text-slate-900")}>
                  {formatMinutesAsHourComma(subject.minutes)} / {subject.targetHours},00h
                </div>
                <div className="flex justify-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => onEditSubject?.(subject)}>
                        Fach bearbeiten
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEditSubject?.(subject)}>
                        Zielstunden anpassen
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-red-500 focus:text-red-500" onClick={() => onDeleteSubject?.(subject.id)}>
                        Fach löschen
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ManualStudyDialog({
  open,
  onOpenChange,
  subjects,
  darkMode,
  selectedSubjectId,
  onSelectedSubjectChange,
  onSaveEntry,
  initialValue,
  title = "Einheit anlegen",
  submitLabel = "Speichern",
}) {
  const [entryDate, setEntryDate] = useState(formatDateInput(new Date()));
  const [startTime, setStartTime] = useState(new Date().toTimeString().slice(0, 5));
  const [endTime, setEndTime] = useState(new Date().toTimeString().slice(0, 5));
  const [breakMinutes, setBreakMinutes] = useState("0");
  const [activity, setActivity] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    const seed = initialValue || {};
    const now = new Date();
    setEntryDate(seed.date || formatDateInput(now));
    setStartTime(seed.startTime || toTimeInputValue(now));
    setEndTime(seed.endTime || toTimeInputValue(now));
    setBreakMinutes(seed.breakMinutes ?? "0");
    setActivity(seed.activity || "");
    setNote(seed.note || "");
  }, [open, initialValue]);

  function shiftDate(days) {
    const d = new Date(entryDate);
    d.setDate(d.getDate() + days);
    setEntryDate(formatDateInput(d));
  }

  function getDurationMinutes() {
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    let total = eh * 60 + em - (sh * 60 + sm);
    if (total < 0) total += 24 * 60;
    total -= Number(breakMinutes || 0);
    return Math.max(0, total);
  }

  const durationMinutes = getDurationMinutes();
  const durationPercent = Math.min(100, (durationMinutes / 240) * 100);
  const dateLabel = new Date(entryDate).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    weekday: "short",
  }).replace(",", " •");
  const fieldClass = darkMode ? "bg-[#2a3554] text-slate-50" : "bg-slate-100 text-slate-900";
  const placeholderClass = darkMode ? "placeholder:text-slate-400" : "placeholder:text-slate-500";
  const floatingClass = darkMode ? "border-slate-800 bg-[#1b2237] text-slate-50" : "border-slate-200 bg-white text-slate-900";

  function saveEntry() {
    if (!selectedSubjectId || durationMinutes <= 0) return;
    onSaveEntry({
      id: initialValue?.id || crypto.randomUUID(),
      subjectId: selectedSubjectId,
      durationMinutes,
      createdAt: new Date(`${entryDate}T${endTime}:00`).toISOString(),
      source: initialValue?.source || "manual-entry",
      note: [activity, note].filter(Boolean).join(" • ") || "Lerneinheit manuell angelegt",
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-w-2xl overflow-hidden rounded-[1.5rem] border p-0", floatingClass)}>
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="p-5 md:p-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-2xl font-semibold tracking-tight">{title}</h3>
            <button type="button" onClick={() => onOpenChange(false)} className="text-red-500 hover:text-red-400">Schließen</button>
          </div>

          <div className="mt-5 grid gap-4">
            <div className={cn("rounded-[1.1rem] p-3.5", fieldClass)}>
              <div className={cn("mb-2 text-sm font-semibold", darkMode ? "text-white" : "text-slate-700")}>Datum *</div>
              <div className="flex items-center justify-between gap-3">
                <div className="text-lg font-medium">{dateLabel}</div>
                <div className="flex gap-1">
                  <Button type="button" size="icon" variant="ghost" onClick={() => shiftDate(-1)} className="h-9 w-9 rounded-full"><ChevronLeft className="h-5 w-5" /></Button>
                  <Button type="button" size="icon" variant="ghost" onClick={() => shiftDate(1)} className="h-9 w-9 rounded-full"><ChevronRight className="h-5 w-5" /></Button>
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className={cn("rounded-[1.1rem] p-3.5", fieldClass)}><Label className={darkMode ? "text-white" : "text-slate-700"}>Start *</Label><TimeInput24 value={startTime} onChange={setStartTime} className="mt-2 h-auto border-0 bg-transparent px-0 text-2xl font-medium shadow-none focus-visible:ring-0" /></div>
              <div className={cn("rounded-[1.1rem] p-3.5", fieldClass)}><Label className={darkMode ? "text-white" : "text-slate-700"}>Ende *</Label><TimeInput24 value={endTime} onChange={setEndTime} className="mt-2 h-auto border-0 bg-transparent px-0 text-2xl font-medium shadow-none focus-visible:ring-0" /></div>
              <div className={cn("rounded-[1.1rem] p-3.5", fieldClass)}><Label className={darkMode ? "text-white" : "text-slate-700"}>Pause (m)</Label><Input type="number" min="0" value={breakMinutes} onChange={(e) => setBreakMinutes(e.target.value)} className="mt-2 h-auto border-0 bg-transparent px-0 text-2xl font-medium shadow-none focus-visible:ring-0" /></div>
            </div>

            <div className="text-sm font-medium">
              Dauer: {durationMinutes > 0 ? formatMinutes(durationMinutes) : "–"}
              <div className={cn("mt-2 h-2.5 rounded-full", darkMode ? "bg-[#2a3554]" : "bg-slate-200")}>
                <div className="h-2.5 rounded-full bg-slate-400/80 transition-all" style={{ width: `${durationPercent}%` }} />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className={cn("rounded-[1.1rem] p-3.5", fieldClass)}>
                <Label className={darkMode ? "text-white" : "text-slate-700"}>Fach *</Label>
                <div className="mt-2 flex items-center gap-2">
                  <Select value={selectedSubjectId} onValueChange={onSelectedSubjectChange}>
                    <SelectTrigger className="h-auto border-0 bg-transparent px-0 text-lg font-medium shadow-none focus:ring-0 focus:ring-offset-0"><SelectValue placeholder="Fach wählen" /></SelectTrigger>
                    <SelectContent>{subjects.map((subject) => <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>)}</SelectContent>
                  </Select>
                  {selectedSubjectId ? <button type="button" onClick={() => onSelectedSubjectChange("")} className="grid h-7 w-7 place-items-center rounded-full bg-slate-600/70 text-slate-200 transition hover:bg-slate-500"><X className="h-4 w-4" /></button> : null}
                </div>
              </div>
              <div className={cn("rounded-[1.1rem] p-3.5", fieldClass)}><Label className={darkMode ? "text-white" : "text-slate-700"}>Aktivität</Label><Input value={activity} onChange={(e) => setActivity(e.target.value)} placeholder="z. B. Wiederholung" className={cn("mt-2 h-auto border-0 bg-transparent px-0 text-lg font-medium shadow-none focus-visible:ring-0", placeholderClass)} /></div>
            </div>

            <div className={cn("rounded-[1.1rem] p-3.5", fieldClass)}><Label className={darkMode ? "text-white" : "text-slate-700"}>Notiz</Label><Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Kurze Notiz" className={cn("mt-2 min-h-[100px] resize-none border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0", placeholderClass)} /></div>

            <div className="grid gap-3 md:grid-cols-2">
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} className="h-11 rounded-full bg-slate-600 text-base font-semibold text-white hover:bg-slate-500">Abbrechen</Button>
              <Button type="button" onClick={saveEntry} className="h-11 rounded-full bg-emerald-600 text-base font-semibold text-white hover:bg-emerald-500"><Check className="mr-2 h-5 w-5" />{submitLabel}</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DashboardQuickActions({ subjects, onSaveSession, darkMode, userId }) {
  const storedTimer = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("study_planner_timer_state") || "{}");
    } catch {
      return {};
    }
  }, []);

  const [manualPickerOpen, setManualPickerOpen] = useState(false);
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [manualSeed, setManualSeed] = useState(null);
  const [timerOpen, setTimerOpen] = useState(false);
  const [expireDialogOpen, setExpireDialogOpen] = useState(false);
  const [manualSubjectId, setManualSubjectId] = useState(storedTimer.manualSubjectId || subjects[0]?.id || "");
  const [timerSubjectId, setTimerSubjectId] = useState(storedTimer.timerSubjectId || subjects[0]?.id || "");
  const [timerMode, setTimerMode] = useState(storedTimer.timerMode || "stopwatch");
  const [timerPreset, setTimerPreset] = useState(storedTimer.timerPreset || 90);
  const [activeTimer, setActiveTimer] = useState(null);
  const [tickNowMs, setTickNowMs] = useState(Date.now());
  const [timerBusy, setTimerBusy] = useState(false);
  const intervalRef = useRef(null);
  const floatingClass = darkMode ? "border-slate-800 bg-[#1b2237] text-slate-50" : "border-slate-200 bg-white text-slate-900";

  useEffect(() => {
    if (!manualSubjectId && subjects[0]?.id) setManualSubjectId(subjects[0].id);
    if (!timerSubjectId && subjects[0]?.id) setTimerSubjectId(subjects[0].id);
  }, [subjects, manualSubjectId, timerSubjectId]);

  useEffect(() => {
    localStorage.setItem("study_planner_timer_state", JSON.stringify({
      manualSubjectId,
      timerSubjectId,
      timerMode,
      timerPreset,
    }));
  }, [manualSubjectId, timerSubjectId, timerMode, timerPreset]);

  useEffect(() => {
    if (!activeTimer || activeTimer.status !== "running") {
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

  function getDisplaySeconds(session) {
    const elapsed = getElapsedSeconds(session, tickNowMs);
    if (session?.mode === "pomodoro") {
      const presetSeconds = Math.max(1, Number(session.presetMinutes || timerPreset || 90)) * 60;
      return Math.max(0, presetSeconds - elapsed);
    }
    return elapsed;
  }

  function openManualWithSeed(subjectId, seed = null) {
    setManualSubjectId(subjectId || subjects[0]?.id || "");
    setManualSeed(seed);
    setManualDialogOpen(true);
  }

  async function handleTimerSubjectPick(subjectId) {
    setTimerSubjectId(subjectId);
    setTimerOpen(false);

    if (!userId || !subjectId) return;
    if (activeTimer) return;

    try {
      setTimerBusy(true);
      const created = await startTimerSession(userId, subjectId, {
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
      if (updated) {
        setActiveTimer(updated);
      }
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
    const elapsedSeconds = getElapsedSeconds(activeTimer, Date.now());
    const durationMinutes = Math.max(1, Math.round(elapsedSeconds / 60));
    const start = new Date(now.getTime() - durationMinutes * 60000);
    openManualWithSeed(activeTimer.subjectId, {
      date: formatDateInput(now),
      startTime: toTimeInputValue(start),
      endTime: toTimeInputValue(now),
      breakMinutes: "0",
      activity: activeTimer.mode === "pomodoro" ? "Pomodoro" : "Stoppuhr",
      note: activeTimer.mode === "pomodoro"
        ? `Pomodoro ${activeTimer.presetMinutes || timerPreset} Minuten`
        : "Stoppuhr-Sitzung",
      source: activeTimer.mode || "stopwatch",
    });
  }

  async function handleExpireSave() {
    if (!activeTimer || !userId) return;
    try {
      setTimerBusy(true);
      const elapsedSeconds = getElapsedSeconds(activeTimer, Date.now());
      const durationMinutes = Math.max(1, Math.round(elapsedSeconds / 60));

      if (elapsedSeconds > 0 && activeTimer.subjectId) {
        onSaveSession({
          id: crypto.randomUUID(),
          subjectId: activeTimer.subjectId,
          durationMinutes,
          createdAt: new Date().toISOString(),
          source: activeTimer.mode || "stopwatch",
          note: activeTimer.mode === "pomodoro"
            ? `Pomodoro ${activeTimer.presetMinutes || timerPreset} Minuten`
            : "Stoppuhr-Sitzung",
        });
      }

      await finishTimerSession(userId, activeTimer.id);
      setActiveTimer(null);
      setExpireDialogOpen(false);
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
      await cancelTimerSession(userId, activeTimer.id);
      setActiveTimer(null);
      setExpireDialogOpen(false);
    } catch (error) {
      console.error("Cancel timer failed:", error);
    } finally {
      setTimerBusy(false);
    }
  }

  const selectedSubjectId = activeTimer?.subjectId || timerSubjectId;
  const timerSubject = subjects.find((subject) => subject.id === selectedSubjectId);
  const displaySeconds = activeTimer ? getDisplaySeconds(activeTimer) : 0;
  const timerDisplay = `${String(Math.floor(displaySeconds / 3600)).padStart(2, "0")}:${String(Math.floor((displaySeconds % 3600) / 60)).padStart(2, "0")}:${String(displaySeconds % 60).padStart(2, "0")}`;
  const isRunning = activeTimer?.status === "running";
  const isPaused = activeTimer?.status === "paused";

  return (
    <>
      <div className="relative flex flex-row flex-nowrap gap-3">
        <div className="relative">
          <Button type="button" onClick={() => { setManualPickerOpen((prev) => !prev); setTimerOpen(false); }} className="shrink-0 rounded-full bg-white px-5 text-slate-950 hover:bg-slate-100">
            <Plus className="mr-2 h-4 w-4" />Lerneinheit anlegen<ChevronDown className="ml-2 h-4 w-4" />
          </Button>
          {manualPickerOpen ? (
            <div className={cn("absolute right-0 top-full z-50 mt-3 w-[300px] rounded-[1.2rem] border p-3 shadow-2xl", floatingClass)}>
              <div className="mb-2 flex items-center justify-between"><p className="text-sm font-medium">Fach auswählen</p><Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={() => setManualPickerOpen(false)}><X className="h-4 w-4" /></Button></div>
              <div className="grid gap-2">
                {subjects.map((subject) => (
                  <button key={subject.id} type="button" onClick={() => { setManualPickerOpen(false); openManualWithSeed(subject.id); }} className="flex items-center justify-between rounded-full px-4 py-2.5 text-left text-sm font-semibold text-slate-950 transition hover:opacity-90" style={{ backgroundColor: subject.color }}>
                    <span>{subject.name}</span><ChevronRight className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="relative">
          <Button type="button" onClick={() => { setTimerOpen((prev) => !prev); setManualPickerOpen(false); }} className="shrink-0 rounded-full bg-blue-600 px-5 text-white hover:bg-blue-500">
            <Play className="mr-2 h-4 w-4" />Timer<ChevronDown className="ml-2 h-4 w-4" />
          </Button>
          {timerOpen ? (
            <div className={cn("absolute right-0 top-full z-50 mt-3 w-[360px] rounded-[1.2rem] border p-4 shadow-2xl", floatingClass)}>
              <Tabs value={timerMode} onValueChange={setTimerMode}>
                <TabsList className={cn("grid w-full grid-cols-2 rounded-2xl", darkMode ? "bg-[#2a3554]" : "bg-slate-200")}>
                  <TabsTrigger value="stopwatch">Stoppuhr</TabsTrigger>
                  <TabsTrigger value="pomodoro">Pomodoro</TabsTrigger>
                </TabsList>

                <div className="mt-4 grid gap-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{timerMode === "pomodoro" ? `${timerPreset} Min.` : "Stoppuhr"}</span>
                    {timerSubject ? <span className="rounded-full px-3 py-1 text-xs font-semibold text-slate-950" style={{ backgroundColor: timerSubject.color }}>{timerSubject.name}</span> : null}
                  </div>

                  <TabsContent value="pomodoro" className="m-0">
                    <div className="grid grid-cols-6 gap-2">
                      {[25, 45, 60, 90, 120].map((preset) => (
                        <Button key={preset} type="button" variant={timerPreset === preset ? "default" : "secondary"} className={cn("rounded-xl", timerPreset === preset ? "bg-blue-600 hover:bg-blue-500" : "")} onClick={() => setTimerPreset(preset)}>{preset}</Button>
                      ))}
                      <div className={cn("flex items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold", darkMode ? "bg-slate-100 text-slate-700" : "bg-slate-200 text-slate-700")}>
                        <button type="button" onClick={() => setTimerPreset((prev) => Math.max(5, prev - 5))}>-</button>
                        <span>{timerPreset}</span>
                        <button type="button" onClick={() => setTimerPreset((prev) => prev + 5)}>+</button>
                      </div>
                    </div>
                  </TabsContent>

                  <div className="grid gap-2 max-h-[250px] overflow-y-auto pr-1">
                    {subjects.map((subject) => {
                      const isSelected = selectedSubjectId === subject.id;
                      return (
                        <button key={subject.id} type="button" onClick={() => handleTimerSubjectPick(subject.id)} className={cn("flex items-center justify-between rounded-full px-4 py-2.5 text-left text-sm font-semibold text-slate-950 transition", isSelected ? "ring-2 ring-white/80 ring-offset-2 ring-offset-transparent opacity-100" : "opacity-90")} style={{ backgroundColor: subject.color }}>
                          <span>{subject.name}</span>
                          {isSelected ? <Check className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                      );
                    })}
                  </div>

                  <div className={cn("rounded-xl px-3 py-2 text-xs", darkMode ? "bg-slate-800/70 text-slate-300" : "bg-slate-100 text-slate-600")}>
                    Auswahl eines Fachs startet die Stoppuhr automatisch.
                  </div>
                </div>
              </Tabs>
            </div>
          ) : null}
        </div>
      </div>

      {activeTimer ? (
        <div className="fixed left-1/2 top-4 z-[80] -translate-x-1/2">
          <div className={cn("flex items-center gap-3 rounded-full border px-4 py-3 shadow-2xl", floatingClass)}>
            {isPaused ? (
              <button type="button" onClick={resumeQuickTimer} className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-500" disabled={timerBusy}>
                <Play className="h-4 w-4" />
              </button>
            ) : (
              <button type="button" onClick={pauseQuickTimer} className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-500" disabled={timerBusy}>
                <Pause className="h-4 w-4" />
              </button>
            )}
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: isPaused ? "#f59e0b" : "#10b981" }} />
              <span className="font-semibold">{timerSubject?.name || "Fach"}</span>
              <span className="font-mono text-lg font-semibold">{timerDisplay}</span>
            </div>
            <button type="button" onClick={openManualFromActiveTimer} className={cn("transition", darkMode ? "text-slate-400 hover:text-slate-200" : "text-slate-600 hover:text-slate-900")}>
              <Maximize2 className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setExpireDialogOpen(true)} className={cn("transition", darkMode ? "text-slate-400 hover:text-slate-200" : "text-slate-600 hover:text-slate-900")}>
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}

      <Dialog open={expireDialogOpen} onOpenChange={setExpireDialogOpen}>
        <DialogContent className={cn("max-w-md rounded-2xl", darkMode ? "bg-[#1b2237] border-slate-800" : "bg-white border-slate-200")}>
          <DialogHeader>
            <DialogTitle className={darkMode ? "text-white" : "text-slate-900"}>Timer beenden</DialogTitle>
          </DialogHeader>
          <div className={cn("space-y-3 py-2 text-sm", darkMode ? "text-slate-300" : "text-slate-600")}>
            <p>Willst du die laufende Zeit speichern oder verwerfen?</p>
            <p className={darkMode ? "text-slate-100" : "text-slate-900"}>Aktuelle Dauer: <span className="font-mono font-semibold">{timerDisplay}</span></p>
          </div>
          <div className="flex gap-2 justify-end pt-4 border-t" style={{ borderColor: darkMode ? "#334155" : "#e2e8f0" }}>
            <Button variant="outline" onClick={() => setExpireDialogOpen(false)} className="rounded-xl">Zurück</Button>
            <Button variant="destructive" onClick={handleExpireDiscard} className="rounded-xl" disabled={timerBusy}>Verwerfen</Button>
            <Button onClick={handleExpireSave} className="rounded-xl bg-blue-600 hover:bg-blue-500" disabled={timerBusy}>Speichern</Button>
          </div>
        </DialogContent>
      </Dialog>

      <ManualStudyDialog
        open={manualDialogOpen}
        onOpenChange={setManualDialogOpen}
        subjects={subjects}
        darkMode={darkMode}
        selectedSubjectId={manualSubjectId}
        onSelectedSubjectChange={setManualSubjectId}
        onSaveEntry={onSaveSession}
        initialValue={manualSeed}
        title="Lerneinheit anlegen"
        submitLabel="Speichern"
      />
    </>
  );
}

function SubjectForm({ onSave, initialValue, onDone, semesters = [] }) {
  const [form, setForm] = useState(initialValue || { name: "", color: "#3b82f6", description: "", semesterId: semesters[0]?.id || "", goal: "", targetHours: 30 });

  useEffect(() => {
    if (!semesters.length) return;
    setForm((prev) => ({
      ...prev,
      semesterId: prev.semesterId || semesters[0].id,
    }));
  }, [semesters]);

  return (
    <div className="grid gap-4">
      <div className="grid gap-2"><Label>Fachname</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-4"><div className="grid gap-2"><Label>Farbe</Label><input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="h-10 w-full rounded-md border bg-transparent" /></div><div className="grid gap-2"><Label>Zielstunden</Label><Input type="number" value={form.targetHours} onChange={(e) => setForm({ ...form, targetHours: Number(e.target.value) || 0 })} /></div></div>
      <div className="grid gap-2"><Label>Beschreibung</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
      <div className="grid gap-2"><Label>Semester</Label><Select value={form.semesterId} onValueChange={(value) => setForm({ ...form, semesterId: value })}><SelectTrigger><SelectValue placeholder="Semester wählen" /></SelectTrigger><SelectContent>{semesters.map((semester) => <SelectItem key={semester.id} value={semester.id}>{semester.name}</SelectItem>)}</SelectContent></Select></div>
      <div className="grid gap-2"><Label>Ziel / Notiz</Label><Textarea value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} /></div>
      <div className="flex justify-end gap-2">{onDone ? <Button variant="outline" onClick={onDone}>Abbrechen</Button> : null}<Button onClick={() => { if (!form.name.trim() || !form.semesterId) return; onSave({ ...initialValue, ...form }); onDone?.(); }}>Speichern</Button></div>
    </div>
  );
}

function SemesterForm({ onSave, initialValue, onDone }) {
  const [form, setForm] = useState(initialValue || { name: "", startDate: "", endDate: "" });

  useEffect(() => {
    if (!initialValue) return;
    setForm({
      name: initialValue.name || "",
      startDate: initialValue.startDate || "",
      endDate: initialValue.endDate || "",
    });
  }, [initialValue]);

  return (
    <div className="grid gap-4">
      <div className="grid gap-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="z. B. 2. Semester" /></div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="grid gap-2"><Label>Startdatum</Label><Input type="date" value={form.startDate} onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))} /></div>
        <div className="grid gap-2"><Label>Enddatum</Label><Input type="date" value={form.endDate} onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))} /></div>
      </div>
      <div className="flex justify-end gap-2">{onDone ? <Button variant="outline" onClick={onDone}>Abbrechen</Button> : null}<Button onClick={() => { if (!form.name.trim()) return; onSave({ ...initialValue, ...form }); onDone?.(); }}>Speichern</Button></div>
    </div>
  );
}

function TaskForm({ subjects, onSave, initialValue, onDone }) {
  const [form, setForm] = useState(initialValue || { title: "", description: "", subjectId: subjects[0]?.id || "", createdAt: formatDateInput(new Date()), dueDate: "", acceptanceDate: "", priority: "mittel", status: "offen", flaggedToday: false, urgent: false, recurringPattern: "none" });
  return (
    <div className="grid gap-4">
      <div className="grid gap-2"><Label>Titel</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
      <div className="grid gap-2"><Label>Beschreibung / Notizen</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="grid gap-2"><Label>Fach</Label><Select value={form.subjectId} onValueChange={(value) => setForm({ ...form, subjectId: value })}><SelectTrigger><SelectValue placeholder="Fach wählen" /></SelectTrigger><SelectContent>{subjects.map((subject) => <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="grid gap-2"><Label>Priorität</Label><Select value={form.priority} onValueChange={(value) => setForm({ ...form, priority: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="niedrig">Niedrig</SelectItem><SelectItem value="mittel">Mittel</SelectItem><SelectItem value="hoch">Hoch</SelectItem></SelectContent></Select></div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="grid gap-2"><Label>Erstellungsdatum</Label><Input type="date" value={form.createdAt} onChange={(e) => setForm({ ...form, createdAt: e.target.value })} /></div>
        <div className="grid gap-2"><Label>Abgabe</Label><Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>
        <div className="grid gap-2"><Label>Abnahme</Label><Input type="date" value={form.acceptanceDate} onChange={(e) => setForm({ ...form, acceptanceDate: e.target.value })} /></div>
        <div className="grid gap-2"><Label>Status</Label><Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="offen">Offen</SelectItem><SelectItem value="in Bearbeitung">In Bearbeitung</SelectItem><SelectItem value="erledigt">Erledigt</SelectItem></SelectContent></Select></div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <label className="flex items-center justify-between rounded-xl border p-3"><span className="text-sm">Heute lernen</span><Switch checked={form.flaggedToday} onCheckedChange={(checked) => setForm({ ...form, flaggedToday: checked })} /></label>
        <label className="flex items-center justify-between rounded-xl border p-3"><span className="text-sm">Dringend markieren</span><Switch checked={form.urgent} onCheckedChange={(checked) => setForm({ ...form, urgent: checked })} /></label>
        <div className="grid gap-2"><Label>Wiederholen</Label><Select value={form.recurringPattern} onValueChange={(value) => setForm({ ...form, recurringPattern: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Nicht wiederholen</SelectItem><SelectItem value="weekly">Wöchentlich</SelectItem><SelectItem value="monthly">Monatlich</SelectItem></SelectContent></Select></div>
      </div>
      <div className="flex justify-end gap-2">{onDone ? <Button variant="outline" onClick={onDone}>Abbrechen</Button> : null}<Button onClick={() => { if (!form.title.trim() || !form.subjectId) return; onSave({ ...initialValue, ...form }); onDone?.(); }}>Speichern</Button></div>
    </div>
  );
}

function TaskCard({ task, subject, onToggleDone, onDelete, onEdit, darkMode }) {
  const checkboxBase = darkMode ? "border-slate-600 bg-slate-800 hover:bg-slate-700" : "border-slate-300 bg-white hover:bg-slate-100";
  return (
    <Card className={cn("rounded-2xl border shadow-sm", getSurfaceClass(darkMode), task.nextRelevantDate ? deadlineCardTone(task.nextRelevantDate, task.status) : "")}>
      <CardContent className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={onToggleDone} aria-label={task.status === "erledigt" ? "Als offen markieren" : "Als erledigt markieren"} className={cn("flex h-6 w-6 items-center justify-center rounded-md border transition-colors", task.status === "erledigt" ? "border-emerald-500 bg-emerald-500 text-white" : checkboxBase)}>{task.status === "erledigt" ? <Check className="h-4 w-4" /> : null}</button>
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: subject?.color || "#94a3b8" }} />
              <h3 className="text-base font-semibold">{task.title}</h3>
              {task.urgent ? <Badge variant="destructive">Dringend</Badge> : null}
              {task.flaggedToday ? <Badge variant="secondary">Heute lernen</Badge> : null}
            </div>
            <p className={cn("text-sm", darkMode ? "text-slate-300" : "text-slate-600")}>{task.description || "Keine Beschreibung"}</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{subject?.name || "Ohne Fach"}</Badge>
              <Badge variant={priorityTone(task.priority)}>{task.priority}</Badge>
              <Badge variant="outline">{task.status}</Badge>
              {task.nextRelevantDate ? <Badge className={cn("border-0", deadlineTone(task.nextRelevantDate, task.status))}>{deadlineLabel(task.nextRelevantDate, task.status)}</Badge> : null}
              {task.dueDate ? <Badge variant="outline">Abgabe: {formatDateDisplay(task.dueDate)}</Badge> : null}
              {task.acceptanceDate ? <Badge variant="outline">Abnahme: {formatDateDisplay(task.acceptanceDate)}</Badge> : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 self-end lg:self-start"><Button variant="outline" size="icon" onClick={onEdit}><Pencil className="h-4 w-4" /></Button><Button variant="outline" size="icon" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button></div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function StudyPlannerApp() {
  const [data, setData] = usePersistentState();
  const hasSupabaseEnv = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
  const [systemPrefersDark, setSystemPrefersDark] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
    const [session, setSession] = useState(null);
    const [isLoadingSession, setIsLoadingSession] = useState(true);
    const [isCloudHydrated, setIsCloudHydrated] = useState(false);
    const [cloudSyncError, setCloudSyncError] = useState(null);
    const [lastCloudLoadAt, setLastCloudLoadAt] = useState(null);
    const [lastCloudSaveAt, setLastCloudSaveAt] = useState(null);
    const cloudSyncTimeoutRef = useRef(null);
    const cloudHydrationRetryRef = useRef(null);
    const hasPendingCloudSaveRef = useRef(false);
  const [page, setPage] = useState("dashboard");
  const dashboardLayout = useMemo(() => normalizeDashboardLayout(data.settings?.dashboardLayout), [data.settings?.dashboardLayout]);
  const [isEditingDashboard, setIsEditingDashboard] = useState(false);

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setData((prev) => {
      const items = normalizeDashboardLayout(prev.settings?.dashboardLayout);
      const oldIndex = items.indexOf(active.id);
      const newIndex = items.indexOf(over.id);
      if (oldIndex < 0 || newIndex < 0) return prev;
      const newLayout = arrayMove(items, oldIndex, newIndex);
      return {
        ...prev,
        settings: {
          ...prev.settings,
          dashboardLayout: newLayout,
        },
      };
    });
  };

  const flushCloudSaveNow = async (snapshot = data) => {
    if (!session?.user?.id) return;

    writeUserCache(session.user.id, snapshot);

    if (!isCloudHydrated) return;

    if (cloudSyncTimeoutRef.current) {
      clearTimeout(cloudSyncTimeoutRef.current);
      cloudSyncTimeoutRef.current = null;
    }

    hasPendingCloudSaveRef.current = true;
    try {
      console.info("[app-sync] save:start", { userId: session.user.id });
      await saveUserPlannerData(session.user.id, snapshot);
      console.info("[app-sync] save:success", { userId: session.user.id });
      setCloudSyncError(null);
      setLastCloudSaveAt(new Date().toISOString());
    } catch (err) {
      console.error("Immediate cloud sync error:", err);
      setCloudSyncError(err?.message || "Cloud-Sync fehlgeschlagen");
    } finally {
      hasPendingCloudSaveRef.current = false;
    }
  };

  useEffect(() => {
    if (!session?.user?.id || !isCloudHydrated) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushCloudSaveNow(data);
      }
    };

    const handlePageHide = () => {
      flushCloudSaveNow(data);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [data, session?.user?.id, isCloudHydrated]);

  const [search, setSearch] = useState("");
  const [deadlineTab, setDeadlineTab] = useState("due");
  const [showArchive, setShowArchive] = useState(false);
  const [taskFilter, setTaskFilter] = useState({ subjectId: "all", priority: "all", status: "all", sort: "deadline" });
  const [subjectDialogOpen, setSubjectDialogOpen] = useState(false);
  const [semesterDialogOpen, setSemesterDialogOpen] = useState(false);
  const [semesters, setSemesters] = useState([]);
  const [editingSemester, setEditingSemester] = useState(null);
  const [selectedSemesterId, setSelectedSemesterId] = useState("");
  const [activeTaskTab, setActiveTaskTab] = useState("tasks");
  const [archivedSubjects, setArchivedSubjects] = useState([]);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  const [archiveCollapsed, setArchiveCollapsed] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [editingSession, setEditingSession] = useState(null);
  const [lastDeletedSession, setLastDeletedSession] = useState(null);
  const [todaySubjectDialogOpen, setTodaySubjectDialogOpen] = useState(false);
  const [todaySubjectDraft, setTodaySubjectDraft] = useState({ subjectId: "", note: "" });
  const [importError, setImportError] = useState(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const deadlineWidgetSettings = useMemo(
    () => normalizeDeadlineWidgetSettings(data.settings?.deadlineWidget),
    [data.settings?.deadlineWidget]
  );

  const updateDeadlineWidgetSettings = (patch) => {
    setData((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        deadlineWidget: normalizeDeadlineWidgetSettings({
          ...normalizeDeadlineWidgetSettings(prev.settings?.deadlineWidget),
          ...patch,
        }),
      },
    }));
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event) => setSystemPrefersDark(event.matches);
    setSystemPrefersDark(media.matches);
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    if (page !== "dashboard") return;
    if (deadlineWidgetSettings.activeFilter === deadlineWidgetSettings.defaultFilter) return;
    updateDeadlineWidgetSettings({ activeFilter: deadlineWidgetSettings.defaultFilter });
  }, [page, deadlineWidgetSettings.activeFilter, deadlineWidgetSettings.defaultFilter]);

  useEffect(() => {
    if (!session?.user?.id) {
      setIsCloudHydrated(false);
      setCloudSyncError(null);
      setSemesters([]);
      setArchivedSubjects([]);
      return;
    }

    let cancelled = false;

    const loadCloudDataForSession = async () => {
      try {
        console.info("[app-sync] load:start", { userId: session.user.id });
        const cloudData = await loadUserPlannerData(session.user.id);
        if (!cancelled && cloudData) {
          setData(cloudData);
          writeUserCache(session.user.id, cloudData);
        }
        if (!cancelled) {
          setIsCloudHydrated(true);
          setCloudSyncError(null);
          setLastCloudLoadAt(new Date().toISOString());
          console.info("[app-sync] load:success", { userId: session.user.id });
          setIsLoadingSession(false);
        }
      } catch (err) {
        console.error("Cloud data load after login failed:", err);
        if (!cancelled) {
          const cached = readUserCache(session.user.id);
          if (cached) {
            setData(cached);
            setIsCloudHydrated(true);
            setCloudSyncError("Cloud nicht erreichbar, lokale Kopie geladen.");
            setIsLoadingSession(false);
            setLastCloudLoadAt(new Date().toISOString());
            console.info("[app-sync] load:fallback-cache", { userId: session.user.id });
            return;
          }

          setIsLoadingSession(false);
          setIsCloudHydrated(false);
          setCloudSyncError(err?.message || "Cloud-Daten konnten nicht geladen werden");
          cloudHydrationRetryRef.current = window.setTimeout(() => {
            loadCloudDataForSession();
          }, 4000);
        }
      }
    };

    loadCloudDataForSession();

    return () => {
      cancelled = true;
      if (cloudHydrationRetryRef.current) {
        window.clearTimeout(cloudHydrationRetryRef.current);
        cloudHydrationRetryRef.current = null;
      }
    };
  }, [session?.user?.id, setData]);

  const syncSubjectsFromDatabase = async (userId) => {
    if (!userId) return;

    const [semesterRows, subjects] = await Promise.all([
      loadSemesters(userId),
      loadSubjects(userId),
    ]);

    const semestersById = Object.fromEntries(semesterRows.map((semester) => [semester.id, semester]));
    const mapRowToSubject = (row) => ({
      id: row.id,
      name: row.name,
      color: row.color || "#3b82f6",
      description: row.description || "",
      semesterId: row.semester_id || row.group_id || "",
      semester: semestersById[row.semester_id || row.group_id]?.name || "Ohne Semester",
      goal: row.goal || "",
      targetHours: Number(row.target_hours || 0),
      isArchived: Boolean(row.is_archived),
      createdAt: row.created_at,
    });

    const active = subjects.filter((row) => !row.is_archived).map(mapRowToSubject);
    const archived = subjects.filter((row) => row.is_archived).map(mapRowToSubject);

    const mappedSemesters = semesterRows.map((semester) => ({
      id: semester.id,
      name: semester.name,
      startDate: semester.start_date || "",
      endDate: semester.end_date || "",
      createdAt: semester.created_at,
    }));

    setSemesters(mappedSemesters);
    setArchivedSubjects(archived);
    setData((prev) => ({ ...prev, subjects: active }));
  };

  useEffect(() => {
    if (!session?.user?.id || !isCloudHydrated) return;
    syncSubjectsFromDatabase(session.user.id).catch((err) => {
      console.error("Subject sync error:", err);
      setCloudSyncError(err?.message || "Fächer konnten nicht aus Supabase geladen werden");
    });
  }, [session?.user?.id, isCloudHydrated]);

  useEffect(() => {
    if (!session?.user?.id || !isCloudHydrated) return;

    let isMounted = true;

    const refreshFromCloud = async () => {
      try {
        // Never pull remote state over local data while a local save is still pending.
        if (hasPendingCloudSaveRef.current) return;

        const cloudData = await loadUserPlannerData(session.user.id);
        if (!isMounted || !cloudData) return;

        setData((current) => {
          const currentJson = JSON.stringify(current);
          const cloudJson = JSON.stringify(cloudData);
          if (currentJson === cloudJson) {
            return current;
          }
          setLastCloudLoadAt(new Date().toISOString());
          setCloudSyncError(null);
          return cloudData;
        });
      } catch (err) {
        console.error("Cloud polling refresh failed:", err);
      }
    };

    const intervalId = window.setInterval(refreshFromCloud, 15000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshFromCloud();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    refreshFromCloud();

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [session?.user?.id, isCloudHydrated, setData]);

    useEffect(() => {
      const initSession = async () => {
        try {
          const activeSession = await getActiveSession();
          if (activeSession && activeSession.user) {
            console.info("[app-sync] session:active", { userId: activeSession.user.id });
            setSession(activeSession);
          } else {
            console.info("[app-sync] session:none");
          }
        } catch (err) {
          console.error("Session initialization error:", err);
        } finally {
          setIsLoadingSession(false);
        }
      };
      initSession();
    }, []);

    useEffect(() => {
      if (!session || !session.user || !isCloudHydrated) return;

      hasPendingCloudSaveRef.current = true;
    
      if (cloudSyncTimeoutRef.current) {
        clearTimeout(cloudSyncTimeoutRef.current);
        cloudSyncTimeoutRef.current = null;
      }

      cloudSyncTimeoutRef.current = setTimeout(async () => {
        await flushCloudSaveNow(data);
        cloudSyncTimeoutRef.current = null;
      }, 700);

      return () => {
        if (cloudSyncTimeoutRef.current) {
          clearTimeout(cloudSyncTimeoutRef.current);
          cloudSyncTimeoutRef.current = null;
        }
      };
    }, [data, session, isCloudHydrated]);

  const darkMode = data.settings.appearance === "system"
    ? systemPrefersDark
    : data.settings.appearance === "dark";
  const sidebarCollapsed = data.settings.sidebarCollapsed || false;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    document.documentElement.style.colorScheme = darkMode ? "dark" : "light";
    document.body.classList.toggle("dark", darkMode);
  }, [darkMode]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (session?.user?.id && !isCloudHydrated) return;
    if (data.seeds.tasks && data.seeds.sessions) return;
    setData((prev) => {
      const subjectIds = Object.fromEntries(prev.subjects.map((subject) => [subject.name, subject.id]));
      const today = new Date();
      const buildDate = (offset) => {
        const d = new Date(today);
        d.setDate(d.getDate() + offset);
        return formatDateInput(d);
      };

      let next = { ...prev };

      if (!prev.seeds.tasks) {
        const existingTitles = new Set(prev.tasks.map((task) => task.title.trim().toLowerCase()));
        const importedTasks = TASK_IMPORTS.filter((task) => !existingTitles.has(task[0].trim().toLowerCase())).map(([title, subjectName, status, dueOffset, priority]) => ({
          id: crypto.randomUUID(),
          title,
          description: "Importiert aus deiner Aufgabenliste.",
          subjectId: subjectIds[subjectName] || prev.subjects[0]?.id || "",
          createdAt: formatDateInput(today),
          dueDate: buildDate(dueOffset),
          acceptanceDate: "",
          priority,
          status,
          flaggedToday: false,
          urgent: dueOffset <= 3,
        }));
        next.tasks = [...prev.tasks, ...importedTasks];
      }

      if (!prev.seeds.sessions) {
        const seededSessions = prev.subjects
          .filter((subject) => SEEDED_HOURS[subject.name] > 0)
          .map((subject) => ({
            id: crypto.randomUUID(),
            subjectId: subject.id,
            durationMinutes: SEEDED_HOURS[subject.name] * 60,
            createdAt: new Date().toISOString(),
            source: "seed",
            note: "Importierter Lernstand",
          }));
        const existingSeed = prev.studySessions.some((s) => s.source === "seed");
        next.studySessions = existingSeed ? prev.studySessions : [...prev.studySessions, ...seededSessions];
      }

      next.seeds = { tasks: true, sessions: true };
      return next;
    });
  }, [data.seeds.tasks, data.seeds.sessions, setData, session?.user?.id, isCloudHydrated]);

  const subjectsById = useMemo(() => {
    const allSubjects = [...data.subjects, ...archivedSubjects];
    return Object.fromEntries(allSubjects.map((s) => [s.id, s]));
  }, [data.subjects, archivedSubjects]);

  const enhancedTasks = useMemo(() => data.tasks.map((task) => {
    const nextMilestone = getNextTaskMilestone(task);
    return {
      ...task,
      archived: isTaskArchived(task),
      daysLeft: nextMilestone?.date ? daysUntil(nextMilestone.date) : null,
      nextRelevantDate: nextMilestone?.date || null,
      nextRelevantType: nextMilestone?.label || null,
      subject: subjectsById[task.subjectId],
    };
  }), [data.tasks, subjectsById]);

  const filteredTasks = useMemo(() => {
    let list = [...enhancedTasks].filter((task) => !task.archived);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((task) => [task.title, task.description, task.subject?.name].some((value) => (value || "").toLowerCase().includes(q)));
    }
    if (taskFilter.subjectId !== "all") list = list.filter((task) => task.subjectId === taskFilter.subjectId);
    if (taskFilter.priority !== "all") list = list.filter((task) => task.priority === taskFilter.priority);
    if (taskFilter.status !== "all") list = list.filter((task) => task.status === taskFilter.status);
    list.sort((a, b) => {
      if (taskFilter.sort === "deadline") return new Date(a.nextRelevantDate || "2999-12-31") - new Date(b.nextRelevantDate || "2999-12-31");
      if (taskFilter.sort === "priority") {
        const order = { hoch: 0, mittel: 1, niedrig: 2 };
        return order[a.priority] - order[b.priority];
      }
      if (taskFilter.sort === "subject") return (a.subject?.name || "").localeCompare(b.subject?.name || "");
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
    return list;
  }, [enhancedTasks, search, taskFilter]);

  const archivedTasks = useMemo(() => {
    let list = [...enhancedTasks].filter((task) => task.archived);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((task) => [task.title, task.description, task.subject?.name].some((value) => (value || "").toLowerCase().includes(q)));
    }
    if (taskFilter.subjectId !== "all") list = list.filter((task) => task.subjectId === taskFilter.subjectId);
    if (taskFilter.priority !== "all") list = list.filter((task) => task.priority === taskFilter.priority);
    list.sort((a, b) => new Date(b.acceptanceDate || 0) - new Date(a.acceptanceDate || 0));
    return list;
  }, [enhancedTasks, search, taskFilter]);

  const today = new Date();
  const weekStart = getWeekStart(today);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const studyStats = useMemo(() => {
    const timedSessions = data.studySessions.filter((session) => session.source !== "seed");

    const total = data.studySessions.reduce((sum, s) => sum + s.durationMinutes, 0);
    const todayMinutes = timedSessions
      .filter((s) => isSameDay(new Date(s.createdAt), today))
      .reduce((sum, s) => sum + s.durationMinutes, 0);
    const weekMinutes = timedSessions
      .filter((s) => new Date(s.createdAt) >= weekStart)
      .reduce((sum, s) => sum + s.durationMinutes, 0);
    const monthMinutes = timedSessions
      .filter((s) => new Date(s.createdAt) >= monthStart)
      .reduce((sum, s) => sum + s.durationMinutes, 0);

    const bySubject = data.subjects.map((subject) => {
      const minutes = data.studySessions
        .filter((s) => s.subjectId === subject.id)
        .reduce((sum, s) => sum + s.durationMinutes, 0);
      return {
        id: subject.id,
        name: subject.name,
        minutes,
        hours: Number((minutes / 60).toFixed(4)),
        targetHours: subject.targetHours || 0,
        color: subject.color,
      };
    });

    const weekLine = Array.from({ length: 7 }).map((_, idx) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + idx);
      const minutes = timedSessions
        .filter((s) => isSameDay(new Date(s.createdAt), d))
        .reduce((sum, s) => sum + s.durationMinutes, 0);
      return {
        day: d.toLocaleDateString("de-DE", { weekday: "short" }),
        Stunden: Number((minutes / 60).toFixed(4)),
      };
    });

    const streakDays = Array.from({ length: 7 }).map((_, idx) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + idx);
      const minutes = timedSessions
        .filter((s) => isSameDay(new Date(s.createdAt), d))
        .reduce((sum, s) => sum + s.durationMinutes, 0);
      const status = startOfDay(d).getTime() > startOfDay(today).getTime()
        ? "upcoming"
        : minutes > 0
          ? "done"
          : isSameDay(d, today)
            ? "open"
            : "missed";
      return {
        key: d.toISOString(),
        label: d.toLocaleDateString("de-DE", { weekday: "short" }).replace(".", ""),
        status,
      };
    });

    const activeDays = new Set(
      timedSessions.map((s) => startOfDay(new Date(s.createdAt)).getTime())
    ).size || 1;

    return {
      total,
      todayMinutes,
      weekMinutes,
      monthMinutes,
      bySubject,
      weekLine,
      streakDays,
      dailyAverage: Math.round((timedSessions.reduce((sum, s) => sum + s.durationMinutes, 0)) / activeDays),
      weeklyAverage: Math.round(weekMinutes / 7),
      recentSubjects: [...timedSessions]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5)
        .map((s) => ({ ...s, subject: subjectsById[s.subjectId] })),
    };
  }, [data.studySessions, data.subjects, subjectsById]);

  const taskSummary = useMemo(() => {
    const visibleTasks = enhancedTasks.filter((task) => !task.archived);
    const archived = enhancedTasks.filter((task) => task.archived).length;
    const open = visibleTasks.filter((t) => t.status !== "erledigt").length;
    const done = visibleTasks.filter((t) => t.status === "erledigt").length;
    const overdue = visibleTasks.filter((t) => t.status !== "erledigt" && t.nextRelevantDate && t.daysLeft < 0).length;
    const dueSoon = visibleTasks.filter((t) => t.status !== "erledigt" && t.nextRelevantDate && t.daysLeft >= 0 && t.daysLeft <= 3).length;
    const nextDeadlines = [...visibleTasks]
      .filter((t) => t.status !== "erledigt" && t.nextRelevantDate)
      .sort((a, b) => getTaskSortTimestamp(b) - getTaskSortTimestamp(a));
    const completedDeadlines = [...visibleTasks]
      .filter((t) => t.status === "erledigt")
      .sort((a, b) => getTaskSortTimestamp(b) - getTaskSortTimestamp(a));
    return { open, done, overdue, dueSoon, nextDeadlines, completedDeadlines, archived };
  }, [enhancedTasks]);

  const deadlineLists = useMemo(() => {
    const activeFilter = deadlineWidgetSettings.activeFilter;
    return {
      due: taskSummary.nextDeadlines.filter((task) => taskMatchesDeadlineFilter(task, activeFilter)),
      done: taskSummary.completedDeadlines.filter((task) => taskMatchesDeadlineFilter(task, activeFilter)),
    };
  }, [taskSummary.nextDeadlines, taskSummary.completedDeadlines, deadlineWidgetSettings.activeFilter]);

  const trackedSessions = useMemo(() => {
    return [...data.studySessions]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map((session) => ({
        ...session,
        subject: subjectsById[session.subjectId],
      }));
  }, [data.studySessions, subjectsById]);

  const todayFocusEntries = useMemo(() => {
    return (data.todayFocus || [])
      .filter((entry) => isSameDay(new Date(entry.createdAt), today))
      .map((entry) => ({ ...entry, subject: subjectsById[entry.subjectId] }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [data.todayFocus, subjectsById, today]);

  const groupedSubjects = useMemo(() => {
    const semestersById = Object.fromEntries(semesters.map((semester) => [semester.id, semester]));
    const bucket = new Map();

    data.subjects.forEach((subject) => {
      const key = subject.semesterId || "ungrouped";
      if (!bucket.has(key)) {
        bucket.set(key, {
          id: key,
          name: semestersById[key]?.name || "Ohne Semester",
          subjects: [],
        });
      }
      bucket.get(key).subjects.push(subject);
    });

    return [...bucket.values()].sort((a, b) => a.name.localeCompare(b.name, "de"));
  }, [data.subjects, semesters]);

  const semesterSummaries = useMemo(() => {
    return semesters.map((semester) => {
      const semesterSubjects = data.subjects.filter((subject) => subject.semesterId === semester.id);
      const subjectIds = new Set(semesterSubjects.map((subject) => subject.id));
      const totalMinutes = data.studySessions
        .filter((session) => subjectIds.has(session.subjectId))
        .reduce((sum, session) => sum + Number(session.durationMinutes || 0), 0);
      const targetMinutes = semesterSubjects.reduce((sum, subject) => sum + Math.max(0, Number(subject.targetHours || 0)) * 60, 0);
      const progress = targetMinutes > 0 ? Math.min(100, Math.round((totalMinutes / targetMinutes) * 100)) : 0;
      const durationDays = semester.startDate && semester.endDate
        ? Math.max(0, Math.round((startOfDay(new Date(semester.endDate)).getTime() - startOfDay(new Date(semester.startDate)).getTime()) / 86400000))
        : null;
      const remainingDays = semester.endDate ? daysUntil(semester.endDate) : null;

      return {
        ...semester,
        subjectCount: semesterSubjects.length,
        totalMinutes,
        durationDays,
        remainingDays,
        progress,
      };
    });
  }, [semesters, data.subjects, data.studySessions]);

  const selectedSemesterStats = useMemo(() => {
    if (!semesterSummaries.length) return null;
    return semesterSummaries.find((semester) => semester.id === selectedSemesterId) || semesterSummaries[0];
  }, [semesterSummaries, selectedSemesterId]);

  useEffect(() => {
    if (!semesters.length) {
      if (selectedSemesterId) setSelectedSemesterId("");
      return;
    }
    if (!selectedSemesterId) {
      setSelectedSemesterId(semesters[0].id);
    } else if (!semesters.some((semester) => semester.id === selectedSemesterId)) {
      setSelectedSemesterId(semesters[0].id);
    }
  }, [semesters]);

  async function saveSubject(subject) {
    const userId = session?.user?.id;

    if (!userId) {
      setData((prev) => ({
        ...prev,
        subjects: prev.subjects.some((s) => s.id === subject.id)
          ? prev.subjects.map((s) => (s.id === subject.id ? subject : s))
          : [...prev.subjects, { ...subject, id: crypto.randomUUID() }],
      }));
      setEditingSubject(null);
      return;
    }

    try {
      const payload = {
        ...subject,
        id: subject.id || crypto.randomUUID(),
      };
      if (data.subjects.some((s) => s.id === payload.id)) {
        await updateSubjectRecord(userId, payload.id, payload);
      } else {
        await createSubjectRecord(userId, payload);
      }
      await syncSubjectsFromDatabase(userId);
      setEditingSubject(null);
    } catch (err) {
      console.error("Save subject error:", err);
      setCloudSyncError(err?.message || "Fach konnte nicht gespeichert werden");
    }
  }

  async function archiveSubject(id) {
    const userId = session?.user?.id;
    if (!userId) {
      setData((prev) => ({ ...prev, subjects: prev.subjects.filter((s) => s.id !== id) }));
      return;
    }

    try {
      await archiveSubjectRecord(userId, id);
      await syncSubjectsFromDatabase(userId);
    } catch (err) {
      console.error("Archive subject error:", err);
      setCloudSyncError(err?.message || "Fach konnte nicht archiviert werden");
    }
  }

  async function restoreSubject(id) {
    const userId = session?.user?.id;
    if (!userId) return;

    try {
      await unarchiveSubjectRecord(userId, id);
      await syncSubjectsFromDatabase(userId);
    } catch (err) {
      console.error("Restore subject error:", err);
      setCloudSyncError(err?.message || "Fach konnte nicht wiederhergestellt werden");
    }
  }

  async function permanentlyDeleteSubject(id) {
    const userId = session?.user?.id;
    if (!userId) return;

    const confirmed = window.confirm("Dieses Fach wird endgültig gelöscht und kann nicht wiederhergestellt werden. Fortfahren?");
    if (!confirmed) return;

    try {
      await deleteSubjectRecord(userId, id);
      await syncSubjectsFromDatabase(userId);
    } catch (err) {
      console.error("Permanently delete subject error:", err);
      setCloudSyncError(err?.message || "Fach konnte nicht gelöscht werden");
    }
  }

  async function deleteSubject(id) {
    const userId = session?.user?.id;
    if (!userId) {
      setData((prev) => ({ ...prev, subjects: prev.subjects.filter((s) => s.id !== id) }));
      return;
    }

    try {
      await archiveSubjectRecord(userId, id);
      await syncSubjectsFromDatabase(userId);
    } catch (err) {
      console.error("Archive subject error:", err);
      setCloudSyncError(err?.message || "Fach konnte nicht archiviert werden");
    }
  }

  async function saveSemesterRecord(draft) {
    const userId = session?.user?.id;
    if (!userId) return;

    try {
      if (draft?.id) {
        await updateSemester(userId, draft.id, draft);
      } else {
        await createSemester(userId, draft || { name: "", startDate: "", endDate: "" });
      }
      setEditingSemester(null);
      setSemesterDialogOpen(false);
      await syncSubjectsFromDatabase(userId);
    } catch (err) {
      console.error("Save semester error:", err);
      setCloudSyncError(err?.message || "Semester konnte nicht gespeichert werden");
    }
  }

  async function deleteSemesterRecord(semesterId) {
    const userId = session?.user?.id;
    if (!userId || !semesterId) return;

    try {
      await deleteSemester(userId, semesterId);
      await syncSubjectsFromDatabase(userId);
      if (selectedSemesterId === semesterId) {
        setSelectedSemesterId("");
      }
    } catch (err) {
      console.error("Delete semester error:", err);
      setCloudSyncError(err?.message || "Semester konnte nicht gelöscht werden");
    }
  }

  function saveTask(task) {
    setData((prev) => {
      const isNewTask = !prev.tasks.some((t) => t.id === task.id);
      const updatedTasks = isNewTask
        ? [...prev.tasks, { ...task, id: crypto.randomUUID() }]
        : prev.tasks.map((t) => (t.id === task.id ? task : t));
      
      // Auto-generate recurring task when a task is marked as done
      if (task.status === "erledigt" && task.recurringPattern && task.recurringPattern !== "none") {
        const recurringTask = generateRecurringTask(task, task.recurringPattern);
        if (recurringTask) {
          updatedTasks.push(recurringTask);
        }
      }
      
      return { ...prev, tasks: updatedTasks };
    });
    setEditingTask(null);
  }

  function deleteTask(id) {
    setData((prev) => ({ ...prev, tasks: prev.tasks.filter((t) => t.id !== id) }));
  }

  function saveStudySession(session) {
    setData((prev) => ({
      ...prev,
      studySessions: prev.studySessions.some((s) => s.id === session.id)
        ? prev.studySessions.map((s) => (s.id === session.id ? session : s))
        : [session, ...prev.studySessions],
    }));
    setEditingSession(null);
  }

  function deleteStudySession(id) {
    setData((prev) => {
      const deletedSession = prev.studySessions.find((session) => session.id === id) || null;
      if (deletedSession) {
        setLastDeletedSession(deletedSession);
      }
      return {
        ...prev,
        studySessions: prev.studySessions.filter((session) => session.id !== id),
      };
    });
  }

  function undoDeleteStudySession() {
    if (!lastDeletedSession) return;
    setData((prev) => ({
      ...prev,
      studySessions: prev.studySessions.some((session) => session.id === lastDeletedSession.id)
        ? prev.studySessions
        : [lastDeletedSession, ...prev.studySessions],
    }));
    setLastDeletedSession(null);
  }

  function toggleTaskDone(task) {
    saveTask({ ...task, status: task.status === "erledigt" ? "offen" : "erledigt" });
  }

  function handleExportData() {
    const jsonString = exportDataToJSON(data);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `studienplan-export-${formatDateInput(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleImportData(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result;
        if (typeof content !== "string") throw new Error("Invalid file format");
        
        const imported = importDataFromJSON(content, data);
        setData(imported);
        setImportError(null);
        setSettingsDialogOpen(false);
      } catch (error) {
        setImportError((error instanceof Error) ? error.message : "Import failed");
      }
    };
    reader.readAsText(file);
  }

  function openTodaySubjectDialog(subject) {
    const existing = todayFocusEntries.find((entry) => entry.subjectId === subject.id);
    setTodaySubjectDraft({
      subjectId: subject.id,
      note: existing?.note || "",
    });
    setTodaySubjectDialogOpen(true);
  }

  function saveTodaySubjectFocus() {
    if (!todaySubjectDraft.subjectId) return;
    setData((prev) => {
      const todayEntries = prev.todayFocus || [];
      const existing = todayEntries.find((entry) => entry.subjectId === todaySubjectDraft.subjectId && isSameDay(new Date(entry.createdAt), new Date()));
      const nextEntry = {
        id: existing?.id || crypto.randomUUID(),
        subjectId: todaySubjectDraft.subjectId,
        note: todaySubjectDraft.note || "",
        createdAt: existing?.createdAt || new Date().toISOString(),
      };
      return {
        ...prev,
        todayFocus: existing
          ? todayEntries.map((entry) => (entry.id === existing.id ? nextEntry : entry))
          : [nextEntry, ...todayEntries],
      };
    });
    setTodaySubjectDialogOpen(false);
    setTodaySubjectDraft({ subjectId: "", note: "" });
  }

  function removeTodaySubjectFocus(subjectId) {
    setData((prev) => ({
      ...prev,
      todayFocus: (prev.todayFocus || []).filter(
        (entry) => !(entry.subjectId === subjectId && isSameDay(new Date(entry.createdAt), new Date()))
      ),
    }));
  }

    const handleLogout = async () => {
      try {
        await flushCloudSaveNow(data);
        await signOutCurrentSession();
        setSession(null);
        setData(createLoggedOutData());
      } catch (err) {
        console.error("Logout error:", err);
      }
    };

    if (isLoadingSession) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950">
          <div className="text-center">
            <div className="rounded-2xl bg-primary/10 p-4 text-primary mx-auto mb-4 w-fit">
              <BookOpen className="h-8 w-8" />
            </div>
            <h1 className="text-xl font-semibold text-white mb-2">Studien- & Lernplan</h1>
            <p className="text-slate-400">Loading session...</p>
          </div>
        </div>
      );
    }

    if (!session || !session.user) {
      return <AuthScreen onAuthSuccess={(authResult) => {
        setIsLoadingSession(true);
        setSession(authResult?.session || authResult);
      }} />;
    }

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "tasks", label: "Aufgaben", icon: ListTodo },
    { id: "semester-config", label: "Semesterkonfiguration", icon: CalendarClock },
    { id: "subjects", label: "Fächer", icon: GraduationCap },
    { id: "tracking", label: "Lernzeiterfassung", icon: Clock3 },
    { id: "stats", label: "Statistik", icon: BarChart3 },
  ];

  const currentPageLabel = navItems.find((n) => n.id === page)?.label;
  const handlePageChange = (nextPage) => {
    setPage(nextPage);
    setMobileNavOpen(false);
  };
  const handleAppearanceChange = (appearance) => {
    setData((prev) => ({ ...prev, settings: { ...prev.settings, appearance } }));
  };

  const themeDock = typeof document !== "undefined"
    ? createPortal(
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex justify-center">
          <div className={cn("pointer-events-auto inline-flex items-center gap-1 rounded-full border px-1 py-1 shadow-lg", darkMode ? "border-slate-700 bg-slate-900/95" : "border-slate-300 bg-white/95") }>
            <button type="button" onClick={() => handleAppearanceChange("light")} className={cn("inline-flex h-9 w-9 items-center justify-center rounded-full transition", data.settings.appearance === "light" ? (darkMode ? "bg-slate-700 text-slate-50" : "bg-slate-900 text-white") : (darkMode ? "text-slate-300 hover:bg-slate-800" : "text-slate-700 hover:bg-slate-100"))} aria-label="Hellmodus aktivieren">
              <Sun className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => handleAppearanceChange("dark")} className={cn("inline-flex h-9 w-9 items-center justify-center rounded-full transition", data.settings.appearance === "dark" ? (darkMode ? "bg-slate-700 text-slate-50" : "bg-slate-900 text-white") : (darkMode ? "text-slate-300 hover:bg-slate-800" : "text-slate-700 hover:bg-slate-100"))} aria-label="Dunkelmodus aktivieren">
              <Moon className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => handleAppearanceChange("system")} className={cn("inline-flex h-9 w-9 items-center justify-center rounded-full transition", data.settings.appearance === "system" ? (darkMode ? "bg-slate-700 text-slate-50" : "bg-slate-900 text-white") : (darkMode ? "text-slate-300 hover:bg-slate-800" : "text-slate-700 hover:bg-slate-100"))} aria-label="Systemmodus aktivieren">
              <Monitor className="h-4 w-4" />
            </button>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <div className={cn("min-h-screen transition-colors", darkMode ? "dark bg-slate-950 text-slate-50" : "bg-slate-50 text-slate-900")}>
        <div className={cn("mx-auto min-h-screen max-w-7xl", sidebarCollapsed ? "lg:grid lg:grid-cols-[88px_1fr]" : "lg:grid lg:grid-cols-[260px_1fr]")}>
          <aside className={cn("hidden border-r p-4 backdrop-blur lg:block", darkMode ? "border-slate-800 bg-slate-900/80" : "border-slate-200 bg-white/80")}>
          <div className="flex h-full flex-col">
            <div>
              <div className={cn("flex items-center px-2 py-3", sidebarCollapsed ? "justify-center" : "justify-between gap-3")}>
                <div className={cn("flex items-center gap-3", sidebarCollapsed && "justify-center")}> 
                  <div className="rounded-2xl bg-primary/10 p-2 text-primary"><BookOpen className="h-5 w-5" /></div>
                  {!sidebarCollapsed ? (
                    <div><p className="text-sm text-muted-foreground">Study Planner</p><h1 className="text-lg font-semibold tracking-tight">Studien- & Lernplan</h1></div>
                  ) : null}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 rounded-xl"
                  onClick={() => setData((prev) => ({ ...prev, settings: { ...prev.settings, sidebarCollapsed: !sidebarCollapsed } }))}
                >
                  {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </Button>
              </div>
              <nav className="mt-6 grid gap-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handlePageChange(item.id)}
                      title={sidebarCollapsed ? item.label : undefined}
                      className={cn(
                        "flex rounded-2xl px-3 py-3 text-left text-sm transition",
                        sidebarCollapsed ? "justify-center" : "items-center gap-3",
                        page === item.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {!sidebarCollapsed ? item.label : null}
                    </button>
                  );
                })}
                <button onClick={() => setSettingsDialogOpen(true)} title={sidebarCollapsed ? "Einstellungen & Backup" : undefined} className={cn("flex rounded-2xl px-3 py-3 text-left text-sm transition hover:bg-muted", sidebarCollapsed ? "justify-center" : "items-center gap-3")}>
                  <Settings className="h-4 w-4 shrink-0" />
                  {!sidebarCollapsed ? "Einstellungen & Backup" : null}
                </button>
              </nav>
            </div>

            <div className="mt-auto pt-6">
              <Separator className="mb-4" />
              <div className={cn("mx-auto w-full", sidebarCollapsed ? "" : "max-w-[220px]")}>
                <div className={cn("pt-1", darkMode ? "border-slate-700" : "border-slate-200")}>
                  <div className={cn("flex items-center gap-2 rounded-xl p-3 text-xs font-medium", darkMode ? "bg-slate-800/50 text-slate-400" : "bg-slate-100/50 text-slate-600")}>
                    {session?.user?.email || "User"}
                  </div>
                  <Button
                    onClick={handleLogout}
                    variant="outline"
                    size="sm"
                    className="mt-2 w-full rounded-xl border-red-200 text-red-700 hover:border-red-300 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    {!sidebarCollapsed ? "Logout" : ""}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <header className={cn("sticky top-0 z-30 border-b px-4 py-3 backdrop-blur lg:hidden", darkMode ? "border-slate-800 bg-slate-900/95" : "border-slate-200 bg-white/95")}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Studien- & Lernplan</p>
                <h1 className="truncate text-base font-semibold">{currentPageLabel}</h1>
              </div>
              <Button
                variant="outline"
                size="icon"
                className="rounded-xl"
                onClick={() => setMobileNavOpen((prev) => !prev)}
                aria-label="Menü umschalten"
              >
                <Menu className="h-4 w-4" />
              </Button>
            </div>

            {mobileNavOpen ? (
              <div className="mt-3 grid gap-2 border-t pt-3">
                <nav className="grid grid-cols-2 gap-2">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handlePageChange(item.id)}
                        className={cn(
                          "flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition",
                          page === item.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </nav>

                <div className="grid gap-2 border-t pt-3">
                  <div className={cn("rounded-xl px-3 py-2 text-xs font-medium", darkMode ? "bg-slate-800/70 text-slate-300" : "bg-slate-100 text-slate-600")}>
                    {session?.user?.email || "User"}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      className="rounded-xl"
                      onClick={() => {
                        setSettingsDialogOpen(true);
                        setMobileNavOpen(false);
                      }}
                    >
                      <Settings className="mr-2 h-4 w-4" />
                      Einstellungen
                    </Button>
                    <Button
                      onClick={handleLogout}
                      variant="outline"
                      className="rounded-xl border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Logout
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </header>

          <main className="p-4 md:p-6 lg:p-8">
          {cloudSyncError ? (
            <div className={cn("mb-4 rounded-xl border px-4 py-3 text-sm", darkMode ? "border-amber-500/30 bg-amber-500/10 text-amber-100" : "border-amber-300 bg-amber-50 text-amber-800")}>
              {cloudSyncError}
            </div>
          ) : null}

          <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">{currentPageLabel}</h2>
              <p className="text-sm text-muted-foreground">Klare Übersicht über Fächer, Aufgaben und Lernzeiten</p>
            </div>

            <div className="flex w-full max-w-[920px] flex-col gap-3 xl:items-end">
              <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-end">
                <div className="relative w-full lg:w-80 xl:w-96">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Suchen nach Aufgabe oder Fach" className="pl-9" />
                </div>
                <DashboardQuickActions subjects={data.subjects} onSaveSession={saveStudySession} darkMode={darkMode} userId={session?.user?.id || null} />
              </div>

              <div className="flex w-full flex-wrap gap-3 lg:justify-end">
                <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="rounded-xl"><Plus className="mr-2 h-4 w-4" />Aufgabe</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl rounded-3xl">
                    <DialogHeader><DialogTitle>Aufgabe anlegen</DialogTitle></DialogHeader>
                    <TaskForm subjects={data.subjects} onSave={saveTask} onDone={() => setTaskDialogOpen(false)} />
                  </DialogContent>
                </Dialog>

                <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
                  <DialogContent className="max-w-lg rounded-3xl">
                    <DialogHeader><DialogTitle>Datenverwaltung & Backup</DialogTitle></DialogHeader>
                    <div className="grid gap-5">
                      <div className={cn("rounded-xl border p-3", darkMode ? "border-slate-700 bg-slate-900/60" : "border-slate-200 bg-slate-50")}>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">Dashboard-Bearbeitung</p>
                            <p className="text-xs text-muted-foreground">Kacheln per Drag & Drop anordnen</p>
                          </div>
                          <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setIsEditingDashboard((prev) => !prev)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className={cn("rounded-xl border p-3", darkMode ? "border-slate-700 bg-slate-900/60" : "border-slate-200 bg-slate-50")}>
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold">Sync-Health</p>
                          <Badge variant={cloudSyncError ? "destructive" : "secondary"}>{cloudSyncError ? "Warnung" : "OK"}</Badge>
                        </div>
                        <div className="grid gap-2 text-xs">
                          <div className="flex items-center justify-between"><span className="text-muted-foreground">Session User</span><span className="font-medium">{session?.user?.id ? "aktiv" : "fehlt"}</span></div>
                          <div className="flex items-center justify-between"><span className="text-muted-foreground">user_id</span><span className="font-medium truncate max-w-[180px]">{session?.user?.id || "-"}</span></div>
                          <div className="flex items-center justify-between"><span className="text-muted-foreground">Supabase ENV</span><span className="font-medium">{hasSupabaseEnv ? "konfiguriert" : "fehlt"}</span></div>
                          <div className="flex items-center justify-between"><span className="text-muted-foreground">Cloud-Hydration</span><span className="font-medium">{isCloudHydrated ? "fertig" : "ausstehend"}</span></div>
                          <div className="flex items-center justify-between"><span className="text-muted-foreground">Load Query</span><span className="font-medium">/user_plans?user_id=eq.&lt;id&gt;&amp;select=data</span></div>
                          <div className="flex items-center justify-between"><span className="text-muted-foreground">Save Query</span><span className="font-medium">POST /user_plans?on_conflict=user_id</span></div>
                          <div className="flex items-center justify-between"><span className="text-muted-foreground">Letzter Cloud-Load</span><span className="font-medium">{lastCloudLoadAt ? formatDateTimeDisplay(lastCloudLoadAt) : "-"}</span></div>
                          <div className="flex items-center justify-between"><span className="text-muted-foreground">Letzter Cloud-Save</span><span className="font-medium">{lastCloudSaveAt ? formatDateTimeDisplay(lastCloudSaveAt) : "-"}</span></div>
                          {cloudSyncError ? <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-amber-200 dark:text-amber-200">{cloudSyncError}</p> : null}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-base font-semibold">🔐 Sicherung deiner Daten</Label>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Exportiere alle deine Fächer, Aufgaben und Lernzeiten als JSON, um ein Backup zu erstellen. Du kannst es später wiederherstellen.</p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <Button onClick={handleExportData} variant="default" className="rounded-xl h-12 flex items-center gap-2">
                          <Download className="h-4 w-4" />Exportieren
                        </Button>
                        <label className="contents">
                          <Button asChild variant="outline" className="rounded-xl h-12 flex items-center gap-2 cursor-pointer">
                            <span><Upload className="h-4 w-4" />Importieren</span>
                          </Button>
                          <input type="file" accept=".json" onChange={handleImportData} style={{ display: "none" }} />
                        </label>
                      </div>
                      
                      {importError && <div className="bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 p-3 rounded-lg text-sm">{importError}</div>}
                      
                      <Separator />
                      
                      <div className="bg-slate-100 dark:bg-slate-800/50 p-4 rounded-xl space-y-2">
                        <p className="text-sm font-semibold">📊 Deine Daten</p>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <p className="text-gray-600 dark:text-gray-400">Fächer</p>
                            <p className="text-lg font-bold">{data.subjects.length}</p>
                          </div>
                          <div>
                            <p className="text-gray-600 dark:text-gray-400">Aufgaben</p>
                            <p className="text-lg font-bold">{data.tasks.length}</p>
                          </div>
                          <div>
                            <p className="text-gray-600 dark:text-gray-400">Lernzeiten</p>
                            <p className="text-lg font-bold">{data.studySessions.length}</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-2 bg-blue-50 dark:bg-blue-500/10 p-3 rounded-lg text-sm">
                        <p className="font-semibold text-blue-900 dark:text-blue-300">💡 Neue Features:</p>
                        <ul className="text-xs text-blue-800 dark:text-blue-400 space-y-1 list-disc list-inside">
                          <li>Wiederholende Aufgaben (wöchentlich/monatlich)</li>
                          <li>Automatische Backup-Funktion</li>
                          <li>Volle Datenverwaltung</li>
                        </ul>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>

          
          {page === "dashboard" ? (
            <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={dashboardLayout} strategy={rectSortingStrategy}>
                <div className="grid gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-6 auto-rows-max">
                  {dashboardLayout.map((widgetId) => {
                    if (widgetId === "stats") {
                      return (
                        <SortableTile key="stats" id="stats" isEditing={isEditingDashboard} className="col-span-full">
                          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <StatCard darkMode={darkMode} title="Offene Aufgaben" value={taskSummary.open} sub="Noch nicht erledigt" icon={ListTodo} />
                            <StatCard darkMode={darkMode} title="Bald fällig" value={taskSummary.dueSoon} sub="In den nächsten 3 Tagen" icon={CalendarClock} />
                            <StatCard darkMode={darkMode} title="Überfällig" value={taskSummary.overdue} sub="Sofort im Blick behalten" icon={AlertTriangle} />
                            <StatCard darkMode={darkMode} title="Erledigte Aufgaben" value={taskSummary.done} sub="Bereits abgeschlossen" icon={CheckCircle2} />
                          </div>
                        </SortableTile>
                      );
                    }
                    if (widgetId === "deadlines") {
                      return (
                        <SortableTile key="deadlines" id="deadlines" isEditing={isEditingDashboard} className="col-span-full xl:col-span-3">
                          <Card className={cn("h-full rounded-2xl border shadow-sm", getSurfaceClass(darkMode))}>
                            <CardHeader>
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <CardTitle>Nächste Deadlines</CardTitle>
                                  <CardDescription>Offene Fristen und erledigte Deadline-Aufgaben</CardDescription>
                                </div>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" aria-label="Deadline-Filter öffnen">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    {DEADLINE_FILTER_OPTIONS.map((option) => (
                                      <DropdownMenuItem key={option.id} onClick={() => updateDeadlineWidgetSettings({ activeFilter: option.id })} className="flex items-center justify-between gap-2">
                                        <span>Filter: {option.label}</span>
                                        {deadlineWidgetSettings.activeFilter === option.id ? <Check className="h-4 w-4" /> : null}
                                      </DropdownMenuItem>
                                    ))}
                                    <DropdownMenuItem onClick={() => updateDeadlineWidgetSettings({ defaultFilter: deadlineWidgetSettings.activeFilter })} className="flex items-center justify-between gap-2">
                                      <span>Aktuellen Filter als Standard</span>
                                      <Badge variant="secondary" className="px-2 py-0 text-[10px]">Default</Badge>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => updateDeadlineWidgetSettings({ activeFilter: deadlineWidgetSettings.defaultFilter })}>
                                      Gespeicherten Standard anwenden
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </CardHeader>
                            <CardContent className="grid max-h-[760px] gap-4 overflow-y-auto pr-2">
                              <div className={cn("grid grid-cols-2 gap-2 rounded-xl p-1", darkMode ? "bg-slate-800/70" : "bg-slate-100")}>
                                <button type="button" onClick={() => setDeadlineTab("due")} className={cn("rounded-lg px-3 py-1.5 text-sm font-medium transition", deadlineTab === "due" ? (darkMode ? "bg-slate-700 text-slate-50" : "bg-white text-slate-900 shadow-sm") : (darkMode ? "text-slate-300" : "text-slate-600"))}>Fällig</button>
                                <button type="button" onClick={() => setDeadlineTab("done")} className={cn("rounded-lg px-3 py-1.5 text-sm font-medium transition", deadlineTab === "done" ? (darkMode ? "bg-slate-700 text-slate-50" : "bg-white text-slate-900 shadow-sm") : (darkMode ? "text-slate-300" : "text-slate-600"))}>Erledigt</button>
                              </div>

                              <p className="text-xs text-muted-foreground">Aktiver Filter: {DEADLINE_FILTER_OPTIONS.find((option) => option.id === deadlineWidgetSettings.activeFilter)?.label || "Alle"}</p>

                              <div className="grid gap-3">
                                {deadlineTab === "due" ? (
                                  deadlineLists.due.length === 0 ? <p className="text-sm text-muted-foreground">Keine anstehenden Deadlines vorhanden.</p> : deadlineLists.due.map((task) => (
                                    <div key={task.id} className={cn("flex flex-col gap-3 rounded-2xl border p-4 md:flex-row md:items-center md:justify-between", deadlineCardTone(task.nextRelevantDate, task.status))}>
                                      <div>
                                        <div className="flex items-center gap-2"><button type="button" onClick={() => toggleTaskDone(task)} aria-label="Als erledigt markieren" className={cn("flex h-6 w-6 items-center justify-center rounded-md border transition-colors", darkMode ? "border-slate-600 bg-slate-800 hover:bg-slate-700" : "border-slate-300 bg-white hover:bg-slate-100")} /><div className="h-3 w-3 rounded-full" style={{ backgroundColor: task.subject?.color || "#94a3b8" }} /><p className="font-medium">{task.title}</p></div>
                                        <p className="mt-1 text-sm text-muted-foreground">{task.subject?.name || "Ohne Fach"}</p>
                                      </div>
                                      <div className="flex items-center gap-2"><Badge className={cn("border-0", deadlineTone(task.nextRelevantDate, task.status))}>{deadlineLabel(task.nextRelevantDate, task.status)}</Badge><Button variant="outline" size="icon" onClick={() => setEditingTask(task)}><Pencil className="h-4 w-4" /></Button></div>
                                    </div>
                                  ))
                                ) : (
                                  deadlineLists.done.length === 0 ? <p className="text-sm text-muted-foreground">Noch keine erledigten Deadline-Aufgaben.</p> : deadlineLists.done.map((task) => (
                                    <div key={task.id} className="flex flex-col gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 md:flex-row md:items-center md:justify-between">
                                      <div>
                                        <div className="flex items-center gap-2"><button type="button" onClick={() => toggleTaskDone(task)} aria-label="Als offen markieren" className="flex h-6 w-6 items-center justify-center rounded-md border border-emerald-500 bg-emerald-500 text-white transition-colors"><Check className="h-4 w-4" /></button><div className="h-3 w-3 rounded-full" style={{ backgroundColor: task.subject?.color || "#94a3b8" }} /><p className="font-medium">{task.title}</p></div><p className="mt-1 text-sm text-muted-foreground">{task.subject?.name || "Ohne Fach"}</p>
                                      </div>
                                      <div className="flex flex-wrap items-center gap-2">{task.nextRelevantType ? <Badge variant="outline">{task.nextRelevantType}: {formatDateDisplay(task.nextRelevantDate)}</Badge> : null}<Badge className="border-0 bg-emerald-200 text-slate-950 ring-1 ring-emerald-300">Erledigt</Badge><Button variant="outline" size="icon" onClick={() => setEditingTask(task)}><Pencil className="h-4 w-4" /></Button></div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        </SortableTile>
                      );
                    }
                    if (widgetId === "hours") {
                      return (
                        <SortableTile key="hours" id="hours" isEditing={isEditingDashboard} className="col-span-full xl:col-span-3">
                          <Card className={cn("h-full rounded-2xl border shadow-sm", getSurfaceClass(darkMode))}>
                            <CardHeader><CardTitle>Gesamte Lernzeit pro Fach</CardTitle></CardHeader>
                            <CardContent className="grid gap-5 px-3 pb-5 sm:px-5"><StudyOverviewStrip studyStats={studyStats} darkMode={darkMode} /><SubjectHoursChart data={studyStats.bySubject} darkMode={darkMode} onEditSubject={setEditingSubject} onDeleteSubject={deleteSubject} /></CardContent>
                          </Card>
                        </SortableTile>
                      );
                    }
                    if (widgetId === "today") {
                      return (
                        <SortableTile key="today" id="today" isEditing={isEditingDashboard} className="col-span-full md:col-span-1 xl:col-span-2">
                          <Card className={cn("h-full rounded-2xl border shadow-sm", getSurfaceClass(darkMode))}><CardHeader><CardTitle>Heute lernen</CardTitle><CardDescription>Fächer und Aufgaben für den heutigen Fokus</CardDescription></CardHeader><CardContent className="grid max-h-[520px] gap-3 overflow-y-auto pr-2">{todayFocusEntries.length === 0 && enhancedTasks.filter((t) => t.flaggedToday && t.status !== "erledigt").length === 0 ? <p className="text-sm text-muted-foreground">Keine Aufgaben für heute markiert.</p> : <>{todayFocusEntries.map((entry) => <div key={entry.id} className="rounded-2xl border p-4"><div className="flex items-center gap-2"><div className="h-3 w-3 rounded-full" style={{ backgroundColor: entry.subject?.color || "#94a3b8" }} /><p className="font-medium">{entry.subject?.name || "Unbekanntes Fach"}</p></div><p className="mt-1 text-sm text-muted-foreground">{entry.note || "Ohne Zusatznotiz"}</p></div>)}{enhancedTasks.filter((t) => t.flaggedToday && t.status !== "erledigt").slice(0, 6).map((task) => <div key={task.id} className="rounded-2xl border p-4"><p className="font-medium">{task.title}</p><p className="text-sm text-muted-foreground">{task.subject?.name}</p></div>)}</>}</CardContent></Card>
                        </SortableTile>
                      );
                    }
                    if (widgetId === "recent") {
                      return (
                        <SortableTile key="recent" id="recent" isEditing={isEditingDashboard} className="col-span-full md:col-span-1 xl:col-span-2">
                          <Card className={cn("h-full rounded-2xl border shadow-sm", getSurfaceClass(darkMode))}><CardHeader><CardTitle>Zuletzt gelernte Fächer</CardTitle><CardDescription>Die letzten Lernzeiteinträge</CardDescription></CardHeader><CardContent className="grid max-h-[520px] gap-3 overflow-y-auto pr-2">{studyStats.recentSubjects.length === 0 ? <p className="text-sm text-muted-foreground">Noch keine Lernzeit erfasst.</p> : studyStats.recentSubjects.map((entry) => <div key={entry.id} className="flex items-center justify-between rounded-2xl border p-4"><div><p className="font-medium">{entry.subject?.name || "Unbekanntes Fach"}</p><p className="text-sm text-muted-foreground">{formatDateTimeDisplay(entry.createdAt)}</p></div><Badge variant="secondary">{formatMinutes(entry.durationMinutes)}</Badge></div>)}</CardContent></Card>
                        </SortableTile>
                      );
                    }
                    if (widgetId === "done") {
                      return (
                      <SortableTile key="done" id="done" isEditing={isEditingDashboard} className="col-span-full md:col-span-1 xl:col-span-2">
                        <Card className={cn("h-full rounded-2xl border shadow-sm", getSurfaceClass(darkMode))}><CardHeader><CardTitle>Erledigte Aufgaben</CardTitle><CardDescription>Bereits abgeschlossene Aufgaben</CardDescription></CardHeader><CardContent className="grid max-h-[520px] gap-3 overflow-y-auto pr-2">{enhancedTasks.filter((t) => t.status === "erledigt").length === 0 ? <p className="text-sm text-muted-foreground">Noch keine erledigten Aufgaben.</p> : enhancedTasks.filter((t) => t.status === "erledigt").slice(0, 6).map((task) => <div key={task.id} className="rounded-2xl border p-4"><p className="font-medium">{task.title}</p><p className="text-sm text-muted-foreground">{task.subject?.name}</p></div>)}</CardContent></Card>
                      </SortableTile>
                      );
                    }
                    return null;
                  })}
                </div>
              </SortableContext>
            </DndContext>
          
) : null}

          {page === "semester-config" ? (
            <div className="grid gap-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-2xl font-bold tracking-tight">Semesterkonfiguration</h2>
                <Button variant="outline" className="rounded-xl" onClick={() => { setEditingSemester(null); setSemesterDialogOpen(true); }}><Plus className="mr-2 h-4 w-4" />Semester anlegen</Button>
              </div>

              {semesters.length === 0 ? (
                <Card className={cn("rounded-2xl border shadow-sm", getSurfaceClass(darkMode))}><CardContent className="p-6 text-sm text-muted-foreground">Noch keine Semester angelegt.</CardContent></Card>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  {semesters.map((semester) => (
                    <Card key={semester.id} className={cn("rounded-2xl border shadow-sm", getSurfaceClass(darkMode))}>
                      <CardHeader>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <CardTitle>{semester.name}</CardTitle>
                            <CardDescription>
                              {semester.start_date && semester.end_date ? `${formatDateDisplay(semester.start_date)} - ${formatDateDisplay(semester.end_date)}` : "Zeitraum noch nicht gesetzt"}
                            </CardDescription>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => { setEditingSemester(semester); setSemesterDialogOpen(true); }}>Bearbeiten</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => deleteSemesterRecord(semester.id)}>Löschen</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {page === "subjects" ? (
            <div className="grid gap-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-2xl font-bold tracking-tight">Fächer</h2>
                <Dialog open={subjectDialogOpen} onOpenChange={setSubjectDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="rounded-xl"><Plus className="mr-2 h-4 w-4" />Fach anlegen</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-xl rounded-3xl">
                    <DialogHeader><DialogTitle>Fach anlegen</DialogTitle></DialogHeader>
                    <SubjectForm onSave={saveSubject} onDone={() => setSubjectDialogOpen(false)} semesters={semesters} />
                  </DialogContent>
                </Dialog>
              </div>

              {groupedSubjects.length === 0 ? (
                <Card className={cn("rounded-2xl border shadow-sm", getSurfaceClass(darkMode))}><CardContent className="p-6 text-sm text-muted-foreground">Noch keine Fächer vorhanden.</CardContent></Card>
              ) : groupedSubjects.map((group) => (
                <div key={group.id} className="grid gap-4">
                  <div className="flex items-center gap-2"><h3 className="text-lg font-semibold tracking-tight">{group.name}</h3><Badge variant="outline">{group.subjects.length}</Badge></div>
                  <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                    {group.subjects.map((subject) => {
                      const totalMinutes = data.studySessions.filter((s) => s.subjectId === subject.id).reduce((sum, s) => sum + s.durationMinutes, 0);
                      const openTasks = data.tasks.filter((t) => t.subjectId === subject.id && t.status !== "erledigt").length;
                      const progressValue = subject.targetHours ? Math.min(100, Math.round((totalMinutes / 60 / subject.targetHours) * 100)) : 0;
                      const todayFocus = todayFocusEntries.find((entry) => entry.subjectId === subject.id);

                      return (
                        <Card key={subject.id} className={cn("rounded-2xl border shadow-sm", getSurfaceClass(darkMode))}>
                          <CardContent className="p-5">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3">
                                <div className="mt-1 h-4 w-4 rounded-full" style={{ backgroundColor: subject.color }} />
                                <div>
                                  <h3 className="font-semibold">{subject.name}</h3>
                                  <p className="text-sm text-muted-foreground">{group.name}</p>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button variant="outline" size="icon" onClick={() => setEditingSubject(subject)}><Pencil className="h-4 w-4" /></Button>
                                <Button variant="outline" size="icon" onClick={() => archiveSubject(subject.id)}><Trash2 className="h-4 w-4" /></Button>
                              </div>
                            </div>

                            <div className="mt-4 grid gap-2 text-sm">
                              <div className="flex items-center justify-between"><span className="text-muted-foreground">Offene Aufgaben</span><span>{openTasks}</span></div>
                              <div className="flex items-center justify-between"><span className="text-muted-foreground">Gelernte Zeit</span><span>{formatMinutes(totalMinutes)} / {subject.targetHours}h</span></div>
                            </div>

                            <div className="mt-4 space-y-2">
                              <div className="flex items-center justify-between text-sm"><span>Fortschritt</span><span>{progressValue}%</span></div>
                              <Progress value={progressValue} />
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                              <Button onClick={() => openTodaySubjectDialog(subject)} className="rounded-xl">
                                Heute lernen
                              </Button>
                              {todayFocus ? (
                                <Button variant="outline" onClick={() => removeTodaySubjectFocus(subject.id)} className="rounded-xl">
                                  Heute entfernen
                                </Button>
                              ) : null}
                            </div>

                            {todayFocus ? (
                              <div className="mt-3 rounded-xl border px-3 py-2 text-sm text-muted-foreground">
                                {todayFocus.note || "Für heute markiert"}
                              </div>
                            ) : null}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ))}

              <Card className={cn("rounded-2xl border shadow-sm", getSurfaceClass(darkMode))}>
                <button 
                  onClick={() => setArchiveCollapsed(!archiveCollapsed)}
                  className="w-full"
                >
                  <CardHeader>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold tracking-tight">Archiv</h3>
                        <Badge variant="outline">{archivedSubjects.length}</Badge>
                      </div>
                      <ChevronDown className={cn("h-5 w-5 transition-transform", archiveCollapsed && "-rotate-90")} />
                    </div>
                  </CardHeader>
                </button>
                
                {!archiveCollapsed && (
                  <CardContent className="grid gap-3 pt-0">
                    {archivedSubjects.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Keine archivierten Fächer vorhanden.</p>
                    ) : (
                      archivedSubjects.map((subject) => (
                        <div key={subject.id} className="flex items-center justify-between rounded-xl border px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: subject.color }} />
                            <span>{subject.name}</span>
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="rounded-lg h-8"
                              onClick={() => restoreSubject(subject.id)}
                            >
                              Wiederherstellen
                            </Button>
                            <Button 
                              variant="outline" 
                              size="icon"
                              className="h-8 w-8 rounded-lg text-red-600 hover:bg-red-50"
                              onClick={() => permanentlyDeleteSubject(subject.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                )}
              </Card>
            </div>
          ) : null}

          {page === "tasks" ? (
            <Tabs value={activeTaskTab} onValueChange={setActiveTaskTab} className="w-full">
              <TabsList className={cn("grid w-full grid-cols-2 rounded-2xl", darkMode ? "bg-[#2a3554]" : "bg-slate-200")}>
                <TabsTrigger value="tasks">Aufgaben</TabsTrigger>
                <TabsTrigger value="semester">Semester</TabsTrigger>
              </TabsList>

              <TabsContent value="tasks" className="mt-6">
            <div className="grid gap-6">
              <Card className={cn("rounded-2xl border shadow-sm", getSurfaceClass(darkMode))}>
                <CardContent className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
                  <div className="grid gap-2">
                    <Label>Fach</Label>
                    <Select value={taskFilter.subjectId} onValueChange={(value) => setTaskFilter({ ...taskFilter, subjectId: value })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Alle Fächer</SelectItem>
                        {data.subjects.map((subject) => <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Priorität</Label>
                    <Select value={taskFilter.priority} onValueChange={(value) => setTaskFilter({ ...taskFilter, priority: value })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Alle Prioritäten</SelectItem>
                        <SelectItem value="niedrig">Niedrig</SelectItem>
                        <SelectItem value="mittel">Mittel</SelectItem>
                        <SelectItem value="hoch">Hoch</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Status</Label>
                    <Select value={taskFilter.status} onValueChange={(value) => setTaskFilter({ ...taskFilter, status: value })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Alle Status</SelectItem>
                        <SelectItem value="offen">Offen</SelectItem>
                        <SelectItem value="in Bearbeitung">In Bearbeitung</SelectItem>
                        <SelectItem value="erledigt">Erledigt</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Sortierung</Label>
                    <Select value={taskFilter.sort} onValueChange={(value) => setTaskFilter({ ...taskFilter, sort: value })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="deadline">Nächste Deadline</SelectItem>
                        <SelectItem value="priority">Priorität</SelectItem>
                        <SelectItem value="subject">Fach</SelectItem>
                        <SelectItem value="created">Erstellungsdatum</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-6 xl:grid-cols-2">
                <Card className={cn("rounded-2xl border shadow-sm", getSurfaceClass(darkMode))}>
                  <CardHeader>
                    <CardTitle>Offene Aufgaben</CardTitle>
                    <CardDescription>Offen und in Bearbeitung</CardDescription>
                  </CardHeader>
                  <CardContent className="grid max-h-[780px] gap-4 overflow-y-auto pr-2">
                    {filteredTasks.filter((task) => task.status !== "erledigt").length === 0 ? (
                      <div className="rounded-2xl border p-6 text-center text-sm text-muted-foreground">
                        Keine offenen Aufgaben für die aktuelle Auswahl.
                      </div>
                    ) : (
                      filteredTasks
                        .filter((task) => task.status !== "erledigt")
                        .map((task) => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            subject={task.subject}
                            darkMode={darkMode}
                            onToggleDone={() => toggleTaskDone(task)}
                            onDelete={() => deleteTask(task.id)}
                            onEdit={() => setEditingTask(task)}
                          />
                        ))
                    )}
                  </CardContent>
                </Card>

                <Card className={cn("rounded-2xl border shadow-sm", getSurfaceClass(darkMode))}>
                  <CardHeader>
                    <CardTitle>Erledigte Aufgaben</CardTitle>
                    <CardDescription>Bereits abgeschlossen, aber noch nicht abgenommen</CardDescription>
                  </CardHeader>
                  <CardContent className="grid max-h-[780px] gap-4 overflow-y-auto pr-2">
                    {filteredTasks.filter((task) => task.status === "erledigt").length === 0 ? (
                      <div className="rounded-2xl border p-6 text-center text-sm text-muted-foreground">
                        Keine erledigten Aufgaben für die aktuelle Auswahl.
                      </div>
                    ) : (
                      filteredTasks
                        .filter((task) => task.status === "erledigt")
                        .map((task) => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            subject={task.subject}
                            darkMode={darkMode}
                            onToggleDone={() => toggleTaskDone(task)}
                            onDelete={() => deleteTask(task.id)}
                            onEdit={() => setEditingTask(task)}
                          />
                        ))
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card className={cn("rounded-2xl border shadow-sm", getSurfaceClass(darkMode))}>
                <CardHeader>
                  <button type="button" onClick={() => setShowArchive((prev) => !prev)} className="flex w-full items-center justify-between text-left">
                    <div>
                      <CardTitle>Archiv</CardTitle>
                      <CardDescription>Erledigt und abgenommen. Diese Aufgaben werden aus den normalen Listen ausgeblendet.</CardDescription>
                    </div>
                    <ChevronDown className={cn("h-5 w-5 transition-transform", showArchive ? "rotate-180" : "")} />
                  </button>
                </CardHeader>
                {showArchive ? (
                  <CardContent className="grid max-h-[640px] gap-4 overflow-y-auto pr-2">
                    {archivedTasks.length === 0 ? (
                      <div className="rounded-2xl border p-6 text-center text-sm text-muted-foreground">
                        Keine archivierten Aufgaben vorhanden.
                      </div>
                    ) : (
                      archivedTasks.map((task) => (
                        <div key={task.id} className="rounded-2xl border border-slate-200/70 p-4">
                          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: task.subject?.color || "#94a3b8" }} />
                                <p className="font-medium">{task.title}</p>
                                <Badge className="border-0 bg-slate-200 text-slate-950 ring-1 ring-slate-300">Archiviert</Badge>
                              </div>
                              <p className="mt-1 text-sm text-muted-foreground">{task.subject?.name || "Ohne Fach"}</p>
                              <p className="mt-1 text-sm text-muted-foreground">Abnahme: {formatDateDisplay(task.acceptanceDate)}</p>
                            </div>
                            <div className="flex gap-2">
                              <Button variant="outline" size="icon" onClick={() => setEditingTask(task)}><Pencil className="h-4 w-4" /></Button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                ) : null}
              </Card>
            </div>
            </TabsContent>

              <TabsContent value="semester" className="mt-6">
                <div className="grid gap-6">
                  {semesters.length === 0 ? (
                    <Card className={cn("rounded-2xl border shadow-sm", getSurfaceClass(darkMode))}>
                      <CardContent className="p-6 text-sm text-muted-foreground">Noch keine Semester angelegt.</CardContent>
                    </Card>
                  ) : (
                    <>
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        {semesters.map((semester) => {
                          if (!semester.start_date || !semester.end_date) {
                            return (
                              <Card key={semester.id} className={cn("rounded-2xl border shadow-sm", getSurfaceClass(darkMode))}>
                                <CardHeader>
                                  <CardTitle className="text-lg">{semester.name}</CardTitle>
                                  <CardDescription className="text-xs">Zeitraum noch nicht gesetzt</CardDescription>
                                </CardHeader>
                                <CardContent className="text-sm text-muted-foreground">
                                  Bitte bearbeiten Sie das Semester, um die Daten festzulegen.
                                </CardContent>
                              </Card>
                            );
                          }

                          try {
                            const semesterSubjects = data.subjects?.filter((s) => s && (s.semesterId === semester.id || s.groupId === semester.id)) || [];
                            const semesterTasks = data.tasks?.filter((t) => t && (t.semesterId === semester.id)) || [];
                            const semesterMinutes = data.studySessions
                              ?.filter((s) => s && semesterSubjects.some((sub) => sub && sub.id === s.subjectId))
                              .reduce((sum, s) => sum + (s?.durationMinutes || 0), 0) || 0;
                            const startDate = new Date(semester.start_date);
                            const endDate = new Date(semester.end_date);
                            
                            if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
                              return (
                                <Card key={semester.id} className={cn("rounded-2xl border shadow-sm", getSurfaceClass(darkMode))}>
                                  <CardHeader>
                                    <CardTitle className="text-lg">{semester.name}</CardTitle>
                                    <CardDescription className="text-xs">Ungültige Daten</CardDescription>
                                  </CardHeader>
                                  <CardContent className="text-sm text-muted-foreground">
                                    Die Semester-Daten sind ungültig.
                                  </CardContent>
                                </Card>
                              );
                            }

                            const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
                            const remainingDays = Math.ceil((endDate - new Date()) / (1000 * 60 * 60 * 24));
                            const progress = totalDays > 0 ? Math.max(0, Math.min(100, Math.round(((totalDays - remainingDays) / totalDays) * 100))) : 0;

                            return (
                              <Card key={semester.id} className={cn("rounded-2xl border shadow-sm", getSurfaceClass(darkMode))}>
                                <CardHeader>
                                  <CardTitle className="text-lg">{semester.name}</CardTitle>
                                  <CardDescription className="text-xs">
                                    {formatDateDisplay(semester.start_date)} - {formatDateDisplay(semester.end_date)}
                                  </CardDescription>
                                </CardHeader>
                                <CardContent className="grid gap-3 text-sm">
                                  <div className="rounded-lg border p-3">
                                    <p className="text-muted-foreground">Fächer</p>
                                    <p className="font-semibold">{semesterSubjects.length}</p>
                                  </div>
                                  <div className="rounded-lg border p-3">
                                    <p className="text-muted-foreground">Aufgaben</p>
                                    <p className="font-semibold">{semesterTasks.length}</p>
                                  </div>
                                  <div className="rounded-lg border p-3">
                                    <p className="text-muted-foreground">Lernzeit</p>
                                    <p className="font-semibold">{formatMinutes(semesterMinutes)}</p>
                                  </div>
                                  <div className="rounded-lg border p-3">
                                    <p className="text-muted-foreground">Resttage</p>
                                    <p className="font-semibold">{remainingDays >= 0 ? remainingDays : `${Math.abs(remainingDays)} vorbei`}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-2">Fortschritt: {progress}%</p>
                                    <Progress value={progress} className="h-2" />
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          } catch (err) {
                            console.error("Error rendering semester card:", err);
                            return (
                              <Card key={semester.id} className={cn("rounded-2xl border shadow-sm", getSurfaceClass(darkMode))}>
                                <CardHeader>
                                  <CardTitle className="text-lg">{semester.name}</CardTitle>
                                </CardHeader>
                                <CardContent className="text-sm text-red-600">
                                  Fehler beim Laden der Semester-Daten.
                                </CardContent>
                              </Card>
                            );
                          }
                        })}
                      </div>
                    </>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          ) : null}

          {page === "tracking" ? (
            <div className="grid gap-6">
              <Card className={cn("rounded-2xl border shadow-sm", getSurfaceClass(darkMode))}>
                <CardHeader>
                  <CardTitle>Lernzeiterfassung</CardTitle>
                  <CardDescription>Alle erfassten Lerneinheiten in zeitlicher Reihenfolge</CardDescription>
                </CardHeader>
                <CardContent className="grid max-h-[980px] gap-3 overflow-y-auto pr-2">
                  {lastDeletedSession ? (
                    <div className={cn("flex flex-col gap-3 rounded-2xl border p-4 md:flex-row md:items-center md:justify-between", darkMode ? "border-amber-500/30 bg-amber-500/10" : "border-amber-300 bg-amber-50")}>
                      <div>
                        <p className="font-medium">Lerneinheit gelöscht</p>
                        <p className="text-sm text-muted-foreground">{lastDeletedSession.subjectId && subjectsById[lastDeletedSession.subjectId]?.name ? subjectsById[lastDeletedSession.subjectId].name : "Eintrag"} · {formatMinutes(lastDeletedSession.durationMinutes)}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="secondary" onClick={undoDeleteStudySession}>Undo</Button>
                        <Button variant="ghost" onClick={() => setLastDeletedSession(null)}>Schließen</Button>
                      </div>
                    </div>
                  ) : null}
                  {trackedSessions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Noch keine Lernzeiten erfasst.</p>
                  ) : (
                    trackedSessions.map((session) => (
                      <div key={session.id} className="flex flex-col gap-3 rounded-2xl border p-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-start gap-3">
                          <div className="mt-1 h-3 w-3 rounded-full" style={{ backgroundColor: session.subject?.color || "#94a3b8" }} />
                          <div>
                            <p className="font-medium">{session.subject?.name || "Unbekanntes Fach"}</p>
                            <p className="text-sm text-muted-foreground">{formatDateTimeDisplay(session.createdAt)}</p>
                            <p className="text-sm text-muted-foreground">{session.note || "Ohne Notiz"}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">{formatMinutes(session.durationMinutes)}</Badge>
                          <Badge variant="outline">{session.source || "Eintrag"}</Badge>
                          <Button variant="outline" size="icon" onClick={() => setEditingSession(session)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="outline" size="icon" onClick={() => deleteStudySession(session.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}

          {page === "stats" ? (
            <div className="grid gap-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><StatCard darkMode={darkMode} title="Gesamtlernzeit" value={formatMinutes(studyStats.total)} sub="Über alle Fächer" icon={Clock3} /><StatCard darkMode={darkMode} title="Heute" value={formatMinutes(studyStats.todayMinutes)} sub="Heutige Lernzeit" icon={CalendarClock} /><StatCard darkMode={darkMode} title="Durchschnitt / Tag" value={formatMinutes(studyStats.dailyAverage)} sub="Über aktive Lerntage" icon={BarChart3} /><StatCard darkMode={darkMode} title="Durchschnitt / Woche" value={formatMinutes(studyStats.weeklyAverage * 7)} sub="Auf Basis dieser Woche" icon={BookOpen} /></div>
              <div className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]"><Card className={cn("rounded-2xl border shadow-sm", getSurfaceClass(darkMode))}><CardHeader><CardTitle>Wochenübersicht</CardTitle><CardDescription>Lernstunden pro Tag in dieser Woche</CardDescription></CardHeader><CardContent className="h-[320px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={studyStats.weekLine} margin={{ top: 28, right: 12, left: 0, bottom: 8 }}><CartesianGrid strokeDasharray="3 3" opacity={0.15} /><XAxis dataKey="day" /><YAxis /><Tooltip formatter={(value) => formatMinutes(Math.round(Number(value) * 60))} /><Line type="monotone" dataKey="Stunden" stroke="#6366f1" strokeWidth={3} dot={{ r: 4 }} label={(props) => <LinePointLabel {...props} darkMode={darkMode} />} /></LineChart></ResponsiveContainer></CardContent></Card><Card className={cn("rounded-2xl border shadow-sm", getSurfaceClass(darkMode))}><CardHeader><CardTitle>Verteilung der Lernzeit</CardTitle><CardDescription>Alle Fächer bleiben in der Statistik sichtbar</CardDescription></CardHeader><CardContent className="grid gap-4 xl:grid-cols-[1fr_220px]"><div className="h-[320px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={studyStats.bySubject} dataKey="minutes" nameKey="name" innerRadius={65} outerRadius={100} paddingAngle={3}>{studyStats.bySubject.map((entry, index) => <Cell key={index} fill={entry.color} />)}</Pie><Tooltip formatter={(value) => formatMinutes(Number(value))} /></PieChart></ResponsiveContainer></div><div className="grid content-start gap-2">{studyStats.bySubject.map((subject) => <div key={subject.id} className="flex items-center justify-between rounded-xl border p-3 text-sm"><div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: subject.color }} /><span>{subject.name}</span></div><span className="font-medium">{formatMinutes(subject.minutes)}</span></div>)}</div></CardContent></Card></div>
              <Card className={cn("rounded-2xl border shadow-sm", getSurfaceClass(darkMode))}><CardHeader><CardTitle>Stunden pro Fach</CardTitle><CardDescription>Direkter Vergleich der Lernzeit</CardDescription></CardHeader><CardContent className="h-[390px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={studyStats.bySubject} margin={{ top: 42, right: 12, left: 0, bottom: 24 }}><CartesianGrid strokeDasharray="3 3" opacity={0.15} /><XAxis dataKey="name" axisLine={false} tickLine={false} interval={0} height={62} tick={(props) => <SubjectAxisTick {...props} darkMode={darkMode} />} /><YAxis domain={[0, "dataMax + 4"]} /><Tooltip formatter={(_value, _name, item) => [formatMinutes(item?.payload?.minutes || 0), item?.payload?.name || "Lernzeit"]} /><Bar dataKey="hours" radius={[8, 8, 0, 0]}>{studyStats.bySubject.map((entry, index) => <Cell key={index} fill={entry.color} />)}<LabelList position="top" dataKey="hours" content={(props) => <BarTopLabel {...props} darkMode={darkMode} />} /></Bar></BarChart></ResponsiveContainer></CardContent></Card>
            </div>
          ) : null}

          <Dialog open={todaySubjectDialogOpen} onOpenChange={setTodaySubjectDialogOpen}>
            <DialogContent className="max-w-lg rounded-3xl">
              <DialogHeader><DialogTitle>Heute lernen</DialogTitle></DialogHeader>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Fach</Label>
                  <Select value={todaySubjectDraft.subjectId} onValueChange={(value) => setTodaySubjectDraft((prev) => ({ ...prev, subjectId: value }))}>
                    <SelectTrigger><SelectValue placeholder="Fach wählen" /></SelectTrigger>
                    <SelectContent>{data.subjects.map((subject) => <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Notiz (optional)</Label>
                  <Textarea value={todaySubjectDraft.note} onChange={(e) => setTodaySubjectDraft((prev) => ({ ...prev, note: e.target.value }))} placeholder="z. B. 30 Minuten Wiederholung oder Übungsblatt 2" />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setTodaySubjectDialogOpen(false)}>Abbrechen</Button>
                  <Button onClick={saveTodaySubjectFocus}>Für heute speichern</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={semesterDialogOpen} onOpenChange={(open) => { setSemesterDialogOpen(open); if (!open) setEditingSemester(null); }}>
            <DialogContent className="max-w-xl rounded-3xl">
              <DialogHeader><DialogTitle>{editingSemester ? "Semester bearbeiten" : "Semester anlegen"}</DialogTitle></DialogHeader>
              <SemesterForm initialValue={editingSemester} onSave={saveSemesterRecord} onDone={() => { setSemesterDialogOpen(false); setEditingSemester(null); }} />
            </DialogContent>
          </Dialog>

          <Dialog open={!!editingSubject} onOpenChange={(open) => !open && setEditingSubject(null)}><DialogContent className="max-w-xl rounded-3xl"><DialogHeader><DialogTitle>Fach bearbeiten</DialogTitle></DialogHeader>{editingSubject ? <SubjectForm initialValue={editingSubject} onSave={saveSubject} onDone={() => setEditingSubject(null)} semesters={semesters} /> : null}</DialogContent></Dialog>
          <Dialog open={!!editingTask} onOpenChange={(open) => !open && setEditingTask(null)}><DialogContent className="max-w-2xl rounded-3xl"><DialogHeader><DialogTitle>Aufgabe bearbeiten</DialogTitle></DialogHeader>{editingTask ? <TaskForm subjects={data.subjects} initialValue={editingTask} onSave={saveTask} onDone={() => setEditingTask(null)} /> : null}</DialogContent></Dialog>
          <ManualStudyDialog
            open={!!editingSession}
            onOpenChange={(open) => !open && setEditingSession(null)}
            subjects={data.subjects}
            darkMode={darkMode}
            selectedSubjectId={editingSession?.subjectId || data.subjects[0]?.id || ""}
            onSelectedSubjectChange={(value) => setEditingSession((prev) => prev ? { ...prev, subjectId: value } : prev)}
            onSaveEntry={saveStudySession}
            initialValue={editingSession ? buildSessionSeedFromEntry(editingSession) : null}
            title="Lerneinheit bearbeiten"
            submitLabel="Änderungen speichern"
          />
                  <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className={cn(
              "fixed bottom-6 right-6 z-50 inline-flex items-center gap-2 rounded-full border px-4 py-3 text-sm font-semibold shadow-lg transition hover:-translate-y-0.5",
              darkMode
                ? "border-slate-700 bg-slate-900 text-white hover:bg-slate-800"
                : "border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
            )}
          >
            <ChevronUp className="h-4 w-4" />
            Nach oben
          </button>
          </main>
        </div>
      </div>
      {themeDock}
    </div>
  );
}
