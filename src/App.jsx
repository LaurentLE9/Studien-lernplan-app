import React, { useEffect, useMemo, useRef, useState } from "react";
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
  Clock3,
  GraduationCap,
  HelpCircle,
  LayoutDashboard,
  ListTodo,
  Maximize2,
  Moon,
  Pause,
  Pencil,
  Play,
  Plus,
  Search,
  Sun,
  Trash2,
  X,
} from "lucide-react";
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
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
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

function usePersistentState() {
  const [data, setData] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return {
          subjects: makeInitialSubjects(),
          tasks: [],
          studySessions: [],
          settings: { darkMode: true },
          seeds: { tasks: false, sessions: false },
        };
      }
      const parsed = JSON.parse(raw);
      return {
        subjects: parsed.subjects?.length ? parsed.subjects : makeInitialSubjects(),
        tasks: parsed.tasks || [],
        studySessions: parsed.studySessions || [],
        settings: { darkMode: true, ...(parsed.settings || {}) },
        seeds: { tasks: false, sessions: false, ...(parsed.seeds || {}) },
      };
    } catch {
      return {
        subjects: makeInitialSubjects(),
        tasks: [],
        studySessions: [],
        settings: { darkMode: true },
        seeds: { tasks: false, sessions: false },
      };
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  return [data, setData];
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
    <div className={cn("rounded-[1.75rem] border p-5", darkMode ? "border-slate-800 bg-[#1b2237] text-slate-100" : "border-slate-200 bg-slate-50 text-slate-900")}>
      <div className="grid gap-5 sm:grid-cols-3">
        {overview.map((item) => {
          const progress = Math.min(100, Math.round((item.value / item.target) * 100));
          return (
            <div key={item.label}>
              <p className={cn("text-lg font-medium", darkMode ? "text-slate-300" : "text-slate-600")}>{item.label}</p>
              <div className="mt-1 flex items-center gap-2">
                <CalendarClock className={cn("h-4 w-4", darkMode ? "text-slate-400" : "text-slate-500")} />
                <span className="text-2xl font-bold tracking-tight">{formatMinutesCompact(item.value)}</span>
              </div>
              <div className={cn("mt-3 h-3 overflow-hidden rounded-full", darkMode ? "bg-slate-700/70" : "bg-slate-200")}>
                <div
                  className={cn("h-full rounded-full transition-all", item.value ? "bg-emerald-500" : darkMode ? "bg-slate-600" : "bg-slate-300")}
                  style={{ width: `${Math.max(item.value ? 10 : 0, progress)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6">
        <div className="mb-4 flex items-center gap-2">
          <div className={cn("h-0 w-0 border-l-[5px] border-r-[5px] border-t-[7px] border-l-transparent border-r-transparent", darkMode ? "border-t-slate-400" : "border-t-slate-500")} />
          <h3 className={cn("text-2xl font-semibold tracking-tight", darkMode ? "text-white" : "text-slate-900")}>Erfolgsserie</h3>
        </div>
        <div className="grid grid-cols-7 gap-3 text-center">
          {studyStats.streakDays.map((day) => (
            <div key={day.key} className="grid gap-3">
              <span className={cn("text-lg font-medium", darkMode ? "text-slate-300" : "text-slate-600")}>{day.label}</span>
              <div className={cn(
                "mx-auto flex h-11 w-11 items-center justify-center rounded-full ring-1",
                day.status === "done" && "bg-emerald-500/20 text-emerald-300 ring-emerald-500/40",
                day.status === "missed" && "bg-red-500/20 text-red-300 ring-red-500/40",
                day.status === "open" && "bg-blue-500/20 text-blue-300 ring-blue-500/40",
                day.status === "upcoming" && (darkMode ? "bg-slate-500/20 text-slate-300 ring-slate-500/30" : "bg-slate-200 text-slate-600 ring-slate-300")
              )}>
                {day.status === "done" ? <Check className="h-5 w-5" /> : day.status === "missed" ? <X className="h-5 w-5" /> : <HelpCircle className="h-5 w-5" />}
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

function SubjectHoursChart({ data, darkMode }) {
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
    <div className={cn("rounded-[1.75rem] border p-6 shadow-xl", chartBg)}>
      <div className="mb-6 flex items-center gap-3">
        <h3 className={cn("flex items-center gap-2 text-2xl font-bold", darkMode ? "text-white" : "text-slate-900")}>
          Fächer <span className="text-xl font-normal text-slate-500">• {chartData.length}</span>
        </h3>
        <ChevronRight className={darkMode ? "text-slate-500" : "text-slate-400"} size={20} />
        <button className={cn("ml-1 flex h-8 w-8 items-center justify-center rounded-full border transition-colors", darkMode ? "border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200" : "border-slate-300 text-slate-500 hover:bg-slate-100 hover:text-slate-700")}> 
          <HelpCircle size={16} />
        </button>
      </div>

      <div className={cn("mx-auto mb-8 flex max-w-md rounded-2xl p-1", tabBg)}>
        {["diagramm", "tabelle"].map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={cn("flex-1 rounded-xl py-2.5 text-sm font-bold transition-all", activeTab === tab ? activeTabBg : inactiveTabText)}>
            {tab === "diagramm" ? "Diagramm" : "Tabelle"}
          </button>
        ))}
      </div>

      {activeTab === "diagramm" ? (
        <div className="relative h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 28, right: 20, left: 12, bottom: 68 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={lineColor} stopOpacity={0.22} />
                  <stop offset="95%" stopColor={lineColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} opacity={0.3} />
              <XAxis dataKey="shortName" axisLine={false} tickLine={false} tick={{ fill: xTickColor, fontSize: 11, fontWeight: 500 }} dy={18} angle={-45} textAnchor="end" height={80} />
              <YAxis hide domain={[0, "dataMax + 4"]} />
              <Tooltip
                contentStyle={{
                  borderRadius: 14,
                  border: darkMode ? "1px solid #334155" : "1px solid #cbd5e1",
                  backgroundColor: darkMode ? "#0f172a" : "#ffffff",
                  color: darkMode ? "#f8fafc" : "#0f172a",
                }}
                formatter={(value, _name, item) => [`${value} h`, item?.payload?.name || "Lernzeit"]}
                labelFormatter={(label, payload) => payload?.[0]?.payload?.name || label}
              />
              <Area type="linear" dataKey="learnedHours" stroke={lineColor} strokeWidth={3} fillOpacity={1} fill={`url(#${gradientId})`} activeDot={{ r: 5, fill: lineColor, stroke: darkMode ? "#ffffff" : "#0f172a", strokeWidth: 2 }} label={(props) => <ChartValueLabel {...props} color={lineColor} strokeColor={labelStroke} />} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="grid gap-3">
          {chartData.map((subject) => {
            const percent = subject.targetHours ? Math.round((subject.hours / subject.targetHours) * 100) : 0;
            return (
              <div key={subject.id} className={cn("grid grid-cols-[24px_1fr_110px_150px_24px] items-center gap-4 rounded-xl border px-4 py-3 text-sm", darkMode ? "border-slate-700 bg-[#232735]" : "border-slate-200 bg-white")}>
                <ChevronRight className="h-4 w-4 text-slate-400" />
                <div className="min-w-0">
                  <span className="inline-flex max-w-full rounded-full px-3 py-2 font-semibold text-slate-900" style={{ backgroundColor: subject.color }}>
                    {subject.name.length > 22 ? `${subject.name.substring(0, 22)}...` : subject.name}
                  </span>
                </div>
                <div className={cn("font-semibold", darkMode ? "text-white" : "text-slate-900")}>
                  {subject.minutes ? formatMinutesAsHourComma(subject.minutes) : "–"} / {subject.targetHours}h
                </div>
                <div className="flex items-center gap-3">
                  <div className={cn("h-3 flex-1 overflow-hidden rounded-full", darkMode ? "bg-slate-700" : "bg-slate-200")}>
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, percent)}%` }} />
                  </div>
                  <span className="w-10 text-right font-semibold">{percent}%</span>
                </div>
                <button className="text-slate-400">•••</button>
              </div>
            );
          })}
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

function DashboardQuickActions({ subjects, onSaveSession, darkMode }) {
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
  const [manualSubjectId, setManualSubjectId] = useState(storedTimer.manualSubjectId || subjects[0]?.id || "");
  const [timerSubjectId, setTimerSubjectId] = useState(storedTimer.timerSubjectId || subjects[0]?.id || "");
  const [timerMode, setTimerMode] = useState(storedTimer.timerMode || "stopwatch");
  const [timerPreset, setTimerPreset] = useState(storedTimer.timerPreset || 90);
  const [seconds, setSeconds] = useState(Number(storedTimer.seconds || 0));
  const [running, setRunning] = useState(Boolean(storedTimer.running));
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
      seconds,
      running,
    }));
  }, [manualSubjectId, timerSubjectId, timerMode, timerPreset, seconds, running]);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setSeconds((prev) => (timerMode === "pomodoro" ? Math.max(0, prev - 1) : prev + 1));
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [running, timerMode]);

  useEffect(() => {
    if (timerMode === "pomodoro" && running && seconds === 0) {
      onSaveSession({
        id: crypto.randomUUID(),
        subjectId: timerSubjectId,
        durationMinutes: timerPreset,
        createdAt: new Date().toISOString(),
        source: "pomodoro",
        note: `Pomodoro ${timerPreset} Minuten`,
      });
      setRunning(false);
    }
  }, [seconds, running, timerMode, timerPreset, timerSubjectId, onSaveSession]);

  function openManualWithSeed(subjectId, seed = null) {
    setManualSubjectId(subjectId || subjects[0]?.id || "");
    setManualSeed(seed);
    setManualDialogOpen(true);
  }

  function openRunningTimerForManualEdit({ pauseFirst = false } = {}) {
    const now = new Date();
    const durationMinutes = timerMode === "pomodoro"
      ? Math.max(1, Math.round(((timerPreset * 60) - seconds) / 60))
      : Math.max(1, Math.round(seconds / 60));
    const start = new Date(now.getTime() - Math.max(0, durationMinutes) * 60000);
    if (pauseFirst) {
      setRunning(false);
    }
    openManualWithSeed(timerSubjectId, {
      date: formatDateInput(now),
      startTime: toTimeInputValue(start),
      endTime: toTimeInputValue(now),
      breakMinutes: "0",
      activity: timerMode === "pomodoro" ? "Pomodoro" : "Stoppuhr",
      note: timerMode === "pomodoro" ? `Pomodoro ${timerPreset} Minuten` : "Stoppuhr-Sitzung",
      source: timerMode,
    });
  }

  function startQuickTimer() {
    if (!timerSubjectId) return;
    if (timerMode === "pomodoro") {
      setSeconds((prev) => (prev === 0 ? timerPreset * 60 : prev));
    }
    setRunning(true);
    setTimerOpen(false);
  }

  function pauseQuickTimer() {
    setRunning(false);
  }

  function stopQuickTimer(save = true) {
    setRunning(false);
    clearInterval(intervalRef.current);
    const minutes = timerMode === "pomodoro"
      ? Math.max(1, Math.round(((timerPreset * 60) - seconds) / 60))
      : Math.max(1, Math.round(seconds / 60));
    const hasTime = timerMode === "pomodoro" ? (timerPreset * 60) - seconds > 0 : seconds > 0;
    if (save && hasTime && timerSubjectId) {
      onSaveSession({
        id: crypto.randomUUID(),
        subjectId: timerSubjectId,
        durationMinutes: minutes,
        createdAt: new Date().toISOString(),
        source: timerMode,
        note: timerMode === "pomodoro" ? `Pomodoro ${timerPreset} Minuten` : "Stoppuhr-Sitzung",
      });
    }
    setSeconds(0);
  }

  const timerDisplay = `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const timerSubject = subjects.find((subject) => subject.id === timerSubjectId);

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
                        <Button key={preset} type="button" variant={timerPreset === preset ? "default" : "secondary"} className={cn("rounded-xl", timerPreset === preset ? "bg-blue-600 hover:bg-blue-500" : "")} onClick={() => { setTimerPreset(preset); if (!running) setSeconds(preset * 60); }}>{preset}</Button>
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
                      const isSelected = timerSubjectId === subject.id;
                      return (
                        <button key={subject.id} type="button" onClick={() => setTimerSubjectId(subject.id)} className={cn("flex items-center justify-between rounded-full px-4 py-2.5 text-left text-sm font-semibold text-slate-950 transition", isSelected ? "ring-2 ring-white/80 ring-offset-2 ring-offset-transparent opacity-100" : "opacity-90")} style={{ backgroundColor: subject.color }}>
                          <span>{subject.name}</span>
                          {isSelected ? <Check className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex gap-2">
                    {!running ? (
                      <Button type="button" onClick={startQuickTimer} className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-500" disabled={!timerSubjectId}>
                        <Play className="mr-2 h-4 w-4" />{timerMode === "pomodoro" ? "Pomodoro starten" : "Stoppuhr starten"}
                      </Button>
                    ) : (
                      <Button type="button" variant="secondary" onClick={pauseQuickTimer} className="flex-1 rounded-xl"><Pause className="mr-2 h-4 w-4" />Pause</Button>
                    )}
                    <Button type="button" variant="outline" onClick={() => openManualWithSeed(timerSubjectId || subjects[0]?.id || "", { source: timerMode })} className="rounded-xl">Manuell</Button>
                  </div>
                </div>
              </Tabs>
            </div>
          ) : null}
        </div>
      </div>

      {(running || seconds > 0) ? (
        <div className="fixed left-1/2 top-4 z-[80] -translate-x-1/2">
          <div className={cn("flex items-center gap-3 rounded-full border px-4 py-3 shadow-2xl", floatingClass)}>
            <button type="button" onClick={() => openRunningTimerForManualEdit({ pauseFirst: true })} className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-500"><Pause className="h-4 w-4" /></button>
            <button type="button" onClick={() => openRunningTimerForManualEdit({ pauseFirst: false })} className="flex items-center gap-3"><span className="h-3 w-3 rounded-full bg-emerald-400" /><span className="font-semibold">{timerSubject?.name || "Fach"}</span><span className="font-mono text-lg font-semibold">{timerDisplay}</span></button>
            <button type="button" onClick={() => openRunningTimerForManualEdit({ pauseFirst: false })} className="text-slate-400 hover:text-slate-200"><Maximize2 className="h-4 w-4" /></button>
            <button type="button" onClick={() => stopQuickTimer(true)} className="text-slate-400 hover:text-slate-200"><X className="h-4 w-4" /></button>
          </div>
        </div>
      ) : null}

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

function SubjectForm({ onSave, initialValue, onDone }) {
  const [form, setForm] = useState(initialValue || { name: "", color: "#3b82f6", description: "", semester: "", goal: "", targetHours: 30 });
  return (
    <div className="grid gap-4">
      <div className="grid gap-2"><Label>Fachname</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-4"><div className="grid gap-2"><Label>Farbe</Label><input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="h-10 w-full rounded-md border bg-transparent" /></div><div className="grid gap-2"><Label>Zielstunden</Label><Input type="number" value={form.targetHours} onChange={(e) => setForm({ ...form, targetHours: Number(e.target.value) || 0 })} /></div></div>
      <div className="grid gap-2"><Label>Beschreibung</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
      <div className="grid gap-2"><Label>Semester</Label><Input value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })} /></div>
      <div className="grid gap-2"><Label>Ziel / Notiz</Label><Textarea value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} /></div>
      <div className="flex justify-end gap-2">{onDone ? <Button variant="outline" onClick={onDone}>Abbrechen</Button> : null}<Button onClick={() => { if (!form.name.trim()) return; onSave({ ...initialValue, ...form }); onDone?.(); }}>Speichern</Button></div>
    </div>
  );
}

function TaskForm({ subjects, onSave, initialValue, onDone }) {
  const [form, setForm] = useState(initialValue || { title: "", description: "", subjectId: subjects[0]?.id || "", createdAt: formatDateInput(new Date()), dueDate: "", acceptanceDate: "", priority: "mittel", status: "offen", flaggedToday: false, urgent: false });
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
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="flex items-center justify-between rounded-xl border p-3"><span className="text-sm">Heute lernen</span><Switch checked={form.flaggedToday} onCheckedChange={(checked) => setForm({ ...form, flaggedToday: checked })} /></label>
        <label className="flex items-center justify-between rounded-xl border p-3"><span className="text-sm">Dringend markieren</span><Switch checked={form.urgent} onCheckedChange={(checked) => setForm({ ...form, urgent: checked })} /></label>
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
              {task.nextRelevantDate ? <Badge className={cn("border-0", deadlineTone(task.nextRelevantDate, task.status))}>{task.nextRelevantType}: {deadlineLabel(task.nextRelevantDate, task.status)}</Badge> : null}
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
  const [page, setPage] = useState("dashboard");
  const [search, setSearch] = useState("");
  const [showCompletedDeadlines, setShowCompletedDeadlines] = useState(false);
  const [taskFilter, setTaskFilter] = useState({ subjectId: "all", priority: "all", status: "all", sort: "deadline" });
  const [subjectDialogOpen, setSubjectDialogOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [editingSession, setEditingSession] = useState(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", data.settings.darkMode);
    document.documentElement.style.colorScheme = data.settings.darkMode ? "dark" : "light";
    document.body.classList.toggle("dark", data.settings.darkMode);
  }, [data.settings.darkMode]);

  useEffect(() => {
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
  }, [data.seeds.tasks, data.seeds.sessions, setData]);

  const subjectsById = useMemo(() => Object.fromEntries(data.subjects.map((s) => [s.id, s])), [data.subjects]);

  const enhancedTasks = useMemo(() => data.tasks.map((task) => {
    const nextMilestone = getNextTaskMilestone(task);
    return {
      ...task,
      daysLeft: nextMilestone?.date ? daysUntil(nextMilestone.date) : null,
      nextRelevantDate: nextMilestone?.date || null,
      nextRelevantType: nextMilestone?.label || null,
      subject: subjectsById[task.subjectId],
    };
  }), [data.tasks, subjectsById]);

  const filteredTasks = useMemo(() => {
    let list = [...enhancedTasks];
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
    const open = enhancedTasks.filter((t) => t.status !== "erledigt").length;
    const done = enhancedTasks.filter((t) => t.status === "erledigt").length;
    const overdue = enhancedTasks.filter((t) => t.status !== "erledigt" && t.nextRelevantDate && t.daysLeft < 0).length;
    const dueSoon = enhancedTasks.filter((t) => t.status !== "erledigt" && t.nextRelevantDate && t.daysLeft >= 0 && t.daysLeft <= 3).length;
    const nextDeadlines = [...enhancedTasks].filter((t) => t.status !== "erledigt" && t.nextRelevantDate).sort((a, b) => new Date(a.nextRelevantDate) - new Date(b.nextRelevantDate)).slice(0, 5);
    const completedDeadlines = [...enhancedTasks].filter((t) => t.status === "erledigt" && t.nextRelevantDate).sort((a, b) => new Date(a.nextRelevantDate) - new Date(b.nextRelevantDate));
    return { open, done, overdue, dueSoon, nextDeadlines, completedDeadlines };
  }, [enhancedTasks]);

  const trackedSessions = useMemo(() => {
    return [...data.studySessions]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map((session) => ({
        ...session,
        subject: subjectsById[session.subjectId],
      }));
  }, [data.studySessions, subjectsById]);

  function saveSubject(subject) {
    setData((prev) => ({
      ...prev,
      subjects: prev.subjects.some((s) => s.id === subject.id)
        ? prev.subjects.map((s) => (s.id === subject.id ? subject : s))
        : [...prev.subjects, { ...subject, id: crypto.randomUUID() }],
    }));
    setEditingSubject(null);
  }

  function deleteSubject(id) {
    setData((prev) => ({
      ...prev,
      subjects: prev.subjects.filter((s) => s.id !== id),
      tasks: prev.tasks.filter((t) => t.subjectId !== id),
      studySessions: prev.studySessions.filter((s) => s.subjectId !== id),
    }));
  }

  function saveTask(task) {
    setData((prev) => ({
      ...prev,
      tasks: prev.tasks.some((t) => t.id === task.id)
        ? prev.tasks.map((t) => (t.id === task.id ? task : t))
        : [...prev.tasks, { ...task, id: crypto.randomUUID() }],
    }));
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
    setData((prev) => ({
      ...prev,
      studySessions: prev.studySessions.filter((session) => session.id !== id),
    }));
  }

  function toggleTaskDone(task) {
    saveTask({ ...task, status: task.status === "erledigt" ? "offen" : "erledigt" });
  }

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "subjects", label: "Fächer", icon: GraduationCap },
    { id: "tasks", label: "Aufgaben", icon: ListTodo },
    { id: "tracking", label: "Lernzeiterfassung", icon: Clock3 },
    { id: "stats", label: "Statistik", icon: BarChart3 },
  ];

  return (
    <div className={cn("min-h-screen transition-colors", data.settings.darkMode ? "dark bg-slate-950 text-slate-50" : "bg-slate-50 text-slate-900")}>
      <div className="mx-auto grid min-h-screen max-w-7xl lg:grid-cols-[260px_1fr]">
        <aside className={cn("border-r p-4 backdrop-blur", data.settings.darkMode ? "border-slate-800 bg-slate-900/80" : "border-slate-200 bg-white/80")}>
          <div className="flex items-center gap-3 px-2 py-3">
            <div className="rounded-2xl bg-primary/10 p-2 text-primary"><BookOpen className="h-5 w-5" /></div>
            <div><p className="text-sm text-muted-foreground">Study Planner</p><h1 className="text-lg font-semibold tracking-tight">Studien- & Lernplan</h1></div>
          </div>
          <nav className="mt-6 grid gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button key={item.id} onClick={() => setPage(item.id)} className={cn("flex items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm transition", page === item.id ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
                  <Icon className="h-4 w-4" />{item.label}
                </button>
              );
            })}
          </nav>
          <Separator className="my-5" />
          <div className={cn("grid gap-3 rounded-3xl border p-4 shadow-sm", getSoftSurfaceClass(data.settings.darkMode))}>
            <div className="flex items-center justify-between"><div><p className="text-sm font-medium">Dark Mode</p><p className="text-xs text-muted-foreground">Reduziertes, ruhiges Layout</p></div><Switch checked={data.settings.darkMode} onCheckedChange={(checked) => setData((prev) => ({ ...prev, settings: { ...prev.settings, darkMode: checked } }))} /></div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">{data.settings.darkMode ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}{data.settings.darkMode ? "Dunkles Design aktiv" : "Helles Design aktiv"}</div>
          </div>
        </aside>

        <main className="p-4 md:p-6 lg:p-8">
          <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">{navItems.find((n) => n.id === page)?.label}</h2>
              <p className="text-sm text-muted-foreground">Klare Übersicht über Fächer, Aufgaben und Lernzeiten</p>
            </div>

            <div className="flex w-full max-w-[920px] flex-col gap-3 xl:items-end">
              <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-end">
                <div className="relative w-full lg:w-80 xl:w-96">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Suchen nach Aufgabe oder Fach" className="pl-9" />
                </div>
                <DashboardQuickActions subjects={data.subjects} onSaveSession={saveStudySession} darkMode={data.settings.darkMode} />
              </div>

              <div className="flex w-full flex-wrap gap-3 lg:justify-end">
                <Dialog open={subjectDialogOpen} onOpenChange={setSubjectDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="rounded-xl"><Plus className="mr-2 h-4 w-4" />Fach</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-xl rounded-3xl">
                    <DialogHeader><DialogTitle>Fach anlegen</DialogTitle></DialogHeader>
                    <SubjectForm onSave={saveSubject} onDone={() => setSubjectDialogOpen(false)} />
                  </DialogContent>
                </Dialog>

                <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="rounded-xl"><Plus className="mr-2 h-4 w-4" />Aufgabe</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl rounded-3xl">
                    <DialogHeader><DialogTitle>Aufgabe anlegen</DialogTitle></DialogHeader>
                    <TaskForm subjects={data.subjects} onSave={saveTask} onDone={() => setTaskDialogOpen(false)} />
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>

          {page === "dashboard" ? (
            <div className="grid gap-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <StatCard darkMode={data.settings.darkMode} title="Offene Aufgaben" value={taskSummary.open} sub="Noch nicht erledigt" icon={ListTodo} />
                <StatCard darkMode={data.settings.darkMode} title="Bald fällig" value={taskSummary.dueSoon} sub="In den nächsten 3 Tagen" icon={CalendarClock} />
                <StatCard darkMode={data.settings.darkMode} title="Überfällig" value={taskSummary.overdue} sub="Sofort im Blick behalten" icon={AlertTriangle} />
                <StatCard darkMode={data.settings.darkMode} title="Erledigte Aufgaben" value={taskSummary.done} sub="Bereits abgeschlossen" icon={CheckCircle2} />
              </div>

              <div className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
                <Card className={cn("rounded-2xl border shadow-sm", getSurfaceClass(data.settings.darkMode))}>
                  <CardHeader><CardTitle>Nächste Deadlines</CardTitle><CardDescription>Offene Fristen und erledigte Deadline-Aufgaben</CardDescription></CardHeader>
                  <CardContent className="grid gap-4">
                    <div className="grid gap-3">
                      {taskSummary.nextDeadlines.length === 0 ? <p className="text-sm text-muted-foreground">Keine anstehenden Deadlines vorhanden.</p> : taskSummary.nextDeadlines.map((task) => (
                        <div key={task.id} className={cn("flex flex-col gap-3 rounded-2xl border p-4 md:flex-row md:items-center md:justify-between", deadlineCardTone(task.nextRelevantDate, task.status))}>
                          <div>
                            <div className="flex items-center gap-2"><button type="button" onClick={() => toggleTaskDone(task)} aria-label="Als erledigt markieren" className={cn("flex h-6 w-6 items-center justify-center rounded-md border transition-colors", data.settings.darkMode ? "border-slate-600 bg-slate-800 hover:bg-slate-700" : "border-slate-300 bg-white hover:bg-slate-100")} /><div className="h-3 w-3 rounded-full" style={{ backgroundColor: task.subject?.color || "#94a3b8" }} /><p className="font-medium">{task.title}</p></div>
                            <p className="mt-1 text-sm text-muted-foreground">{task.subject?.name || "Ohne Fach"}</p>
                          </div>
                          <div className="flex items-center gap-2"><Badge className={cn("border-0", deadlineTone(task.nextRelevantDate, task.status))}>{task.nextRelevantType}: {deadlineLabel(task.nextRelevantDate, task.status)}</Badge><Button variant="outline" size="icon" onClick={() => setEditingTask(task)}><Pencil className="h-4 w-4" /></Button></div>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-2xl border p-3">
                      <button type="button" onClick={() => setShowCompletedDeadlines((prev) => !prev)} className="flex w-full items-center justify-between text-left"><div><p className="text-sm font-medium">Fällig, aber erledigt</p><p className="text-xs text-muted-foreground">Erledigte Aufgaben mit vorhandener Abgabe oder Abnahme</p></div><ChevronDown className={cn("h-4 w-4 transition-transform", showCompletedDeadlines ? "rotate-180" : "")} /></button>
                      {showCompletedDeadlines ? (
                        <div className="mt-4 grid gap-3">
                          {taskSummary.completedDeadlines.length === 0 ? <p className="text-sm text-muted-foreground">Noch keine erledigten Deadline-Aufgaben.</p> : taskSummary.completedDeadlines.map((task) => (
                            <div key={task.id} className="flex flex-col gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 md:flex-row md:items-center md:justify-between">
                              <div><div className="flex items-center gap-2"><button type="button" onClick={() => toggleTaskDone(task)} aria-label="Als offen markieren" className="flex h-6 w-6 items-center justify-center rounded-md border border-emerald-500 bg-emerald-500 text-white transition-colors"><Check className="h-4 w-4" /></button><div className="h-3 w-3 rounded-full" style={{ backgroundColor: task.subject?.color || "#94a3b8" }} /><p className="font-medium">{task.title}</p></div><p className="mt-1 text-sm text-muted-foreground">{task.subject?.name || "Ohne Fach"}</p></div>
                              <div className="flex flex-wrap gap-2">{task.nextRelevantType ? <Badge variant="outline">{task.nextRelevantType}: {formatDateDisplay(task.nextRelevantDate)}</Badge> : null}<Badge className="border-0 bg-emerald-200 text-slate-950 ring-1 ring-emerald-300">Erledigt</Badge></div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>

                <Card className={cn("rounded-2xl border shadow-sm", getSurfaceClass(data.settings.darkMode))}>
                  <CardHeader><CardTitle>Gesamte Lernzeit pro Fach</CardTitle></CardHeader>
                  <CardContent className="grid gap-5 px-3 pb-5 sm:px-5"><StudyOverviewStrip studyStats={studyStats} darkMode={data.settings.darkMode} /><SubjectHoursChart data={studyStats.bySubject} darkMode={data.settings.darkMode} /></CardContent>
                </Card>
              </div>

              <div className="grid gap-6 xl:grid-cols-3">
                <Card className={cn("rounded-2xl border shadow-sm", getSurfaceClass(data.settings.darkMode))}><CardHeader><CardTitle>Heute lernen</CardTitle><CardDescription>Markierte Aufgaben für den heutigen Fokus</CardDescription></CardHeader><CardContent className="grid gap-3">{enhancedTasks.filter((t) => t.flaggedToday && t.status !== "erledigt").length === 0 ? <p className="text-sm text-muted-foreground">Keine Aufgaben für heute markiert.</p> : enhancedTasks.filter((t) => t.flaggedToday && t.status !== "erledigt").slice(0, 6).map((task) => <div key={task.id} className="rounded-2xl border p-4"><p className="font-medium">{task.title}</p><p className="text-sm text-muted-foreground">{task.subject?.name}</p></div>)}</CardContent></Card>
                <Card className={cn("rounded-2xl border shadow-sm", getSurfaceClass(data.settings.darkMode))}><CardHeader><CardTitle>Zuletzt gelernte Fächer</CardTitle><CardDescription>Die letzten Lernzeiteinträge</CardDescription></CardHeader><CardContent className="grid gap-3">{studyStats.recentSubjects.length === 0 ? <p className="text-sm text-muted-foreground">Noch keine Lernzeit erfasst.</p> : studyStats.recentSubjects.map((entry) => <div key={entry.id} className="flex items-center justify-between rounded-2xl border p-4"><div><p className="font-medium">{entry.subject?.name || "Unbekanntes Fach"}</p><p className="text-sm text-muted-foreground">{formatDateTimeDisplay(entry.createdAt)}</p></div><Badge variant="secondary">{formatMinutes(entry.durationMinutes)}</Badge></div>)}</CardContent></Card>
                <Card className={cn("rounded-2xl border shadow-sm", getSurfaceClass(data.settings.darkMode))}><CardHeader><CardTitle>Erledigte Aufgaben</CardTitle><CardDescription>Bereits abgeschlossene Aufgaben</CardDescription></CardHeader><CardContent className="grid gap-3">{enhancedTasks.filter((t) => t.status === "erledigt").length === 0 ? <p className="text-sm text-muted-foreground">Noch keine erledigten Aufgaben.</p> : enhancedTasks.filter((t) => t.status === "erledigt").slice(0, 6).map((task) => <div key={task.id} className="rounded-2xl border p-4"><p className="font-medium">{task.title}</p><p className="text-sm text-muted-foreground">{task.subject?.name}</p></div>)}</CardContent></Card>
              </div>
            </div>
          ) : null}

          {page === "subjects" ? (
            <div className="grid gap-6">
              <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                {data.subjects.map((subject) => {
                  const totalMinutes = data.studySessions.filter((s) => s.subjectId === subject.id).reduce((sum, s) => sum + s.durationMinutes, 0);
                  const openTasks = data.tasks.filter((t) => t.subjectId === subject.id && t.status !== "erledigt").length;
                  const progressValue = subject.targetHours ? Math.min(100, Math.round((totalMinutes / 60 / subject.targetHours) * 100)) : 0;
                  return (
                    <Card key={subject.id} className={cn("rounded-2xl border shadow-sm", getSurfaceClass(data.settings.darkMode))}>
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between gap-3"><div className="flex items-start gap-3"><div className="mt-1 h-4 w-4 rounded-full" style={{ backgroundColor: subject.color }} /><div><h3 className="font-semibold">{subject.name}</h3><p className="text-sm text-muted-foreground">{subject.semester || "Semester offen"}</p></div></div><div className="flex gap-2"><Button variant="outline" size="icon" onClick={() => setEditingSubject(subject)}><Pencil className="h-4 w-4" /></Button><Button variant="outline" size="icon" onClick={() => deleteSubject(subject.id)}><Trash2 className="h-4 w-4" /></Button></div></div>
                        <div className="mt-4 grid gap-2 text-sm"><div className="flex items-center justify-between"><span className="text-muted-foreground">Offene Aufgaben</span><span>{openTasks}</span></div><div className="flex items-center justify-between"><span className="text-muted-foreground">Gelernte Zeit</span><span>{formatMinutes(totalMinutes)} / {subject.targetHours}h</span></div></div>
                        <div className="mt-4 space-y-2"><div className="flex items-center justify-between text-sm"><span>Fortschritt</span><span>{progressValue}%</span></div><Progress value={progressValue} /></div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ) : null}

          {page === "tasks" ? (
            <div className="grid gap-6">
              <Card className={cn("rounded-2xl border shadow-sm", getSurfaceClass(data.settings.darkMode))}><CardContent className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4"><div className="grid gap-2"><Label>Fach</Label><Select value={taskFilter.subjectId} onValueChange={(value) => setTaskFilter({ ...taskFilter, subjectId: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Alle Fächer</SelectItem>{data.subjects.map((subject) => <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-2"><Label>Priorität</Label><Select value={taskFilter.priority} onValueChange={(value) => setTaskFilter({ ...taskFilter, priority: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Alle Prioritäten</SelectItem><SelectItem value="niedrig">Niedrig</SelectItem><SelectItem value="mittel">Mittel</SelectItem><SelectItem value="hoch">Hoch</SelectItem></SelectContent></Select></div><div className="grid gap-2"><Label>Status</Label><Select value={taskFilter.status} onValueChange={(value) => setTaskFilter({ ...taskFilter, status: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Alle Status</SelectItem><SelectItem value="offen">Offen</SelectItem><SelectItem value="in Bearbeitung">In Bearbeitung</SelectItem><SelectItem value="erledigt">Erledigt</SelectItem></SelectContent></Select></div><div className="grid gap-2"><Label>Sortierung</Label><Select value={taskFilter.sort} onValueChange={(value) => setTaskFilter({ ...taskFilter, sort: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="deadline">Nächste Deadline</SelectItem><SelectItem value="priority">Priorität</SelectItem><SelectItem value="subject">Fach</SelectItem><SelectItem value="created">Erstellungsdatum</SelectItem></SelectContent></Select></div></CardContent></Card>
              <div className="grid gap-4">{filteredTasks.length === 0 ? <Card className={cn("rounded-2xl border shadow-sm", getSurfaceClass(data.settings.darkMode))}><CardContent className="p-8 text-center text-sm text-muted-foreground">Keine Aufgaben für die aktuelle Auswahl gefunden.</CardContent></Card> : filteredTasks.map((task) => <TaskCard key={task.id} task={task} subject={task.subject} darkMode={data.settings.darkMode} onToggleDone={() => toggleTaskDone(task)} onDelete={() => deleteTask(task.id)} onEdit={() => setEditingTask(task)} />)}</div>
            </div>
          ) : null}

          {page === "tracking" ? (
            <div className="grid gap-6">
              <Card className={cn("rounded-2xl border shadow-sm", getSurfaceClass(data.settings.darkMode))}>
                <CardHeader>
                  <CardTitle>Lernzeiterfassung</CardTitle>
                  <CardDescription>Alle erfassten Lerneinheiten in zeitlicher Reihenfolge</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3">
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
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><StatCard darkMode={data.settings.darkMode} title="Gesamtlernzeit" value={formatMinutes(studyStats.total)} sub="Über alle Fächer" icon={Clock3} /><StatCard darkMode={data.settings.darkMode} title="Heute" value={formatMinutes(studyStats.todayMinutes)} sub="Heutige Lernzeit" icon={CalendarClock} /><StatCard darkMode={data.settings.darkMode} title="Durchschnitt / Tag" value={formatMinutes(studyStats.dailyAverage)} sub="Über aktive Lerntage" icon={BarChart3} /><StatCard darkMode={data.settings.darkMode} title="Durchschnitt / Woche" value={formatMinutes(studyStats.weeklyAverage * 7)} sub="Auf Basis dieser Woche" icon={BookOpen} /></div>
              <div className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]"><Card className={cn("rounded-2xl border shadow-sm", getSurfaceClass(data.settings.darkMode))}><CardHeader><CardTitle>Wochenübersicht</CardTitle><CardDescription>Lernstunden pro Tag in dieser Woche</CardDescription></CardHeader><CardContent className="h-[320px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={studyStats.weekLine}><CartesianGrid strokeDasharray="3 3" opacity={0.15} /><XAxis dataKey="day" /><YAxis /><Tooltip /><Line type="monotone" dataKey="Stunden" stroke="#6366f1" strokeWidth={3} dot={{ r: 4 }} /></LineChart></ResponsiveContainer></CardContent></Card><Card className={cn("rounded-2xl border shadow-sm", getSurfaceClass(data.settings.darkMode))}><CardHeader><CardTitle>Verteilung der Lernzeit</CardTitle><CardDescription>Alle Fächer bleiben in der Statistik sichtbar</CardDescription></CardHeader><CardContent className="grid gap-4 xl:grid-cols-[1fr_220px]"><div className="h-[320px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={studyStats.bySubject} dataKey="minutes" nameKey="name" innerRadius={65} outerRadius={100} paddingAngle={3}>{studyStats.bySubject.map((entry, index) => <Cell key={index} fill={entry.color} />)}</Pie><Tooltip formatter={(value) => formatMinutes(Number(value))} /></PieChart></ResponsiveContainer></div><div className="grid content-start gap-2">{studyStats.bySubject.map((subject) => <div key={subject.id} className="flex items-center justify-between rounded-xl border p-3 text-sm"><div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: subject.color }} /><span>{subject.name}</span></div><span className="font-medium">{formatMinutes(subject.minutes)}</span></div>)}</div></CardContent></Card></div>
              <Card className={cn("rounded-2xl border shadow-sm", getSurfaceClass(data.settings.darkMode))}><CardHeader><CardTitle>Stunden pro Fach</CardTitle><CardDescription>Direkter Vergleich der Lernzeit</CardDescription></CardHeader><CardContent className="h-[360px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={studyStats.bySubject}><CartesianGrid strokeDasharray="3 3" opacity={0.15} /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="hours" radius={[8, 8, 0, 0]}>{studyStats.bySubject.map((entry, index) => <Cell key={index} fill={entry.color} />)}</Bar></BarChart></ResponsiveContainer></CardContent></Card>
            </div>
          ) : null}

          <Dialog open={!!editingSubject} onOpenChange={(open) => !open && setEditingSubject(null)}><DialogContent className="max-w-xl rounded-3xl"><DialogHeader><DialogTitle>Fach bearbeiten</DialogTitle></DialogHeader>{editingSubject ? <SubjectForm initialValue={editingSubject} onSave={saveSubject} onDone={() => setEditingSubject(null)} /> : null}</DialogContent></Dialog>
          <Dialog open={!!editingTask} onOpenChange={(open) => !open && setEditingTask(null)}><DialogContent className="max-w-2xl rounded-3xl"><DialogHeader><DialogTitle>Aufgabe bearbeiten</DialogTitle></DialogHeader>{editingTask ? <TaskForm subjects={data.subjects} initialValue={editingTask} onSave={saveTask} onDone={() => setEditingTask(null)} /> : null}</DialogContent></Dialog>
          <ManualStudyDialog
            open={!!editingSession}
            onOpenChange={(open) => !open && setEditingSession(null)}
            subjects={data.subjects}
            darkMode={data.settings.darkMode}
            selectedSubjectId={editingSession?.subjectId || data.subjects[0]?.id || ""}
            onSelectedSubjectChange={(value) => setEditingSession((prev) => prev ? { ...prev, subjectId: value } : prev)}
            onSaveEntry={saveStudySession}
            initialValue={editingSession ? buildSessionSeedFromEntry(editingSession) : null}
            title="Lerneinheit bearbeiten"
            submitLabel="Änderungen speichern"
          />
        </main>
      </div>
    </div>
  );
}
