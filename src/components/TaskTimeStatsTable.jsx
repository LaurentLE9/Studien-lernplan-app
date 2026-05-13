import React, { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Clock3, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const SORT_OPTIONS = [
  { key: "totalMinutes", label: "Gesamtzeit" },
  { key: "sessionCount", label: "Sitzungen" },
  { key: "averageMinutes", label: "Ø pro Sitzung" },
  { key: "lastStudiedAt", label: "Letztes Lerndatum" },
];

const SOURCE_LABELS = {
  manual: "Manuell",
  stopwatch: "Timer",
  pomodoro: "Pomodoro",
};

function SortButton({ sort, sortKey, children, onSort }) {
  const active = sort.key === sortKey;
  const Icon = sort.direction === "asc" ? ArrowUp : ArrowDown;

  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={cn(
        "inline-flex items-center gap-1 text-left font-semibold transition hover:text-foreground",
        active ? "text-foreground" : "text-muted-foreground"
      )}
    >
      <span>{children}</span>
      {active ? <Icon className="h-3.5 w-3.5" /> : null}
    </button>
  );
}

function getSortValue(row, key) {
  if (key === "lastStudiedAt") {
    const time = row.lastStudiedAt ? new Date(row.lastStudiedAt).getTime() : 0;
    return Number.isNaN(time) ? 0 : time;
  }
  return Number(row[key] || 0);
}

