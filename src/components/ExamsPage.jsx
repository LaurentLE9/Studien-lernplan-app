import React, { useEffect, useMemo, useState } from "react";
import { Archive, ArchiveRestore, Check, Pencil, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import ResizablePanel from "@/components/ResizablePanel";

function startOfDay(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getExamTimestamp(exam) {
  const examDate = exam.examDate || "2999-12-31";
  const examTime = exam.examTime || "00:00";
  const timestamp = new Date(`${examDate}T${examTime}`).getTime();
  return Number.isNaN(timestamp) ? Number.MAX_SAFE_INTEGER : timestamp;
}

function getCountdownLabel(examDate) {
  if (!examDate) return "Kein Datum";

  const examDay = startOfDay(examDate);
  const today = startOfDay(new Date());
  if (!examDay || !today) return "Kein Datum";

  const diffDays = Math.round((examDay.getTime() - today.getTime()) / 86400000);
  if (diffDays === 0) return "heute";
  if (diffDays === 1) return "morgen";
  if (diffDays > 1) return `in ${diffDays} Tagen`;
  if (diffDays === -1) return "vor 1 Tag";
  return `vor ${Math.abs(diffDays)} Tagen`;
}

function countdownTone(examDate) {
  const examDay = startOfDay(examDate);
  const today = startOfDay(new Date());
  if (!examDay || !today) return "outline";

  const diffDays = Math.round((examDay.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return "destructive";
  if (diffDays <= 1) return "secondary";
  return "outline";
}

function formatExamDate(examDate) {
  if (!examDate) return "";
  const date = new Date(examDate);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function formatExamTime(examTime) {
  if (!examTime) return "";
  return examTime.slice(0, 5);
}

function matchesExamFilter(exam, filter) {
  if (filter.subjectId !== "all" && exam.subjectId !== filter.subjectId) return false;
  if (filter.status === "open") return exam.status === "open" && !exam.isArchived;
  if (filter.status === "written") return exam.status === "written";
  if (filter.status === "archived") return Boolean(exam.isArchived);
  return true;
}

function ExamForm({ subjects, initialValue, onSave, onDone }) {
  const emptyForm = {
    title: "",
    subjectId: "",
    examDate: "",
    examTime: "",
    location: "",
    notes: "",
  };
  const [form, setForm] = useState(initialValue ? { ...emptyForm, ...initialValue } : emptyForm);
  const [errors, setErrors] = useState({ title: "", subjectId: "", examDate: "" });

  useEffect(() => {
    setForm(initialValue ? { ...emptyForm, ...initialValue } : emptyForm);
    setErrors({ title: "", subjectId: "", examDate: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValue]);

  function validate(currentForm) {
    const nextErrors = { title: "", subjectId: "", examDate: "" };
    if (!currentForm.title.trim()) nextErrors.title = "Bitte gib einen Titel ein.";
    if (!currentForm.subjectId) nextErrors.subjectId = "Bitte wähle ein Fach aus.";
    if (!currentForm.examDate) nextErrors.examDate = "Bitte wähle ein Prüfungsdatum.";
    setErrors(nextErrors);
    return !nextErrors.title && !nextErrors.subjectId && !nextErrors.examDate;
  }

  function handleSaveClick() {
    if (!validate(form)) return;
    onSave({
      ...initialValue,
      ...form,
      status: initialValue?.status === "written" ? "written" : "open",
      isArchived: Boolean(initialValue?.isArchived),
    });
    onDone?.();
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label>Titel</Label>
        <Input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} className={errors.title ? "border-red-500 focus-visible:ring-red-500" : ""} />
        {errors.title ? <p className="text-sm text-red-500">{errors.title}</p> : null}
      </div>

      <div className="grid gap-2">
        <Label>Fach</Label>
        <Select value={form.subjectId || undefined} onValueChange={(value) => setForm((prev) => ({ ...prev, subjectId: value }))}>
          <SelectTrigger className={errors.subjectId ? "border-red-500 focus:ring-red-500" : ""}>
            <SelectValue placeholder="Fach auswählen" />
          </SelectTrigger>
          <SelectContent>
            {subjects.length === 0 ? (
              <SelectItem value="__none__" disabled>Keine Fächer vorhanden</SelectItem>
            ) : subjects.map((subject) => (
              <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.subjectId ? <p className="text-sm text-red-500">{errors.subjectId}</p> : null}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label>Prüfungsdatum</Label>
          <Input type="date" value={form.examDate} onChange={(e) => setForm((prev) => ({ ...prev, examDate: e.target.value }))} className={errors.examDate ? "border-red-500 focus-visible:ring-red-500" : ""} />
          {errors.examDate ? <p className="text-sm text-red-500">{errors.examDate}</p> : null}
        </div>
        <div className="grid gap-2">
          <Label>Uhrzeit optional</Label>
          <Input type="time" value={form.examTime} onChange={(e) => setForm((prev) => ({ ...prev, examTime: e.target.value }))} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label>Ort optional</Label>
          <Input value={form.location} onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))} placeholder="z. B. Raum 2.14" />
        </div>
        <div className="grid gap-2">
          <Label>Notizen optional</Label>
          <Textarea value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} placeholder="z. B. Hilfsmittel, Raumwechsel, Stoffgebiet" />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        {onDone ? <Button variant="outline" onClick={onDone}>Abbrechen</Button> : null}
        <Button onClick={handleSaveClick}>Speichern</Button>
      </div>
    </div>
  );
}

function ExamCard({ exam, subject, darkMode, archived, onEdit, onMarkWritten, onArchive, onRestore, onDelete }) {
  return (
    <Card className={cn("rounded-2xl border shadow-sm", darkMode ? "bg-slate-900/80" : "bg-white") }>
      <CardContent className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: subject?.color || "#94a3b8" }} />
              <h3 className="text-base font-semibold">{exam.title}</h3>
              <Badge variant={countdownTone(exam.examDate)}>{getCountdownLabel(exam.examDate)}</Badge>
              <Badge variant="outline">{archived ? (exam.status === "written" ? "Geschrieben" : "Archiviert") : "Offen"}</Badge>
            </div>

            <p className={cn("text-sm", darkMode ? "text-slate-300" : "text-slate-600")}>{subject?.name || "Ohne Fach"}</p>

            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">Prüfungsdatum: {formatExamDate(exam.examDate)}</Badge>
              {exam.examTime ? <Badge variant="outline">Uhrzeit: {formatExamTime(exam.examTime)}</Badge> : null}
              {exam.location ? <Badge variant="outline">Ort: {exam.location}</Badge> : null}
            </div>

            {exam.notes ? <p className={cn("text-sm", darkMode ? "text-slate-300" : "text-slate-600")}>{exam.notes}</p> : null}
          </div>

          <div className="flex flex-wrap gap-2 self-end lg:self-start">
            <Button variant="outline" size="icon" onClick={onEdit}><Pencil className="h-4 w-4" /></Button>
            {archived ? (
              <Button variant="outline" size="icon" onClick={onRestore}><ArchiveRestore className="h-4 w-4" /></Button>
            ) : (
              <>
                {exam.status !== "written" ? (
                  <Button variant="outline" size="icon" onClick={onMarkWritten}><Check className="h-4 w-4" /></Button>
                ) : null}
                <Button variant="outline" size="icon" onClick={onArchive}><Archive className="h-4 w-4" /></Button>
              </>
            )}
            <Button variant="outline" size="icon" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ExamsPage({
  darkMode,
  examSubjects,
  subjectsById,
  exams,
  examFilter,
  setExamFilter,
  examDialogOpen,
  setExamDialogOpen,
  editingExam,
  setEditingExam,
  saveExam,
  markExamWritten,
  archiveExam,
  restoreExam,
  deleteExam,
}) {
  const selectedCount = examSubjects.length;
  const filteredExams = useMemo(() => exams.filter((exam) => matchesExamFilter(exam, examFilter)), [exams, examFilter]);
  const openExams = useMemo(() => [...filteredExams].filter((exam) => exam.status === "open" && !exam.isArchived).sort((a, b) => getExamTimestamp(a) - getExamTimestamp(b) || (a.title || "").localeCompare(b.title || "", "de")), [filteredExams]);
  const archivedExams = useMemo(() => [...filteredExams].filter((exam) => exam.status === "written" || exam.isArchived).sort((a, b) => getExamTimestamp(b) - getExamTimestamp(a) || (a.title || "").localeCompare(b.title || "", "de")), [filteredExams]);

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight sm:text-[2rem]">Klausuren</h2>
          <p className="mt-1 text-sm text-muted-foreground">Prüfungen, Status und nächste Termine im Blick behalten.</p>
        </div>
          <Button variant="outline" className="h-11 rounded-[1rem] px-4" onClick={() => { setEditingExam(null); setExamDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />Klausur anlegen
          </Button>
          <ResizablePanel 
            open={examDialogOpen} 
            onOpenChange={(open) => { setExamDialogOpen(open); if (!open) setEditingExam(null); }}
            darkMode={darkMode}
            title={editingExam ? "Klausur bearbeiten" : "Klausur anlegen"}
            description={editingExam ? "Passe die Daten der ausgewählten Klausur an." : "Erfasse einen neuen Klausurtermin und weise ihn einem Fach zu."}
            badgeText={editingExam ? "Bearbeiten" : "Neu erfassen"}
          >
            <ExamForm subjects={examSubjects} initialValue={editingExam} onSave={saveExam} onDone={() => { setExamDialogOpen(false); setEditingExam(null); }} />
          </ResizablePanel>
        </div>
      <Card className={cn("rounded-[1.4rem] border shadow-sm", darkMode ? "bg-slate-900/80 text-slate-50" : "bg-white text-slate-900")}>
        <CardContent className="flex flex-wrap items-center gap-4 p-4 lg:p-6">
          <div className="grid gap-2">
            <Label>Fach</Label>
            <Select value={examFilter.subjectId} onValueChange={(value) => setExamFilter((prev) => ({ ...prev, subjectId: value }))}>
              <SelectTrigger><SelectValue placeholder="Fach wählen" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Fächer</SelectItem>
                {examSubjects.map((subject) => (
                  <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Status</Label>
            <Select value={examFilter.status} onValueChange={(value) => setExamFilter((prev) => ({ ...prev, status: value }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                <SelectItem value="open">Offen</SelectItem>
                <SelectItem value="written">Geschrieben</SelectItem>
                <SelectItem value="archived">Archiviert</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Offene Klausuren</Label>
            <div className={cn("rounded-xl border px-3 py-2 text-sm", darkMode ? "border-slate-700 bg-slate-800/50 text-slate-200" : "border-slate-200 bg-slate-50 text-slate-700") }>
              {openExams.length}
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Archiviert / geschrieben</Label>
            <div className={cn("rounded-xl border px-3 py-2 text-sm", darkMode ? "border-slate-700 bg-slate-800/50 text-slate-200" : "border-slate-200 bg-slate-50 text-slate-700") }>
              {archivedExams.length}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className={cn("rounded-[1.4rem] border shadow-[var(--shadow-soft)]", darkMode ? "bg-slate-900/80" : "bg-white") }>
          <CardHeader>
            <CardTitle>Offene Klausuren</CardTitle>
            <CardDescription>Bevorstehende Prüfungen in aufsteigender Reihenfolge.</CardDescription>
          </CardHeader>
          <CardContent className="grid max-h-[780px] gap-4 overflow-y-auto pr-2">
            {selectedCount === 0 ? (
              <div className="rounded-2xl border p-6 text-center text-sm text-muted-foreground">Wähle zuerst Fächer aus.</div>
            ) : openExams.length === 0 ? (
              <div className="rounded-2xl border p-6 text-center text-sm text-muted-foreground">Keine offenen Klausuren für die aktuelle Auswahl.</div>
            ) : openExams.map((exam) => (
              <ExamCard
                key={exam.id}
                exam={exam}
                subject={subjectsById[exam.subjectId] || null}
                darkMode={darkMode}
                archived={false}
                onEdit={() => { setEditingExam(exam); setExamDialogOpen(true); }}
                onMarkWritten={() => markExamWritten(exam)}
                onArchive={() => archiveExam(exam)}
                onRestore={() => restoreExam(exam)}
                onDelete={() => deleteExam(exam.id)}
              />
            ))}
          </CardContent>
        </Card>

        <Card className={cn("rounded-[1.4rem] border shadow-[var(--shadow-soft)]", darkMode ? "bg-slate-900/80" : "bg-white") }>
          <CardHeader>
            <CardTitle>Archiv / geschriebene Klausuren</CardTitle>
            <CardDescription>Bereits geschriebene oder archivierte Prüfungen in absteigender Reihenfolge.</CardDescription>
          </CardHeader>
          <CardContent className="grid max-h-[780px] gap-4 overflow-y-auto pr-2">
            {selectedCount === 0 ? (
              <div className="rounded-2xl border p-6 text-center text-sm text-muted-foreground">Wähle zuerst Fächer aus.</div>
            ) : archivedExams.length === 0 ? (
              <div className="rounded-2xl border p-6 text-center text-sm text-muted-foreground">Noch keine archivierten oder geschriebenen Klausuren vorhanden.</div>
            ) : archivedExams.map((exam) => (
              <ExamCard
                key={exam.id}
                exam={exam}
                subject={subjectsById[exam.subjectId] || null}
                darkMode={darkMode}
                archived
                onEdit={() => { setEditingExam(exam); setExamDialogOpen(true); }}
                onMarkWritten={() => markExamWritten(exam)}
                onArchive={() => archiveExam(exam)}
                onRestore={() => restoreExam(exam)}
                onDelete={() => deleteExam(exam.id)}
              />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
