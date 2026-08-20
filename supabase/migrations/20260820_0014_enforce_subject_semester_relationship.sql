-- KAN-40: permanently enforce user and semester consistency for scoped records.
ALTER TABLE public.semesters
  ADD CONSTRAINT semesters_id_user_id_key UNIQUE (id, user_id);

ALTER TABLE public.subjects
  ADD CONSTRAINT subjects_semester_id_user_id_fkey
    FOREIGN KEY (semester_id, user_id)
    REFERENCES public.semesters(id, user_id)
    ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION public.enforce_subject_semester_relationship()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  semester_owner_id uuid;
  subject_semester_id uuid;
  subject_owner_id uuid;
BEGIN
  SELECT semester.user_id
  INTO semester_owner_id
  FROM public.semesters semester
  WHERE semester.id = NEW.semester_id;

  IF semester_owner_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = 'KAN-40: semester does not exist or is not accessible';
  END IF;

  IF semester_owner_id IS DISTINCT FROM NEW.user_id THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'KAN-40: record user must own the selected semester';
  END IF;

  IF NEW.subject_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT subject.semester_id, subject.user_id
  INTO subject_semester_id, subject_owner_id
  FROM public.subjects subject
  WHERE subject.id = NEW.subject_id;

  IF subject_owner_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = 'KAN-40: subject does not exist or is not accessible';
  END IF;

  IF subject_semester_id IS DISTINCT FROM NEW.semester_id
    OR subject_owner_id IS DISTINCT FROM NEW.user_id
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'KAN-40: subject, semester and user must belong to the same scope';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS topics_subject_semester_relationship ON public.topics;
CREATE TRIGGER topics_subject_semester_relationship
BEFORE INSERT OR UPDATE OF subject_id, semester_id, user_id ON public.topics
FOR EACH ROW EXECUTE FUNCTION public.enforce_subject_semester_relationship();

DROP TRIGGER IF EXISTS exams_subject_semester_relationship ON public.exams;
CREATE TRIGGER exams_subject_semester_relationship
BEFORE INSERT OR UPDATE OF subject_id, semester_id, user_id ON public.exams
FOR EACH ROW EXECUTE FUNCTION public.enforce_subject_semester_relationship();

DROP TRIGGER IF EXISTS study_time_entries_subject_semester_relationship ON public.study_time_entries;
CREATE TRIGGER study_time_entries_subject_semester_relationship
BEFORE INSERT OR UPDATE OF subject_id, semester_id, user_id ON public.study_time_entries
FOR EACH ROW EXECUTE FUNCTION public.enforce_subject_semester_relationship();

DROP TRIGGER IF EXISTS timer_sessions_subject_semester_relationship ON public.timer_sessions;
CREATE TRIGGER timer_sessions_subject_semester_relationship
BEFORE INSERT OR UPDATE OF subject_id, semester_id, user_id ON public.timer_sessions
FOR EACH ROW EXECUTE FUNCTION public.enforce_subject_semester_relationship();

NOTIFY pgrst, 'reload schema';