export default function TaskTimeStatsTable({
  darkMode,
  rows,
  subjects,
  formatMinutes,
  formatDateTimeDisplay,
  getActivityTypeLabel,
}) {
  const [query, setQuery] = useState("");
  const [subjectId, setSubjectId] = useState("all");
  const [sort, setSort] = useState({ key: "totalMinutes", direction: "desc" });
  const [selectedTask, setSelectedTask] = useState(null);

  const visibleRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = (rows || []).filter((row) => {
      if (subjectId !== "all" && row.subjectId !== subjectId) return false;
      if (!normalizedQuery) return true;
      return [row.title, row.subjectName].some((value) =>
        String(value || "").toLowerCase().includes(normalizedQuery)
      );
    });

    return [...filtered].sort((a, b) => {
      const first = getSortValue(a, sort.key);
      const second = getSortValue(b, sort.key);
      const diff = first - second;
      if (diff !== 0) return sort.direction === "asc" ? diff : -diff;
      return String(a.title || "").localeCompare(String(b.title || ""), "de");
    });
  }, [rows, query, subjectId, sort]);

  const handleSort = (key) => {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === "desc" ? "asc" : "desc",
    }));
  };

  const selectedSessions = selectedTask?.sessions || [];

  return (
    <>
      <div className="grid gap-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_16rem_13rem] md:items-center">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="pl-9"
              placeholder="Aufgabe oder Fach suchen"
            />
          </div>
          <Select value={subjectId} onValueChange={setSubjectId}>
            <SelectTrigger>
              <SelectValue placeholder="Fach filtern" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Fächer</SelectItem>
              {(subjects || []).map((subject) => (
                <SelectItem key={subject.id} value={subject.id}>
                  {subject.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={`${sort.key}:${sort.direction}`}
            onValueChange={(value) => {
              const [key, direction] = value.split(":");
              setSort({ key, direction });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sortierung" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <React.Fragment key={option.key}>
                  <SelectItem value={`${option.key}:desc`}>{option.label} absteigend</SelectItem>
                  <SelectItem value={`${option.key}:asc`}>{option.label} aufsteigend</SelectItem>
                </React.Fragment>
              ))}
            </SelectContent>
          </Select>
        </div>

        {visibleRows.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
            Keine Aufgaben mit Lernzeit für diese Auswahl gefunden.
          </div>
        ) : (
          <>
            <div className="hidden max-h-[520px] overflow-auto rounded-2xl border md:block">
              <table className="w-full min-w-[860px] text-sm">
                <thead className={cn("sticky top-0 z-10 border-b", darkMode ? "bg-slate-900" : "bg-white")}>
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Aufgabe</th>
                    <th className="px-4 py-3 text-left font-semibold">Fach</th>
                    <th className="px-4 py-3 text-right">
                      <SortButton sort={sort} sortKey="totalMinutes" onSort={handleSort}>Gesamtzeit</SortButton>
                    </th>
                    <th className="px-4 py-3 text-right">
                      <SortButton sort={sort} sortKey="sessionCount" onSort={handleSort}>Sitzungen</SortButton>
                    </th>
                    <th className="px-4 py-3 text-right">
                      <SortButton sort={sort} sortKey="averageMinutes" onSort={handleSort}>Ø pro Sitzung</SortButton>
                    </th>
                    <th className="px-4 py-3 text-right">
                      <SortButton sort={sort} sortKey="lastStudiedAt" onSort={handleSort}>Letztes Lerndatum</SortButton>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => (
                    <tr
                      key={row.id}
                      className={cn(
                        "cursor-pointer border-b transition last:border-b-0",
                        darkMode ? "hover:bg-slate-800/70" : "hover:bg-slate-50"
                      )}
                      onClick={() => setSelectedTask(row)}
                    >
                      <td className="max-w-[22rem] px-4 py-3 align-top">
                        <p className="break-words font-medium leading-snug">{row.title}</p>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <Badge variant="outline" className="max-w-[14rem] whitespace-normal break-words">
                          {row.subjectName}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right align-top font-semibold">{formatMinutes(row.totalMinutes)}</td>
                      <td className="px-4 py-3 text-right align-top">{row.sessionCount}</td>
                      <td className="px-4 py-3 text-right align-top">{formatMinutes(row.averageMinutes)}</td>
                      <td className="px-4 py-3 text-right align-top">{formatDateTimeDisplay(row.lastStudiedAt) || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid max-h-[560px] gap-3 overflow-y-auto pr-1 md:hidden">
              {visibleRows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className={cn(
                    "rounded-2xl border p-4 text-left transition",
                    darkMode ? "hover:bg-slate-800/70" : "hover:bg-slate-50"
                  )}
                  onClick={() => setSelectedTask(row)}
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
                    <div className="min-w-0 flex-1">
                      <p className="break-words font-semibold leading-snug">{row.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{row.subjectName}</p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-muted-foreground">Gesamt</span><p className="font-semibold">{formatMinutes(row.totalMinutes)}</p></div>
                    <div><span className="text-muted-foreground">Sitzungen</span><p className="font-semibold">{row.sessionCount}</p></div>
                    <div><span className="text-muted-foreground">Ø/Sitzung</span><p className="font-semibold">{formatMinutes(row.averageMinutes)}</p></div>
                    <div><span className="text-muted-foreground">Zuletzt</span><p className="font-semibold">{formatDateTimeDisplay(row.lastStudiedAt) || "-"}</p></div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <Dialog open={Boolean(selectedTask)} onOpenChange={(open) => !open && setSelectedTask(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="break-words pr-8">{selectedTask?.title || "Aufgabe"}</DialogTitle>
          </DialogHeader>
          {selectedTask ? (
            <div className="grid gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{selectedTask.subjectName}</Badge>
                <Badge variant="secondary">{formatMinutes(selectedTask.totalMinutes)}</Badge>
                <Badge variant="secondary">{selectedTask.sessionCount} Sitzungen</Badge>
              </div>
              <div className="grid max-h-[55vh] gap-3 overflow-y-auto pr-1">
                {selectedSessions.map((session) => (
                  <Card key={session.id} className="rounded-2xl">
                    <CardContent className="grid gap-3 p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-medium">{formatDateTimeDisplay(session.createdAt || session.recordedAt) || "-"}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Badge variant="secondary">{formatMinutes(session.durationMinutes)}</Badge>
                            {session.activityType ? (
                              <Badge variant="outline">{getActivityTypeLabel?.(session.activityType) || session.activityType}</Badge>
                            ) : null}
                            {session.source ? (
                              <Badge variant="outline">{SOURCE_LABELS[session.source] || session.source}</Badge>
                            ) : null}
                          </div>
                        </div>
                        <Clock3 className="hidden h-5 w-5 text-muted-foreground sm:block" />
                      </div>
                      {session.note || session.notes ? (
                        <p className="break-words text-sm text-muted-foreground">{session.note || session.notes}</p>
                      ) : null}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
