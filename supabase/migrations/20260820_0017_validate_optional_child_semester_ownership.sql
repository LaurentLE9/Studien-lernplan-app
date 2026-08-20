-- KAN-40: validate semester ownership independently when a child has no subject.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.exams record
    JOIN public.semesters semester ON semester.id = record.semester_id
    LEFT JOIN public.subjects subject ON subject.id = record.subject_id
    WHERE record.user_id IS DISTINCT FROM semester.user_id
      OR (
        record.subject_id IS NOT NULL
        AND (
          record.user_id IS DISTINCT FROM subject.user_id
          OR record.semester_id IS DISTINCT FROM subject.semester_id
        )
      )
  ) OR EXISTS (
    SELECT 1
    FROM public.timer_sessions record
    JOIN public.semesters semester ON semester.id = record.semester_id
    LEFT JOIN public.subjects subject ON subject.id = record.subject_id
    WHERE record.user_id IS DISTINCT FROM semester.user_id
      OR (
        record.subject_id IS NOT NULL
        AND (
          record.user_id IS DISTINCT FROM subject.user_id
          OR record.semester_id IS DISTINCT FROM subject.semester_id
        )
      )
  )
  THEN
    RAISE EXCEPTION 'KAN-40: inconsistent optional child ownership must be repaired manually';
  END IF;
END
$$;
