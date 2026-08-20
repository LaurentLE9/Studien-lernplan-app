-- KAN-40: fail deployment if legacy child rows violate user or semester ownership.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.topics record
    JOIN public.subjects subject ON subject.id = record.subject_id
    JOIN public.semesters semester ON semester.id = record.semester_id
    WHERE record.user_id IS DISTINCT FROM subject.user_id
      OR record.user_id IS DISTINCT FROM semester.user_id
      OR record.semester_id IS DISTINCT FROM subject.semester_id
  ) OR EXISTS (
    SELECT 1
    FROM public.exams record
    JOIN public.subjects subject ON subject.id = record.subject_id
    JOIN public.semesters semester ON semester.id = record.semester_id
    WHERE record.user_id IS DISTINCT FROM subject.user_id
      OR record.user_id IS DISTINCT FROM semester.user_id
      OR record.semester_id IS DISTINCT FROM subject.semester_id
  ) OR EXISTS (
    SELECT 1
    FROM public.study_time_entries record
    JOIN public.subjects subject ON subject.id = record.subject_id
    JOIN public.semesters semester ON semester.id = record.semester_id
    WHERE record.user_id IS DISTINCT FROM subject.user_id
      OR record.user_id IS DISTINCT FROM semester.user_id
      OR record.semester_id IS DISTINCT FROM subject.semester_id
  ) OR EXISTS (
    SELECT 1
    FROM public.timer_sessions record
    JOIN public.subjects subject ON subject.id = record.subject_id
    JOIN public.semesters semester ON semester.id = record.semester_id
    WHERE record.user_id IS DISTINCT FROM subject.user_id
      OR record.user_id IS DISTINCT FROM semester.user_id
      OR record.semester_id IS DISTINCT FROM subject.semester_id
  )
  THEN
    RAISE EXCEPTION 'KAN-40: inconsistent child ownership must be repaired manually';
  END IF;
END
$$;
