import React from "react";
import { ChevronDown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export default function LearningPlanPage({
  darkMode,
  data,
  groupedSubjects,
  learningPlanModel,
  learningPlanFilter,
  setLearningPlanFilter,
  activeLearningPlanTab,
  setActiveLearningPlanTab,
  learningPlanArchiveCollapsed,
  setLearningPlanArchiveCollapsed,
  toggleLearningPlanFlag,
  toggleSubjectPaused,
  restoreArchivedTopic,
  getSurfaceClass,
  deadlineLabel,
  deadlineCardTone,
}) {
  const selectedSubjectCount = learningPlanModel.selectedSubjects.length;
  const selectedSubjectIds = new Set(learningPlanModel.selectedSubjects.map((subject) => subject.id));
  const nowQueue = [
    ...learningPlanModel.overdueSubjects,
    ...learningPlanModel.dueTodaySubjects,
    ...learningPlanModel.continueSubjects,
  ].sort((a, b) => (a.nextDueAt ?? Number.MAX_SAFE_INTEGER) - (b.nextDueAt ?? Number.MAX_SAFE_INTEGER));
  const recentStudySessions = [...(data.studySessions || [])]
    .filter((session) => session.source !== "seed")
    .filter((session) => selectedSubjectIds.has(session.subjectId))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 8);

  const formatPlannedDate = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Ohne Termin";
    return date.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatLastStudied = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Noch nicht gelernt";
    return date.toLocaleString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const statusLabel = {
    learned: "Heute gelernt",
    due: "Heute faellig",
    overdue: "Ueberfaellig",
    upcoming: "Demnaechst",
    continue: "Weiterlernen",
    postponed: "Pausiert",
  };

  const renderSubjectCard = (subject) => (
    <div key={subject.id} className={cn("rounded-2xl border p-4", subject.nextDueAt !== null ? deadlineCardTone(subject.nextDueAt, "offen") : "")}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: subject.color || "#94a3b8" }} />
            <p className="font-medium">{subject.name || "Fach"}</p>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Zuletzt gelernt: {formatLastStudied(subject.lastStudiedAt)}</p>
          <p className="text-sm text-muted-foreground">
            Naechste Wiederholung: {subject.nextReviewAt ? `${deadlineLabel(subject.nextReviewAt, "offen")} - ${formatPlannedDate(subject.nextReviewAt)}` : "nach der naechsten Lerneinheit"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{statusLabel[subject.subjectStatus] || "Fach"}</Badge>
          {subject.studyCount ? <Badge variant="outline">{subject.studyCount} Einheiten</Badge> : null}
          {subject.lastStudiedMinutes ? <Badge variant="outline">{subject.lastStudiedMinutes} Min.</Badge> : null}
        </div>
      </div>
    </div>
  );

  return (
    <Tabs value={activeLearningPlanTab} onValueChange={setActiveLearningPlanTab} className="w-full">
      <TabsList className="grid w-full grid-cols-2 rounded-2xl bg-slate-200 dark:bg-[#2a3554]">
        <TabsTrigger value="plan">Lernplan</TabsTrigger>
        <TabsTrigger value="subjects">Faecher auswaehlen</TabsTrigger>
      </TabsList>

      <TabsContent value="plan" className="mt-6">
        <div className="grid gap-6">
          <Card className={cn("rounded-2xl border shadow-sm", getSurfaceClass(darkMode))}>
            <CardContent className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
              <div className="grid gap-2">
                <Label>Fach</Label>
                <Select value={learningPlanFilter.subjectId} onValueChange={(value) => setLearningPlanFilter((prev) => ({ ...prev, subjectId: value }))}>
                  <SelectTrigger><SelectValue placeholder="Fach waehlen" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle ausgewaehlten Faecher</SelectItem>
                    {learningPlanModel.selectedSubjects.map((subject) => (
                      <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={learningPlanFilter.status} onValueChange={(value) => setLearningPlanFilter((prev) => ({ ...prev, status: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle</SelectItem>
                    <SelectItem value="today">Heute relevant</SelectItem>
                    <SelectItem value="learned">Heute gelernt</SelectItem>
                    <SelectItem value="due">Faellig</SelectItem>
                    <SelectItem value="overdue">Ueberfaellig</SelectItem>
                    <SelectItem value="upcoming">Demnaechst</SelectItem>
                    <SelectItem value="continue">Weiterlernen</SelectItem>
                    <SelectItem value="postponed">Pausiert</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Sortierung</Label>
                <Select value={learningPlanFilter.sort} onValueChange={(value) => setLearningPlanFilter((prev) => ({ ...prev, sort: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="due">Faelligkeit</SelectItem>
                    <SelectItem value="subject">Fach</SelectItem>
                    <SelectItem value="status">Status</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Ausgewaehlte Faecher</Label>
                <div className={cn("rounded-xl border px-3 py-2 text-sm", darkMode ? "border-slate-700 bg-slate-800/50 text-slate-200" : "border-slate-200 bg-slate-50 text-slate-700")}>
                  {selectedSubjectCount} von {data.subjects.length}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={cn("rounded-2xl border shadow-sm", getSurfaceClass(darkMode))}>
            <CardHeader>
              <CardTitle>Jetzt lernen</CardTitle>
              <CardDescription>Priorisierte Faecher aus ueberfaelligen Wiederholungen, heutigen Wiederholungen und kontinuierlichem Weiterlernen.</CardDescription>
            </CardHeader>
            <CardContent className="grid max-h-[420px] gap-3 overflow-y-auto pr-2">
              {selectedSubjectCount === 0 ? (
                <p className="text-sm text-muted-foreground">Waehle zuerst Faecher aus.</p>
              ) : nowQueue.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aktuell nichts in der Lern-Warteschlange.</p>
              ) : nowQueue.map(renderSubjectCard)}
            </CardContent>
          </Card>

          <div className="grid gap-6 xl:grid-cols-3">
            <Card className={cn("rounded-2xl border shadow-sm", getSurfaceClass(darkMode))}>
              <CardHeader>
                <CardTitle>Heute gelernt</CardTitle>
                <CardDescription>Faecher, fuer die heute eine Lerneinheit gespeichert wurde.</CardDescription>
              </CardHeader>
              <CardContent className="grid max-h-[520px] gap-4 overflow-y-auto pr-2">
                {selectedSubjectCount === 0 ? (
                  <p className="text-sm text-muted-foreground">Waehle zuerst Faecher aus.</p>
                ) : learningPlanModel.learnedTodaySubjects.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Heute wurde noch kein ausgewaehltes Fach gelernt.</p>
                ) : learningPlanModel.learnedTodaySubjects.map(renderSubjectCard)}
              </CardContent>
            </Card>

            <Card className={cn("rounded-2xl border shadow-sm", getSurfaceClass(darkMode))}>
              <CardHeader>
                <CardTitle>Faellig</CardTitle>
                <CardDescription>Heute faellige und ueberfaellige Wiederholungen der ausgewaehlten Faecher.</CardDescription>
              </CardHeader>
              <CardContent className="grid max-h-[520px] gap-4 overflow-y-auto pr-2">
                {selectedSubjectCount === 0 ? (
                  <p className="text-sm text-muted-foreground">Waehle zuerst Faecher aus.</p>
                ) : learningPlanModel.overdueSubjects.length + learningPlanModel.dueTodaySubjects.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Keine Wiederholungen faellig.</p>
                ) : [...learningPlanModel.overdueSubjects, ...learningPlanModel.dueTodaySubjects].map(renderSubjectCard)}
              </CardContent>
            </Card>

            <Card className={cn("rounded-2xl border shadow-sm", getSurfaceClass(darkMode))}>
              <CardHeader>
                <CardTitle>Weiterlernen</CardTitle>
                <CardDescription>Faecher ohne akute Wiederholung, damit das Semester gleichmaessig vorangeht.</CardDescription>
              </CardHeader>
              <CardContent className="grid max-h-[520px] gap-4 overflow-y-auto pr-2">
                {selectedSubjectCount === 0 ? (
                  <p className="text-sm text-muted-foreground">Waehle zuerst Faecher aus.</p>
                ) : learningPlanModel.continueSubjects.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Keine Faecher fuer kontinuierliches Weiterlernen offen.</p>
                ) : learningPlanModel.continueSubjects.map(renderSubjectCard)}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card className={cn("rounded-2xl border shadow-sm", getSurfaceClass(darkMode))}>
              <CardHeader>
                <CardTitle>Demnaechst</CardTitle>
                <CardDescription>Geplante Wiederholungen in den naechsten Tagen.</CardDescription>
              </CardHeader>
              <CardContent className="grid max-h-[420px] gap-4 overflow-y-auto pr-2">
                {selectedSubjectCount === 0 ? (
                  <p className="text-sm text-muted-foreground">Waehle zuerst Faecher aus.</p>
                ) : learningPlanModel.upcomingSubjects.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Keine geplanten Wiederholungen in den naechsten Tagen.</p>
                ) : learningPlanModel.upcomingSubjects.map(renderSubjectCard)}
              </CardContent>
            </Card>

            <Card className={cn("rounded-2xl border shadow-sm", getSurfaceClass(darkMode))}>
              <CardHeader>
                <CardTitle>Pausiert</CardTitle>
                <CardDescription>Faecher, die im Lernplan temporaer pausiert sind.</CardDescription>
              </CardHeader>
              <CardContent className="grid max-h-[420px] gap-4 overflow-y-auto pr-2">
                {selectedSubjectCount === 0 ? (
                  <p className="text-sm text-muted-foreground">Waehle zuerst Faecher aus.</p>
                ) : learningPlanModel.postponedSubjects.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Keine pausierten Faecher.</p>
                ) : learningPlanModel.postponedSubjects.map(renderSubjectCard)}
              </CardContent>
            </Card>
          </div>

          <Card className={cn("rounded-2xl border shadow-sm", getSurfaceClass(darkMode))}>
            <CardHeader>
              <CardTitle>Lernzeiten</CardTitle>
              <CardDescription>Zuletzt erfasste Einheiten und Timer-Sitzungen fuer die ausgewaehlten Faecher.</CardDescription>
            </CardHeader>
            <CardContent className="grid max-h-[420px] gap-3 overflow-y-auto pr-2">
              {selectedSubjectCount === 0 ? (
                <p className="text-sm text-muted-foreground">Waehle zuerst Faecher aus.</p>
              ) : recentStudySessions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Noch keine Lernzeit fuer die ausgewaehlten Faecher erfasst.</p>
              ) : recentStudySessions.map((session) => {
                const subject = data.subjects.find((entry) => entry.id === session.subjectId);
                return (
                  <div key={session.id} className="rounded-2xl border p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: subject?.color || "#94a3b8" }} />
                          <p className="font-medium">{subject?.name || "Fach"}</p>
                        </div>
                        <p className="mt-1 font-semibold">{session.source === "pomodoro" ? "Timer" : session.source === "stopwatch" ? "Stoppuhr" : "Lerneinheit"}</p>
                        <p className="text-sm text-muted-foreground">{new Date(session.createdAt).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}</p>
                      </div>
                      <Badge variant="outline">{Math.max(1, Math.round(Number(session.durationMinutes || 0)))} Min.</Badge>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className={cn("rounded-2xl border shadow-sm", getSurfaceClass(darkMode))}>
            <CardHeader>
              <button type="button" onClick={() => setLearningPlanArchiveCollapsed((prev) => !prev)} className="flex w-full items-center justify-between text-left">
                <div>
                  <CardTitle>Archiv</CardTitle>
                  <CardDescription>Abgeschlossene oder archivierte Themen, aus der Hauptansicht ausgeblendet.</CardDescription>
                </div>
                <ChevronDown className={cn("h-5 w-5 transition-transform", learningPlanArchiveCollapsed ? "rotate-180" : "")} />
              </button>
            </CardHeader>
            {learningPlanArchiveCollapsed ? (
              <CardContent className="grid max-h-[640px] gap-4 overflow-y-auto pr-2">
                {learningPlanModel.archivedTopics.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Noch keine archivierten Themen.</p>
                ) : learningPlanModel.archivedTopics.map((topic) => (
                  <div key={topic.id} className="rounded-2xl border p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: topic.subject?.color || "#94a3b8" }} />
                          <p className="font-medium">{topic.subject?.name || "Fach"}</p>
                        </div>
                        <p className="mt-1 font-semibold">{topic.title}</p>
                        <p className="text-sm text-muted-foreground">Archiviert</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" className="rounded-xl" onClick={() => restoreArchivedTopic(topic)}>Wiederherstellen</Button>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            ) : null}
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="subjects" className="mt-6">
        <Card className={cn("rounded-2xl border shadow-sm", getSurfaceClass(darkMode))}>
          <CardHeader className="sticky top-0 z-10 border-b backdrop-blur supports-[backdrop-filter]:bg-inherit">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Faecher auswaehlen</CardTitle>
                <CardDescription>Nur ausgewaehlte Faecher erscheinen im Lernplan.</CardDescription>
              </div>
              <Badge variant="outline">{selectedSubjectCount} ausgewaehlt</Badge>
            </div>
          </CardHeader>
          <CardContent className="max-h-[calc(100vh-17rem)] overflow-y-auto pr-2 pt-4">
            <div className="grid gap-6">
              {groupedSubjects.length === 0 ? (
                <p className="text-sm text-muted-foreground">Noch keine Faecher vorhanden.</p>
              ) : groupedSubjects.map((group) => (
                <div key={group.id} className="grid gap-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold tracking-tight">{group.name}</h3>
                    <Badge variant="outline">{group.subjects.length}</Badge>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                    {group.subjects.map((subject) => {
                      const overview = learningPlanModel.selectedOverview.find((entry) => entry.subject.id === subject.id) || {
                        openTopics: 0,
                        dueReviewsCount: 0,
                        newTopicsCount: 0,
                        postponedCount: 0,
                      };

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
                              <div className="flex flex-col items-end gap-2">
                                <Switch checked={subject.includeInLearningPlan !== false} onCheckedChange={(checked) => toggleLearningPlanFlag(subject, checked)} />
                                <Button variant="outline" size="sm" className="h-8 rounded-lg" onClick={() => toggleSubjectPaused(subject, !subject.paused)}>
                                  {subject.paused ? "Fortsetzen" : "Pausieren"}
                                </Button>
                              </div>
                            </div>

                            <div className="mt-4 grid gap-2 text-sm">
                              <div className="flex items-center justify-between"><span className="text-muted-foreground">Im Lernplan</span><span>{subject.includeInLearningPlan !== false ? "ja" : "nein"}</span></div>
                              <div className="flex items-center justify-between"><span className="text-muted-foreground">Faellige Wiederholung</span><span>{overview.dueReviewsCount}</span></div>
                              <div className="flex items-center justify-between"><span className="text-muted-foreground">Weiterlernen</span><span>{overview.newTopicsCount}</span></div>
                              <div className="flex items-center justify-between"><span className="text-muted-foreground">Pausiert</span><span>{overview.postponedCount}</span></div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
