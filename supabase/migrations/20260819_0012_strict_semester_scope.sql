-- KAN-40: preserve existing records while making semester ownership explicit.
ALTER TABLE public.topics
  ADD COLUMN IF NOT EXISTS semester_id uuid REFERENCES public.semesters(id) ON DELETE SET NULL;

ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS semester_id uuid REFERENCES public.semesters(id) ON DELETE SET NULL;

ALTER TABLE public.study_time_entries
  ADD COLUMN IF NOT EXISTS semester_id uuid REFERENCES public.semesters(id) ON DELETE SET NULL;

ALTER TABLE public.timer_sessions
  ADD COLUMN IF NOT EXISTS semester_id uuid REFERENCES public.semesters(id) ON DELETE SET NULL;

UPDATE public.topics t
SET semester_id = s.semester_id
FROM public.subjects s
WHERE t.subject_id = s.id
  AND t.semester_id IS NULL;

UPDATE public.exams e
SET semester_id = s.semester_id
FROM public.subjects s
WHERE e.subject_id = s.id
  AND e.semester_id IS NULL;

UPDATE public.study_time_entries e
SET semester_id = s.semester_id
FROM public.subjects s
WHERE e.subject_id = s.id
  AND e.semester_id IS NULL;

UPDATE public.timer_sessions t
SET semester_id = s.semester_id
FROM public.subjects s
WHERE t.subject_id = s.id
  AND t.semester_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_topics_semester_id ON public.topics(semester_id);
CREATE INDEX IF NOT EXISTS idx_exams_semester_id ON public.exams(semester_id);
CREATE INDEX IF NOT EXISTS idx_study_time_entries_semester_id ON public.study_time_entries(semester_id);
CREATE INDEX IF NOT EXISTS idx_timer_sessions_semester_id ON public.timer_sessions(semester_id);

NOTIFY pgrst, 'reload schema';