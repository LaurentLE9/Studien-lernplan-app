-- KAN-40: preserve unambiguous legacy records before enforcing semester ownership.
WITH sole_user_semesters AS (
  SELECT user_id, min(id::text)::uuid AS semester_id
  FROM public.semesters
  GROUP BY user_id
  HAVING count(*) = 1
)
UPDATE public.subjects subject
SET semester_id = sole.semester_id
FROM sole_user_semesters sole
WHERE subject.user_id = sole.user_id
  AND subject.semester_id IS NULL;

UPDATE public.topics topic
SET semester_id = subject.semester_id
FROM public.subjects subject
WHERE topic.subject_id = subject.id
  AND topic.semester_id IS NULL
  AND subject.semester_id IS NOT NULL;

UPDATE public.exams exam
SET semester_id = subject.semester_id
FROM public.subjects subject
WHERE exam.subject_id = subject.id
  AND exam.semester_id IS NULL
  AND subject.semester_id IS NOT NULL;

UPDATE public.study_time_entries entry
SET semester_id = subject.semester_id
FROM public.subjects subject
WHERE entry.subject_id = subject.id
  AND entry.semester_id IS NULL
  AND subject.semester_id IS NOT NULL;

UPDATE public.timer_sessions timer
SET semester_id = subject.semester_id
FROM public.subjects subject
WHERE timer.subject_id = subject.id
  AND timer.semester_id IS NULL
  AND subject.semester_id IS NOT NULL;

WITH sole_user_semesters AS (
  SELECT user_id, min(id::text)::uuid AS semester_id
  FROM public.semesters
  GROUP BY user_id
  HAVING count(*) = 1
)
UPDATE public.timer_sessions timer
SET semester_id = sole.semester_id
FROM sole_user_semesters sole
WHERE timer.user_id = sole.user_id
  AND timer.semester_id IS NULL
  AND timer.subject_id IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.subjects WHERE semester_id IS NULL)
    OR EXISTS (SELECT 1 FROM public.topics WHERE semester_id IS NULL)
    OR EXISTS (SELECT 1 FROM public.exams WHERE semester_id IS NULL)
    OR EXISTS (SELECT 1 FROM public.study_time_entries WHERE semester_id IS NULL)
    OR EXISTS (SELECT 1 FROM public.timer_sessions WHERE semester_id IS NULL)
  THEN
    RAISE EXCEPTION 'KAN-40: ambiguous rows without semester_id must be assigned manually';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.subjects record
    JOIN public.semesters semester ON semester.id = record.semester_id
    WHERE record.user_id <> semester.user_id
  ) OR EXISTS (
    SELECT 1
    FROM public.topics record
    JOIN public.subjects subject ON subject.id = record.subject_id
    WHERE record.semester_id IS DISTINCT FROM subject.semester_id
  ) OR EXISTS (
    SELECT 1
    FROM public.exams record
    JOIN public.subjects subject ON subject.id = record.subject_id
    WHERE record.semester_id IS DISTINCT FROM subject.semester_id
  ) OR EXISTS (
    SELECT 1
    FROM public.study_time_entries record
    JOIN public.subjects subject ON subject.id = record.subject_id
    WHERE record.semester_id IS DISTINCT FROM subject.semester_id
  ) OR EXISTS (
    SELECT 1
    FROM public.timer_sessions record
    JOIN public.subjects subject ON subject.id = record.subject_id
    WHERE record.semester_id IS DISTINCT FROM subject.semester_id
  )
  THEN
    RAISE EXCEPTION 'KAN-40: inconsistent semester ownership must be repaired manually';
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
