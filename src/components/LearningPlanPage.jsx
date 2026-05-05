import React, { useMemo, useState } from "react";
import { ChevronDown, ExternalLink, Plus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  CONFIDENCE_LABELS,
  TOPIC_STATUS_LABELS,
  formatLearningDate,
  getActivityTypeLabel,
  getConfidenceLabel,
  getTopicStatusLabel,
  isValidDateValue,
  normalizeConfidence,
  normalizeTopicStatus,
} from "@/lib/cloudStore";

function startOfLocalDay(value = new Date()) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatMinutes(minutes) {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  if (!total) return "0 Min.";
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours && rest) return `${hours} h ${rest} Min.`;
  if (hours) return `${hours} h`;
  return `${rest} Min.`;
}

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
  onStartTopicPractice,
  onMarkTopicReviewed,
  onCreateTopic,
  getSurfaceClass,
}) {
  const [expandedCheatsheetId, setExpandedCheatsheetId] = useState(null);
  const [topicDraft, setTopicDraft] = useState({
    subjectId: "",
    title: "",
    cheatsheetText: "",
    cheatsheetUrl: "",
    status: "new",
  });
  const [isCreatingTopic, setIsCreatingTopic] = useState(false);

  const selectedSubjectCount = learningPlanModel.selectedSubjects.length;
  const selectedSubjectIds = useMemo(
    () => new Set(learningPlanModel.selectedSubjects.map((subject) => subject.id)),
    [learningPlanModel.selectedSubjects]
  );
  const subjectById = useMemo(
    () => Object.fromEntries((data.subjects || []).map((subject) => [subject.id, subject])),
    [data.subjects]
  );
  const topicById = useMemo(
    () => Object.fromEntries((data.topics || []).map((topic) => [topic.id, topic])),
    [data.topics]
  );

  const todayStart = startOfLocalDay(new Date());
  const todayTs = todayStart.getTime();
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const weekEnd = new Date(todayStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const allTopicRows = useMemo(() => {
    return (data.topics || []).map((topic) => {
      const subject = subjectById[topic.subjectId] || null;
      const status = topic.completed || topic.archivedAt
        ? "archived"
        : normalizeTopicStatus(topic.status);
      const nextReviewDate = isValidDateValue(topic.nextReviewAt) ? startOfLocalDay(topic.nextReviewAt) : null;
      const nextReviewTs = nextReviewDate ? nextReviewDate.getTime() : null;
      const overdue = nextReviewTs !== null && nextReviewTs < todayTs;
      const dueToday = nextReviewTs !== null && nextReviewTs === todayTs;

      return {
        ...topic,
        subject,
        status,
        confidence: normalizeConfidence(topic.confidence || "unsure"),
        nextReviewTs,
        overdue,
        dueToday,
      };
    });
  }, [data.topics, subjectById, todayTs]);

  const filteredTopics = useMemo(() => {
    return allTopicRows
      .filter((topic) => selectedSubjectIds.has(topic.subjectId))
      .filter((topic) => learningPlanFilter.subjectId === "all" || topic.subjectId === learningPlanFilter.subjectId);
  }, [allTopicRows, learningPlanFilter.subjectId, selectedSubjectIds]);

  const visibleTopics = filteredTopics.filter((topic) => topic.status !== "archived");
  const activeFilterHasNoTopics = learningPlanFilter.subjectId !== "all" && visibleTopics.length === 0;
  const noTopicsAtAll = (data.topics || []).filter((topic) => normalizeTopicStatus(topic.status) !== "archived" && !topic.completed && !topic.archivedAt).length === 0;

  const sortByTopicDue = (a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    const dueDiff = (a.nextReviewTs ?? Number.MAX_SAFE_INTEGER) - (b.nextReviewTs ?? Number.MAX_SAFE_INTEGER);
    if (dueDiff !== 0) return dueDiff;
    const subjectDiff = (a.subject?.name || "").localeCompare(b.subject?.name || "", "de");
    if (subjectDiff !== 0) return subjectDiff;
    return (a.title || "").localeCompare(b.title || "", "de");
  };

  const todayTopics = [...visibleTopics]
    .filter((topic) => topic.overdue || topic.dueToday)
    .sort(sortByTopicDue);

  const continueTopics = [...visibleTopics]
    .filter((topic) => !topic.overdue && !topic.dueToday && topic.status !== "paused")
    .sort((a, b) => {
      const dueDiff = (a.nextReviewTs ?? Number.MAX_SAFE_INTEGER) - (b.nextReviewTs ?? Number.MAX_SAFE_INTEGER);
      if (dueDiff !== 0) return dueDiff;
      const subjectDiff = (a.subject?.name || "").localeCompare(b.subject?.name || "", "de");
      if (subjectDiff !== 0) return subjectDiff;
      return (a.title || "").localeCompare(b.title || "", "de");
    });

  const previewGroups = useMemo(() => {
    const upcoming = visibleTopics
      .filter((topic) => topic.nextReviewTs !== null && topic.nextReviewTs > todayTs)
      .sort((a, b) => a.nextReviewTs - b.nextReviewTs);
    return {
      tomorrow: upcoming.filter((topic) => topic.nextReviewTs === tomorrowStart.getTime()),
      week: upcoming.filter((topic) => topic.nextReviewTs > tomorrowStart.getTime() && topic.nextReviewTs <= weekEnd.getTime()),
      later: upcoming.filter((topic) => topic.nextReviewTs > weekEnd.getTime()),
    };
  }, [visibleTopics, todayTs, tomorrowStart, weekEnd]);

  const todaySessions = useMemo(() => {
    const tomorrowTs = tomorrowStart.getTime();
    return [...(data.studySessions || [])]
      .filter((session) => session.source !== "seed")
      .filter((session) => {
        const createdDay = isValidDateValue(session.createdAt) ? startOfLocalDay(session.createdAt).getTime() : null;
        return createdDay !== null && createdDay >= todayTs && createdDay < tomorrowTs;
      })
      .filter((session) => selectedSubjectIds.has(session.subjectId))
      .filter((session) => learningPlanFilter.subjectId === "all" || session.subjectId === learningPlanFilter.subjectId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [data.studySessions, learningPlanFilter.subjectId, selectedSubjectIds, todayTs, tomorrowStart]);

  function openCheatsheet(topic) {
    if (topic.cheatsheetUrl) {
      window.open(topic.cheatsheetUrl, "_blank", "noopener,noreferrer");
      return;
    }
    if (topic.cheatsheetText) {
      setExpandedCheatsheetId((current) => current === topic.id ? null : topic.id);
    }
  }

  function seedTopicDraft(subjectId = "") {
    setTopicDraft((prev) => ({
      ...prev,
      subjectId: subjectId || (learningPlanFilter.subjectId !== "all" ? learningPlanFilter.subjectId : prev.subjectId),
    }));
  }

  async function createTopicFromDraft() {
    if (!topicDraft.subjectId || !topicDraft.title.trim() || !onCreateTopic) return;
    try {
      setIsCreatingTopic(true);
      await Promise.resolve(onCreateTopic({
        ...topicDraft,
        title: topicDraft.title.trim(),
      }));
      setTopicDraft({
        subjectId: topicDraft.subjectId,
        title: "",
        cheatsheetText: "",
        cheatsheetUrl: "",
        status: "new",
      });
    } finally {
      setIsCreatingTopic(false);
    }
  }

  const renderTopicCard = (topic, options = {}) => {
    const hasCheatsheet = Boolean(topic.cheatsheetText || topic.cheatsheetUrl);
    const badgeText = options.mode === "today"
      ? topic.overdue ? "überfällig" : "heute fällig"
      : getTopicStatusLabel(topic.status);

    return (
      <div key={topic.id} className={cn("rounded-2xl border p-4", darkMode ? "border-slate-800 bg-slate-950/40" : "border-slate-200 bg-white")}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: topic.subject?.color || "#94a3b8" }} />
              <span className="text-sm font-medium text-muted-foreground">{topic.subject?.name || "Fach"}</span>
              <Badge variant={topic.overdue ? "destructive" : "outline"}>{badgeText}</Badge>
              <Badge variant="secondary">{getConfidenceLabel(topic.confidence)}</Badge>
            </div>
            <p className="mt-2 text-lg font-semibold">{topic.title}</p>
            <div className="mt-2 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
              <span>Letzte Übung: {formatLearningDate(topic.lastStudiedAt, "noch nicht geübt", { includeTime: true })}</span>
              <span>Nächste Wiederholung: {formatLearningDate(topic.nextReviewAt, "nach erster Übung")}</span>
            </div>
            {expandedCheatsheetId === topic.id && topic.cheatsheetText ? (
              <div className={cn("mt-3 rounded-xl border p-3 text-sm", darkMode ? "border-slate-800 bg-slate-900 text-slate-200" : "border-slate-200 bg-slate-50 text-slate-700")}>
                {topic.cheatsheetText}
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="rounded-xl" onClick={() => onStartTopicPractice?.(topic)}>Übung starten</Button>
            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => openCheatsheet(topic)} disabled={!hasCheatsheet}>
              {hasCheatsheet ? "Cheatsheet öffnen" : "Cheatsheet anlegen"}
              {topic.cheatsheetUrl ? <ExternalLink className="h-3.5 w-3.5" /> : null}
            </Button>
            {options.mode === "today" ? (
              <Button size="sm" variant="secondary" className="rounded-xl" onClick={() => onMarkTopicReviewed?.(topic)}>Als wiederholt markieren</Button>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  const renderPreviewRows = (title, rows) => (
    <div className="grid gap-2">
      <h4 className="text-sm font-semibold">{title}</h4>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Keine Einträge.</p>
      ) : rows.map((topic) => (
        <div key={`${title}-${topic.id}`} className="grid gap-2 rounded-xl border px-3 py-2 text-sm md:grid-cols-[1fr_1.5fr_auto_auto] md:items-center">
          <span className="font-medium">{topic.subject?.name || "Fach"}</span>
          <span>{topic.title}</span>
          <span className="text-muted-foreground">{formatLearningDate(topic.nextReviewAt, "noch nicht geplant")}</span>
          <Badge variant="outline">{getConfidenceLabel(topic.confidence)}</Badge>
        </div>
      ))}
    </div>
  );

  return (
    <Tabs value={activeLearningPlanTab} onValueChange={setActiveLearningPlanTab} className="w-full">
      <TabsList className="grid w-full grid-cols-2 rounded-2xl bg-slate-200 dark:bg-[#2a3554]">
        <TabsTrigger value="plan">Lernplan</TabsTrigger>
        <TabsTrigger value="subjects">Fächer auswählen</TabsTrigger>
      </TabsList>

      <TabsContent value="plan" className="mt-6">
        <div className="grid gap-6">
          <Card className={cn("rounded-2xl border shadow-sm", getSurfaceClass(darkMode))}>
            <CardContent className="grid gap-4 p-5 md:grid-cols-3">
              <div className="grid gap-2">
                <Label>Fachfilter</Label>
                <Select value={learningPlanFilter.subjectId} onValueChange={(value) => setLearningPlanFilter((prev) => ({ ...prev, subjectId: value }))}>
                  <SelectTrigger><SelectValue placeholder="Fach wählen" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle ausgewählten Fächer</SelectItem>
                    {learningPlanModel.selectedSubjects.map((subject) => (
                      <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Sortierung</Label>
                <Select value={learningPlanFilter.sort} onValueChange={(value) => setLearningPlanFilter((prev) => ({ ...prev, sort: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="due">Fälligkeit</SelectItem>
                    <SelectItem value="subject">Fach</SelectItem>
                    <SelectItem value="title">Thema</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Ausgewählte Fächer</Label>
                <div className={cn("rounded-xl border px-3 py-2 text-sm", darkMode ? "border-slate-700 bg-slate-800/50 text-slate-200" : "border-slate-200 bg-slate-50 text-slate-700")}>
                  {selectedSubjectCount} von {data.subjects.length}
                </div>
              </div>
            </CardContent>
          </Card>

          {noTopicsAtAll ? (
            <Card className={cn("rounded-2xl border shadow-sm", getSurfaceClass(darkMode))}>
              <CardContent className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">Noch keine Lernthemen angelegt.</p>
                <Button className="rounded-xl" onClick={() => seedTopicDraft()}>
                  <Plus className="h-4 w-4" />
                  Erstes Lernthema anlegen
                </Button>
              </CardContent>
            </Card>
          ) : activeFilterHasNoTopics ? (
            <Card className={cn("rounded-2xl border shadow-sm", getSurfaceClass(darkMode))}>
              <CardContent className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">Für dieses Fach gibt es noch keine Lernthemen.</p>
                <Button className="rounded-xl" onClick={() => seedTopicDraft(learningPlanFilter.subjectId)}>
                  <Plus className="h-4 w-4" />
                  Lernthema für dieses Fach anlegen
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {!noTopicsAtAll && !activeFilterHasNoTopics ? (
            <>
              <Card className={cn("rounded-2xl border shadow-sm", getSurfaceClass(darkMode))}>
                <CardHeader>
                  <CardTitle>Heute lernen</CardTitle>
                  <CardDescription>Konkrete Lernthemen, die überfällig oder heute fällig sind.</CardDescription>
                </CardHeader>
                <CardContent className="grid max-h-[520px] gap-3 overflow-y-auto pr-2">
                  {todayTopics.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Heute ist keine Wiederholung fällig.</p>
                  ) : todayTopics.map((topic) => renderTopicCard(topic, { mode: "today" }))}
                </CardContent>
              </Card>

              <Card className={cn("rounded-2xl border shadow-sm", getSurfaceClass(darkMode))}>
                <CardHeader>
                  <CardTitle>Weiterlernen</CardTitle>
                  <CardDescription>Nicht fällige oder neue Lernthemen für die nächste Lerneinheit.</CardDescription>
                </CardHeader>
                <CardContent className="grid max-h-[520px] gap-3 overflow-y-auto pr-2">
                  {continueTopics.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Keine weiteren Lernthemen vorhanden.</p>
                  ) : continueTopics.map((topic) => renderTopicCard(topic, { mode: "continue" }))}
                </CardContent>
              </Card>
            </>
          ) : null}

          <Card className={cn("rounded-2xl border shadow-sm", getSurfaceClass(darkMode))}>
            <CardHeader>
              <CardTitle>Heute gelernt</CardTitle>
              <CardDescription>Heute gespeicherte Lerneinheiten mit Thema und Review-Status.</CardDescription>
            </CardHeader>
            <CardContent className="grid max-h-[420px] gap-3 overflow-y-auto pr-2">
              {todaySessions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Heute wurde noch keine Lerneinheit gespeichert.</p>
              ) : todaySessions.map((session) => {
                const subject = subjectById[session.subjectId] || null;
                const rawTopic = session.topicId ? topicById[session.topicId] : null;
                const topicStatus = normalizeTopicStatus(rawTopic?.status);
                const topicLabel = !session.topicId
                  ? "ohne Lernthema"
                  : rawTopic && topicStatus !== "archived" && !rawTopic.completed && !rawTopic.archivedAt
                    ? rawTopic.title
                    : "Lernthema nicht mehr vorhanden";
                return (
                  <div key={session.id} className="grid gap-2 rounded-2xl border p-4 md:grid-cols-[1fr_auto] md:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: subject?.color || "#94a3b8" }} />
                        <span className="font-medium">{subject?.name || "Fach"}</span>
                        <Badge variant="outline">{topicLabel}</Badge>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {getActivityTypeLabel(session.activityType)} - {getConfidenceLabel(session.confidence || "unsure")} - Review: {session.reviewUpdated ? "ja" : "nein"}
                      </p>
                    </div>
                    <Badge variant="secondary">{formatMinutes(session.durationMinutes)}</Badge>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className={cn("rounded-2xl border shadow-sm", getSurfaceClass(darkMode))}>
            <CardHeader>
              <CardTitle>Vorschau</CardTitle>
              <CardDescription>Kommende Wiederholungen nach Datum gruppiert.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5">
              {renderPreviewRows("Morgen", previewGroups.tomorrow)}
              {renderPreviewRows("Diese Woche", previewGroups.week)}
              {renderPreviewRows("Später", previewGroups.later)}
            </CardContent>
          </Card>

          <Card className={cn("rounded-2xl border shadow-sm", getSurfaceClass(darkMode))}>
            <CardHeader>
              <CardTitle>Lernthema anlegen</CardTitle>
              <CardDescription>Neue wiederholbare Wissenseinheit mit optionalem Cheatsheet.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Fach</Label>
                  <Select value={topicDraft.subjectId || undefined} onValueChange={(value) => setTopicDraft((prev) => ({ ...prev, subjectId: value }))}>
                    <SelectTrigger><SelectValue placeholder="Fach wählen" /></SelectTrigger>
                    <SelectContent>
                      {(data.subjects || []).map((subject) => (
                        <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Startstatus</Label>
                  <Select value={topicDraft.status} onValueChange={(value) => setTopicDraft((prev) => ({ ...prev, status: normalizeTopicStatus(value) }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["new", "active", "secure", "paused"].map((status) => (
                        <SelectItem key={status} value={status}>{TOPIC_STATUS_LABELS[status]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Titel</Label>
                <Input value={topicDraft.title} onChange={(event) => setTopicDraft((prev) => ({ ...prev, title: event.target.value }))} placeholder="z. B. Euklidischer Algorithmus" />
              </div>
              <div className="grid gap-2">
                <Label>Cheatsheet / Notiz</Label>
                <Textarea value={topicDraft.cheatsheetText} onChange={(event) => setTopicDraft((prev) => ({ ...prev, cheatsheetText: event.target.value }))} className="min-h-[120px] resize-none" />
              </div>
              <div className="grid gap-2">
                <Label>Cheatsheet-Link (optional)</Label>
                <Input value={topicDraft.cheatsheetUrl} onChange={(event) => setTopicDraft((prev) => ({ ...prev, cheatsheetUrl: event.target.value }))} placeholder="https://..." />
              </div>
              <div className="flex justify-end">
                <Button className="rounded-xl" onClick={createTopicFromDraft} disabled={!topicDraft.subjectId || !topicDraft.title.trim() || isCreatingTopic}>
                  <Plus className="h-4 w-4" />
                  {isCreatingTopic ? "Wird angelegt..." : "Lernthema anlegen"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className={cn("rounded-2xl border shadow-sm", getSurfaceClass(darkMode))}>
            <CardHeader>
              <button type="button" onClick={() => setLearningPlanArchiveCollapsed((prev) => !prev)} className="flex w-full items-center justify-between text-left">
                <div>
                  <CardTitle>Archiv</CardTitle>
                  <CardDescription>Archivierte Lernthemen.</CardDescription>
                </div>
                <ChevronDown className={cn("h-5 w-5 transition-transform", learningPlanArchiveCollapsed ? "rotate-180" : "")} />
              </button>
            </CardHeader>
            {learningPlanArchiveCollapsed ? (
              <CardContent className="grid max-h-[420px] gap-3 overflow-y-auto pr-2">
                {filteredTopics.filter((topic) => topic.status === "archived").length === 0 ? (
                  <p className="text-sm text-muted-foreground">Noch keine archivierten Themen.</p>
                ) : filteredTopics.filter((topic) => topic.status === "archived").map((topic) => (
                  <div key={topic.id} className="flex flex-col gap-3 rounded-2xl border p-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-semibold">{topic.title}</p>
                      <p className="text-sm text-muted-foreground">{topic.subject?.name || "Fach"}</p>
                    </div>
                    <Button size="sm" variant="outline" className="rounded-xl" onClick={() => restoreArchivedTopic(topic)}>Wiederherstellen</Button>
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
                <CardTitle>Fächer auswählen</CardTitle>
                <CardDescription>Nur ausgewählte Fächer erscheinen im Lernplan-Filter.</CardDescription>
              </div>
              <Badge variant="outline">{selectedSubjectCount} ausgewählt</Badge>
            </div>
          </CardHeader>
          <CardContent className="max-h-[calc(100vh-17rem)] overflow-y-auto pr-2 pt-4">
            <div className="grid gap-6">
              {groupedSubjects.length === 0 ? (
                <p className="text-sm text-muted-foreground">Noch keine Fächer vorhanden.</p>
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
                              <div className="flex items-center justify-between"><span className="text-muted-foreground">Fällige Themen</span><span>{overview.dueReviewsCount}</span></div>
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
