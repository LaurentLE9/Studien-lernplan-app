-- KAN-40: reject unresolved legacy rows before enforcing mandatory semester ownership.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.subjects WHERE semester_id IS NULL)
    OR EXISTS (SELECT 1 FROM public.topics WHERE semester_id IS NULL)
    OR EXISTS (SELECT 1 FROM public.exams WHERE semester_id IS NULL)
    OR EXISTS (SELECT 1 FROM public.study_time_entries WHERE semester_id IS NULL)
    OR EXISTS (SELECT 1 FROM public.timer_sessions WHERE semester_id IS NULL)
  THEN
    RAISE EXCEPTION 'KAN-40: unresolved rows without semester_id must be assigned before constraints are enforced';
  END IF;
END
$$;

ALTER TABLE public.topics
  ALTER COLUMN semester_id SET NOT NULL;

ALTER TABLE public.subjects
  ALTER COLUMN semester_id SET NOT NULL;

ALTER TABLE public.exams
  ALTER COLUMN semester_id SET NOT NULL;

ALTER TABLE public.study_time_entries
  ALTER COLUMN semester_id SET NOT NULL;

ALTER TABLE public.timer_sessions
  ALTER COLUMN semester_id SET NOT NULL;

ALTER TABLE public.topics
  DROP CONSTRAINT IF EXISTS topics_semester_id_fkey,
  ADD CONSTRAINT topics_semester_id_fkey
    FOREIGN KEY (semester_id) REFERENCES public.semesters(id) ON DELETE RESTRICT;

ALTER TABLE public.subjects
  DROP CONSTRAINT IF EXISTS subjects_semester_id_fkey,
  ADD CONSTRAINT subjects_semester_id_fkey
    FOREIGN KEY (semester_id) REFERENCES public.semesters(id) ON DELETE RESTRICT;

ALTER TABLE public.exams
  DROP CONSTRAINT IF EXISTS exams_semester_id_fkey,
  ADD CONSTRAINT exams_semester_id_fkey
    FOREIGN KEY (semester_id) REFERENCES public.semesters(id) ON DELETE RESTRICT;

ALTER TABLE public.study_time_entries
  DROP CONSTRAINT IF EXISTS study_time_entries_semester_id_fkey,
  ADD CONSTRAINT study_time_entries_semester_id_fkey
    FOREIGN KEY (semester_id) REFERENCES public.semesters(id) ON DELETE RESTRICT;

ALTER TABLE public.timer_sessions
  DROP CONSTRAINT IF EXISTS timer_sessions_semester_id_fkey,
  ADD CONSTRAINT timer_sessions_semester_id_fkey
    FOREIGN KEY (semester_id) REFERENCES public.semesters(id) ON DELETE RESTRICT;

NOTIFY pgrst, 'reload schema';
