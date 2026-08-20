-- KAN-40: a subject keeps its owner and semester after creation.
CREATE OR REPLACE FUNCTION public.prevent_subject_scope_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.semester_id IS DISTINCT FROM OLD.semester_id
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'KAN-40: subject user and semester scope are immutable';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS subjects_prevent_scope_change ON public.subjects;
CREATE TRIGGER subjects_prevent_scope_change
BEFORE UPDATE OF user_id, semester_id ON public.subjects
FOR EACH ROW EXECUTE FUNCTION public.prevent_subject_scope_change();
